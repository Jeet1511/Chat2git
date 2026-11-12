import './config.mjs';
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHubClient, parseRepoUrl, assertRepo } from './github.mjs';
import { HOST, PORT, WRITES_ENABLED, LOOPBACK_HOSTS } from './config.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');

if (!LOOPBACK_HOSTS.includes(HOST)) {
  console.error(`Refusing to listen on ${HOST}. Chat2git only binds to 127.0.0.1 or localhost.`);
  process.exit(1);
}

const CONFIGURED_KEY = (process.env.BRIDGE_API_KEY || '').trim();
const API_KEY = CONFIGURED_KEY || randomBytes(32).toString('hex');
const ALLOWED_HOSTS = new Set(LOOPBACK_HOSTS.map(h => `${h}:${PORT}`));
const ALLOWED_ORIGINS = new Set([...ALLOWED_HOSTS].map(h => `http://${h}`));
let connected = null;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

// Blocks DNS rebinding (wrong Host) and cross-site pages (foreign Origin).
function checkRequest(req) {
  if (!ALLOWED_HOSTS.has(req.headers.host)) throw httpError(403, 'Forbidden: unexpected Host header.');
  const origin = req.headers.origin;
  if (origin !== undefined && !ALLOWED_ORIGINS.has(origin)) throw httpError(403, 'Forbidden: cross-origin request.');
}

function hasValidKey(req) {
  const provided = req.headers['x-chat2git-key'];
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(API_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function body(req) {
  if (!req.headers['content-length'] && !req.headers['transfer-encoding']) return {};
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw httpError(415, 'Requests with a body must use Content-Type: application/json.');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) throw httpError(413, 'Request body too large.');
  }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw httpError(400, 'Request body must be valid JSON.'); }
}

function client() { return new GitHubClient(process.env.GITHUB_TOKEN || ''); }

function repoFrom(input = {}) {
  if (input.owner !== undefined || input.repo !== undefined) return assertRepo(input.owner, input.repo);
  if (input.url) return parseRepoUrl(input.url);
  if (connected) return connected;
  throw httpError(400, 'Provide a GitHub repository URL or connect one in the dashboard.');
}

function requireWrites() {
  if (!WRITES_ENABLED) throw httpError(403, 'Write operations are disabled. Set CHAT2GIT_ALLOW_WRITES=true in .env to enable them.');
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;
  try {
    checkRequest(req);
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, { ok: true, name: 'Chat2git', version: '0.1.0', authRequired: true, writesEnabled: WRITES_ENABLED });
    }
    if (!hasValidKey(req)) throw httpError(401, 'Unauthorized. Missing or invalid X-Chat2git-Key.');

    const input = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await body(req);

    if (req.method === 'POST' && path === '/api/connect') {
      const parsed = parseRepoUrl(input.url);
      const info = await client().repo(parsed.owner, parsed.repo);
      connected = parsed;
      return send(res, 200, { connected: true, repository: { owner: info.owner.login, name: info.name, full_name: info.full_name, description: info.description, private: info.private, default_branch: info.default_branch, html_url: info.html_url, language: info.language, stargazers_count: info.stargazers_count, updated_at: info.updated_at } });
    }
    if (req.method === 'POST' && path === '/api/disconnect') { connected = null; return send(res, 200, { connected: false }); }
    if (req.method === 'GET' && path === '/api/status') {
      return send(res, 200, { connected: Boolean(connected), repository: connected || null, authenticated: Boolean(process.env.GITHUB_TOKEN), writesEnabled: WRITES_ENABLED });
    }

    const { owner, repo } = repoFrom(input);
    const gh = client();
    if (req.method === 'GET' && path === '/api/repo') {
      const r = await gh.repo(owner, repo);
      return send(res, 200, { owner: r.owner.login, name: r.name, full_name: r.full_name, description: r.description, private: r.private, default_branch: r.default_branch, html_url: r.html_url, language: r.language, size: r.size, updated_at: r.updated_at, permissions: r.permissions || null });
    }
    if (req.method === 'GET' && path === '/api/tree') {
      const tree = await gh.tree(owner, repo, input.ref);
      return send(res, 200, { ref: tree.ref, truncated: tree.truncated, tree: tree.tree.map(x => ({ path: x.path, type: x.type, size: x.size, sha: x.sha })) });
    }
    if (req.method === 'GET' && path === '/api/file') return send(res, 200, await gh.file(owner, repo, input.path, input.ref));
    if (req.method === 'GET' && path === '/api/branches') return send(res, 200, await gh.branches(owner, repo));
    if (req.method === 'GET' && path === '/api/commits') return send(res, 200, await gh.commits(owner, repo, input.branch, Number(input.limit || 20)));
    if (req.method === 'GET' && path === '/api/search') return send(res, 200, await gh.searchCode(owner, repo, input.q || ''));
    if (req.method === 'GET' && path === '/api/compare') return send(res, 200, await gh.compare(owner, repo, input.base, input.head));
    if (req.method === 'POST' && path === '/api/branch') {
      requireWrites();
      return send(res, 201, await gh.createBranch(owner, repo, input.branch, input.fromBranch, input.approved));
    }
    if (req.method === 'POST' && path === '/api/file') {
      requireWrites();
      return send(res, 200, await gh.writeFile(owner, repo, input.path, input.content, input.message, input.branch, input.approved, input.sha));
    }
    if (req.method === 'DELETE' && path === '/api/file') {
      requireWrites();
      return send(res, 200, await gh.deleteFile(owner, repo, input.path, input.message, input.branch, input.sha, input.approved));
    }
    if (req.method === 'POST' && path === '/api/pull-request') {
      requireWrites();
      return send(res, 201, await gh.pullRequest(owner, repo, input.title, input.head, input.base, input.body, input.approved));
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (error) {
    const status = error.status || 400;
    return send(res, status, { error: error.message, ...(error.documentationUrl ? { documentationUrl: error.documentationUrl } : {}) });
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const SCRIPT_TAG = '<script src="/app.js"></script>';

const server = http.createServer(async (req, res) => {
  try { checkRequest(req); } catch { return sendText(res, 403, 'Forbidden'); }
  if (req.url.startsWith('/api/')) return handle(req, res);
  if (req.method !== 'GET') return sendText(res, 405, 'Method not allowed');

  const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  const rel = pathname === '/' ? '/index.html' : pathname;
  const full = normalize(join(PUBLIC_DIR, rel));
  if (!full.startsWith(PUBLIC_DIR + sep)) return sendText(res, 404, 'Not found');

  try {
    let file = await readFile(full);
    if (rel === '/index.html') {
      // Only the dashboard page receives the key; other origins cannot read this response.
      const page = file.toString('utf8').replace(SCRIPT_TAG, `<script>window.CHAT2GIT_KEY=${JSON.stringify(API_KEY)};</script>${SCRIPT_TAG}`);
      file = Buffer.from(page, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(file);
  } catch {
    sendText(res, 404, 'Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chat2git dashboard: http://${HOST}:${PORT}`);
  if (!CONFIGURED_KEY) console.log(`API key for this session (set BRIDGE_API_KEY in .env to keep a fixed key): ${API_KEY}`);
  console.log(`Writes: ${WRITES_ENABLED ? 'enabled (CHAT2GIT_ALLOW_WRITES=true)' : 'disabled'}`);
});
