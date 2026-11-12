import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STUB = pathToFileURL(fileURLToPath(new URL('./fetch-stub.mjs', import.meta.url))).href;
const KEY = 'test-key-123';
let nextPort = 4400 + Math.floor(Math.random() * 400);

function baseEnv(extra) {
  return { ...process.env, GITHUB_TOKEN: '', BRIDGE_API_KEY: '', CHAT2GIT_ALLOW_WRITES: '', HOST: '', ...extra };
}

function startServer(env = {}) {
  const port = nextPort++;
  const child = spawn(process.execPath, ['--import', STUB, 'src/server.mjs'], {
    cwd: ROOT, env: baseEnv({ PORT: String(port), ...env }), stdio: ['ignore', 'pipe', 'pipe']
  });
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('server did not start')); }, 8000);
    child.stdout.on('data', d => {
      out += d;
      if (out.includes('Writes:')) { clearTimeout(timer); resolve({ port, child, output: out }); }
    });
    child.stderr.on('data', d => { out += d; });
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited with code ${code}: ${out}`)); });
  });
}

async function withServer(env, fn) {
  const server = await startServer(env);
  try { return await fn(server); } finally { server.child.kill(); }
}

function request(port, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { host: `127.0.0.1:${port}`, ...headers } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const json = { 'content-type': 'application/json' };
const authed = { 'x-chat2git-key': KEY };

test('health needs no key and reports writes disabled by default', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/health' });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.text).writesEnabled, false);
}));

test('API rejects requests without the key', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/repo?owner=a&repo=b' });
  assert.equal(r.status, 401);
}));

test('Sec-Fetch-Site header no longer bypasses the key', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/repo?owner=a&repo=b', headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(r.status, 401);
}));

test('valid key reads repository metadata', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/repo?owner=a&repo=b', headers: authed });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.text).full_name, 'a/b');
}));

test('DNS-rebinding Host header is rejected', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/health', headers: { host: 'evil.example' } });
  assert.equal(r.status, 403);
}));

test('cross-origin Origin header is rejected even with the key', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/api/repo?owner=a&repo=b', headers: { ...authed, origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
}));

test('text/plain request bodies are refused', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, {
    method: 'POST', path: '/api/file', body: '{"approved":true}',
    headers: { ...authed, 'content-type': 'text/plain' }
  });
  assert.equal(r.status, 415);
}));

test('owner values containing path traversal are rejected', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const owner = encodeURIComponent('a/../../user');
  const r = await request(port, { path: `/api/tree?owner=${owner}&repo=b`, headers: authed });
  assert.equal(r.status, 400);
  assert.match(JSON.parse(r.text).error, /Invalid repository/);
}));

test('traversal in pull-request body is rejected before any GitHub call', () => withServer({ BRIDGE_API_KEY: KEY, CHAT2GIT_ALLOW_WRITES: 'true' }, async ({ port }) => {
  const r = await request(port, {
    method: 'POST', path: '/api/pull-request', headers: { ...authed, ...json },
    body: { owner: 'a/../../user', repo: 'b', title: 't', head: 'h', base: 'main', approved: true }
  });
  assert.equal(r.status, 400);
}));

test('writes are refused when CHAT2GIT_ALLOW_WRITES is not set, even with approved=true', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, {
    method: 'POST', path: '/api/file', headers: { ...authed, ...json },
    body: { owner: 'a', repo: 'b', path: 'x.txt', content: 'hi', message: 'm', branch: 'main', approved: true }
  });
  assert.equal(r.status, 403);
}));

test('writes enabled still require approved=true', () => withServer({ BRIDGE_API_KEY: KEY, CHAT2GIT_ALLOW_WRITES: 'true' }, async ({ port }) => {
  const r = await request(port, {
    method: 'POST', path: '/api/file', headers: { ...authed, ...json },
    body: { owner: 'a', repo: 'b', path: 'x.txt', content: 'hi', message: 'm', branch: 'main' }
  });
  assert.equal(r.status, 400);
  assert.match(JSON.parse(r.text).error, /blocked/);
}));

test('writes enabled with approved=true go through', () => withServer({ BRIDGE_API_KEY: KEY, CHAT2GIT_ALLOW_WRITES: 'true' }, async ({ port }) => {
  const r = await request(port, {
    method: 'POST', path: '/api/file', headers: { ...authed, ...json },
    body: { owner: 'a', repo: 'b', path: 'x.txt', content: 'hi', message: 'm', branch: 'main', approved: true }
  });
  assert.equal(r.status, 200);
}));

test('dashboard page gets the key only for a loopback Host', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const ok = await request(port, { path: '/' });
  assert.equal(ok.status, 200);
  assert.ok(ok.text.includes(`window.CHAT2GIT_KEY="${KEY}"`));
  const rebound = await request(port, { path: '/', headers: { host: 'evil.example' } });
  assert.equal(rebound.status, 403);
  assert.ok(!rebound.text.includes(KEY));
}));

test('static path traversal is blocked', () => withServer({ BRIDGE_API_KEY: KEY }, async ({ port }) => {
  const r = await request(port, { path: '/..%2F..%2Fpackage.json' });
  assert.notEqual(r.status, 200);
}));

test('generates and prints a key when BRIDGE_API_KEY is empty', async () => {
  const server = await startServer({});
  try {
    const match = server.output.match(/API key for this session.*: ([0-9a-f]{64})/);
    assert.ok(match, 'generated key should be printed');
    const denied = await request(server.port, { path: '/api/repo?owner=a&repo=b' });
    assert.equal(denied.status, 401);
    const allowed = await request(server.port, { path: '/api/repo?owner=a&repo=b', headers: { 'x-chat2git-key': match[1] } });
    assert.equal(allowed.status, 200);
  } finally { server.child.kill(); }
});

test('refuses to bind to a non-loopback address', async () => {
  await assert.rejects(startServer({ HOST: '0.0.0.0', BRIDGE_API_KEY: KEY }), /exited with code 1/);
});

// ---- MCP stdio server ----
function runMcp(env, messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/mcp-server.mjs'], {
      cwd: ROOT, env: baseEnv(env), stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('error', reject);
    child.on('close', () => resolve(out.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l))));
    child.stdin.end(messages.map(m => JSON.stringify(m)).join('\n') + '\n');
  });
}

const writeCall = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'github_write_file', arguments: { url: 'https://github.com/a/b', path: 'x.txt', content: 'hi', message: 'm', branch: 'main', approved: true } } };
const listCall = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

test('MCP hides write tools and refuses them when writes are disabled', async () => {
  const replies = await runMcp({ CHAT2GIT_ALLOW_WRITES: '' }, [listCall, writeCall]);
  const names = replies.find(r => r.id === 2).result.tools.map(t => t.name);
  assert.ok(names.includes('github_read_file'));
  assert.ok(!names.includes('github_write_file'));
  const call = replies.find(r => r.id === 3).result;
  assert.equal(call.isError, true);
  assert.match(call.content[0].text, /disabled/);
});

test('MCP lists write tools when writes are enabled, and still requires approved=true', async () => {
  const blocked = { ...writeCall, params: { ...writeCall.params, arguments: { ...writeCall.params.arguments, approved: false } } };
  const replies = await runMcp({ CHAT2GIT_ALLOW_WRITES: 'true' }, [listCall, blocked]);
  const names = replies.find(r => r.id === 2).result.tools.map(t => t.name);
  assert.ok(names.includes('github_write_file'));
  assert.match(replies.find(r => r.id === 3).result.content[0].text, /blocked/);
});
