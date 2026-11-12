const API = 'https://api.github.com';
const USER_AGENT = 'Chat2git/0.1.0';
const NAME_RE = /^[A-Za-z0-9_.-]+$/;

function isSafeName(value) {
  return typeof value === 'string' && NAME_RE.test(value) && value !== '.' && value !== '..';
}

// Every owner/repo that reaches a GitHub URL must pass this check.
export function assertRepo(owner, repo) {
  if (!isSafeName(owner) || !isSafeName(repo)) throw new Error('Invalid repository owner or name.');
  return { owner, repo };
}

export function parseRepoUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Enter a valid GitHub repository URL.'); }
  if (url.hostname.toLowerCase() !== 'github.com' || !['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Only github.com repository URLs are supported.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Repository URL must include an owner and repository name.');
  return assertRepo(parts[0], parts[1].replace(/\.git$/i, ''));
}

// Encodes each segment and refuses '.' / '..' so a path cannot climb out of /contents/.
export function encodePath(path) {
  if (typeof path !== 'string' || path.trim() === '') throw new Error('A file path is required.');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some(s => s === '.' || s === '..')) throw new Error('Invalid file path.');
  return segments.map(encodeURIComponent).join('/');
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required.`);
  return value;
}

function repoPath(owner, repo) {
  const r = assertRepo(owner, repo);
  return `/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`;
}

export class GitHubClient {
  constructor(token = '') { this.token = token || ''; }
  async request(path, options = {}) {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const message = data?.message || `GitHub API request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.documentationUrl = data?.documentation_url;
      throw error;
    }
    return { data, headers: response.headers };
  }
  async repo(owner, repo) {
    const { data } = await this.request(repoPath(owner, repo));
    return data;
  }
  async tree(owner, repo, ref) {
    const base = repoPath(owner, repo);
    const branch = ref ? requireString(ref, 'ref') : (await this.repo(owner, repo)).default_branch;
    const { data } = await this.request(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return { ...data, ref: branch };
  }
  async file(owner, repo, path, ref) {
    const base = repoPath(owner, repo);
    const query = ref ? `?ref=${encodeURIComponent(requireString(ref, 'ref'))}` : '';
    const { data } = await this.request(`${base}/contents/${encodePath(path)}${query}`);
    if (Array.isArray(data)) return data.map(x => ({ name: x.name, path: x.path, type: x.type, size: x.size, sha: x.sha }));
    if (data.type !== 'file') return { name: data.name, path: data.path, type: data.type, sha: data.sha };
    if (data.size > Number(process.env.MAX_FILE_BYTES || 1048576)) throw new Error(`File is ${data.size} bytes; exceeds configured MAX_FILE_BYTES limit.`);
    if (data.encoding !== 'base64') throw new Error(`Unsupported GitHub content encoding: ${data.encoding}`);
    return { name: data.name, path: data.path, size: data.size, sha: data.sha, content: Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8') };
  }
  async commits(owner, repo, branch, perPage = 20) {
    const requested = Number(perPage);
    const n = Number.isFinite(requested) ? requested : 20;
    const q = new URLSearchParams({ per_page: String(Math.min(Math.max(n, 1), 100)) });
    if (branch) q.set('sha', requireString(branch, 'branch'));
    const { data } = await this.request(`${repoPath(owner, repo)}/commits?${q}`);
    return data.map(c => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name, date: c.commit.author?.date, url: c.html_url }));
  }
  async branches(owner, repo) {
    const { data } = await this.request(`${repoPath(owner, repo)}/branches?per_page=100`);
    return data.map(b => ({ name: b.name, sha: b.commit.sha, protected: b.protected }));
  }
  async searchCode(owner, repo, query) {
    if (!this.token) throw new Error('GitHub code search requires authentication. Connect a GitHub token with repository read access.');
    const r = assertRepo(owner, repo);
    const q = `${requireString(query, 'query')} repo:${r.owner}/${r.repo}`;
    const { data } = await this.request(`/search/code?q=${encodeURIComponent(q)}&per_page=30`);
    return data.items.map(x => ({ name: x.name, path: x.path, url: x.html_url, sha: x.sha }));
  }
  async compare(owner, repo, base, head) {
    const path = `${repoPath(owner, repo)}/compare/${encodeURIComponent(requireString(base, 'base'))}...${encodeURIComponent(requireString(head, 'head'))}`;
    const { data } = await this.request(path);
    return { status: data.status, ahead_by: data.ahead_by, behind_by: data.behind_by, total_commits: data.total_commits, files: (data.files || []).map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch })) };
  }
  async createBranch(owner, repo, branch, fromBranch, approved) {
    requireApproval(approved);
    const base = repoPath(owner, repo);
    requireString(branch, 'branch');
    const ref = fromBranch ? requireString(fromBranch, 'fromBranch') : (await this.repo(owner, repo)).default_branch;
    const { data: source } = await this.request(`${base}/git/ref/heads/${encodeURIComponent(ref)}`);
    const { data } = await this.request(`${base}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: source.object.sha }) });
    return { ref: data.ref, sha: data.object.sha };
  }
  async writeFile(owner, repo, path, content, message, branch, approved, sha) {
    requireApproval(approved);
    const base = repoPath(owner, repo);
    if (typeof content !== 'string') throw new Error('content must be a string.');
    const body = { message: requireString(message, 'message'), content: Buffer.from(content, 'utf8').toString('base64'), branch: requireString(branch, 'branch') };
    if (sha) body.sha = requireString(sha, 'sha');
    const { data } = await this.request(`${base}/contents/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
    return { path: data.content?.path || path, commit: data.commit?.sha, url: data.content?.html_url };
  }
  async deleteFile(owner, repo, path, message, branch, sha, approved) {
    requireApproval(approved);
    const base = repoPath(owner, repo);
    const body = { message: requireString(message, 'message'), branch: requireString(branch, 'branch'), sha: requireString(sha, 'sha') };
    const { data } = await this.request(`${base}/contents/${encodePath(path)}`, { method: 'DELETE', body: JSON.stringify(body) });
    return { commit: data.commit?.sha, path };
  }
  async pullRequest(owner, repo, title, head, base, body, approved) {
    requireApproval(approved);
    const path = repoPath(owner, repo);
    const payload = { title: requireString(title, 'title'), head: requireString(head, 'head'), base: requireString(base, 'base'), body: body || '' };
    const { data } = await this.request(`${path}/pulls`, { method: 'POST', body: JSON.stringify(payload) });
    return { number: data.number, url: data.html_url, state: data.state };
  }
}

function requireApproval(approved) {
  if (approved !== true) throw new Error('Write operation blocked. Set approved=true only after the user explicitly approves this exact change.');
}
