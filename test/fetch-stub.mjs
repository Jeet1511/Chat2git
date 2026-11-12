// Preloaded by tests: replaces GitHub API calls with canned responses so tests never touch the network.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://api.github.com/')) return realFetch(url, options);
  const body = {
    owner: { login: 'a' }, name: 'b', full_name: 'a/b', default_branch: 'main', private: false,
    object: { sha: 'abc' }, commit: { sha: 'abc' }, content: { path: 'x.txt' }, tree: [], truncated: false,
    ref: 'refs/heads/x'
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
