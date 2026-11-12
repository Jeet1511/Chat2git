import './env.mjs';
import readline from 'node:readline';
import { GitHubClient, parseRepoUrl } from './github.mjs';
import { WRITES_ENABLED } from './config.mjs';

const gh = new GitHubClient(process.env.GITHUB_TOKEN || '');
const tools = [
  { name: 'github_repo_info', description: 'Get metadata for a public or authorized GitHub repository.', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'GitHub repository URL' } }, required: ['url'] } },
  { name: 'github_repo_tree', description: 'List repository paths and metadata without downloading file contents.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, ref: { type: 'string', description: 'Branch, tag or commit SHA; defaults to repository default branch.' } }, required: ['url'] } },
  { name: 'github_read_file', description: 'Read one text file from a GitHub repository. File size is capped by MAX_FILE_BYTES.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' } }, required: ['url', 'path'] } },
  { name: 'github_branches', description: 'List branches and their latest commit SHAs.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'github_commits', description: 'List recent commits for a branch.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, branch: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['url'] } },
  { name: 'github_search_code', description: 'Search code in a repository. Requires an authenticated GitHub token.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, query: { type: 'string' } }, required: ['url', 'query'] } },
  { name: 'github_compare', description: 'Compare two branches, tags or commits.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' } }, required: ['url', 'base', 'head'] } },
  { name: 'github_create_branch', description: 'Create a branch. Requires user approval, write access and approved=true.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, branch: { type: 'string' }, fromBranch: { type: 'string' }, approved: { type: 'boolean', description: 'Must be true only after explicit user approval.' } }, required: ['url', 'branch', 'approved'] } },
  { name: 'github_write_file', description: 'Create or update a file on a branch. Requires explicit approval and write access. For updates, provide the existing file SHA.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' }, branch: { type: 'string' }, sha: { type: 'string' }, approved: { type: 'boolean' } }, required: ['url', 'path', 'content', 'message', 'branch', 'approved'] } },
  { name: 'github_delete_file', description: 'Delete a file from a branch. Requires the file SHA, explicit approval and write access.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, path: { type: 'string' }, message: { type: 'string' }, branch: { type: 'string' }, sha: { type: 'string' }, approved: { type: 'boolean' } }, required: ['url', 'path', 'message', 'branch', 'sha', 'approved'] } },
  { name: 'github_create_pull_request', description: 'Create a pull request. Requires explicit approval and repository write access.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, head: { type: 'string' }, base: { type: 'string' }, body: { type: 'string' }, approved: { type: 'boolean' } }, required: ['url', 'title', 'head', 'base', 'approved'] } }
];
const WRITE_TOOLS = new Set(['github_create_branch', 'github_write_file', 'github_delete_file', 'github_create_pull_request']);
function textResult(value) { return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }; }
async function call(name, a) {
  if (WRITE_TOOLS.has(name) && !WRITES_ENABLED) throw new Error('Write operations are disabled. Set CHAT2GIT_ALLOW_WRITES=true in .env to enable them.');
  const { owner, repo } = parseRepoUrl(a.url);
  switch (name) {
    case 'github_repo_info': { const r = await gh.repo(owner, repo); return { full_name: r.full_name, description: r.description, private: r.private, default_branch: r.default_branch, language: r.language, html_url: r.html_url, updated_at: r.updated_at }; }
    case 'github_repo_tree': { const t = await gh.tree(owner, repo, a.ref); return { ref: t.ref, truncated: t.truncated, tree: t.tree.map(x => ({ path: x.path, type: x.type, size: x.size, sha: x.sha })) }; }
    case 'github_read_file': return await gh.file(owner, repo, a.path, a.ref);
    case 'github_branches': return await gh.branches(owner, repo);
    case 'github_commits': return await gh.commits(owner, repo, a.branch, a.limit || 20);
    case 'github_search_code': return await gh.searchCode(owner, repo, a.query);
    case 'github_compare': return await gh.compare(owner, repo, a.base, a.head);
    case 'github_create_branch': return await gh.createBranch(owner, repo, a.branch, a.fromBranch, a.approved);
    case 'github_write_file': return await gh.writeFile(owner, repo, a.path, a.content, a.message, a.branch, a.approved, a.sha);
    case 'github_delete_file': return await gh.deleteFile(owner, repo, a.path, a.message, a.branch, a.sha, a.approved);
    case 'github_create_pull_request': return await gh.pullRequest(owner, repo, a.title, a.head, a.base, a.body, a.approved);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
function reply(id, result, error) { process.stdout.write(JSON.stringify(error ? { jsonrpc: '2.0', id, error: { code: -32000, message: error.message } } : { jsonrpc: '2.0', id, result }) + '\n'); }
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (!Object.hasOwn(msg, 'id')) return;
  try {
    if (msg.method === 'initialize') return reply(msg.id, { protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'chat2git', version: '0.1.0' } });
    if (msg.method === 'ping') return reply(msg.id, {});
    if (msg.method === 'tools/list') return reply(msg.id, { tools: WRITES_ENABLED ? tools : tools.filter(t => !WRITE_TOOLS.has(t.name)) });
    if (msg.method === 'tools/call') {
      try { const result = await call(msg.params.name, msg.params.arguments || {}); return reply(msg.id, textResult(result)); }
      catch (e) { return reply(msg.id, { content: [{ type: 'text', text: e.message }], isError: true }); }
    }
    return reply(msg.id, null, new Error(`Unsupported MCP method: ${msg.method}`));
  } catch (e) { reply(msg.id, null, e); }
});
