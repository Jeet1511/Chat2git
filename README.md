<p align="center">
  <img src="public/logo.svg" width="128" height="128" alt="Chat2git logo">
</p>

<h1 align="center">Chat2git</h1>

<p align="center">
  Let AI assistants explore and change your GitHub repositories, safely.<br>
  A small local bridge with a dashboard, an HTTP API, and an MCP server.
</p>

---

## What it does

Chat2git is a **local GitHub MCP server and AI coding assistant connector**. It sits between an MCP-compatible assistant and the GitHub API so the assistant can inspect repository metadata and file trees, read selected files, review branches and commits, compare refs, and search code. Optional repository changes are disabled by default and require local opt-in plus per-operation approval.

- **Browse:** repository metadata, file trees, branches, commits, and comparisons. Public repositories need no token.
- **Read:** single text files, capped by a size limit (`MAX_FILE_BYTES`, default 1 MiB).
- **Search:** code search in a repository (requires a token).
- **Change (opt-in):** create branches, write or delete files, and open pull requests.
- **Local only:** the service listens on `127.0.0.1`, and your GitHub token never leaves it.

It has no dependencies beyond Node.js 20 or later.

## Quick start

```bash
git clone https://github.com/jeet1511/chat2git.git
cd chat2git
cp .env.example .env     # optional: add a GitHub token, choose a key
npm start
```

Open the dashboard at `http://127.0.0.1:4317`, paste a GitHub repository URL, and click **Inspect repository**.

If you don't set `BRIDGE_API_KEY`, Chat2git generates a random key at startup and prints it to the console. Set your own key in `.env` if you want it to stay the same across restarts.

## Configuration

Settings live in `.env`. See `.env.example` for all options.

| Variable | Default | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | empty | Fine-grained GitHub token. Required for code search, private repositories, and writes. |
| `HOST` | `127.0.0.1` | Bind address. Only `127.0.0.1` and `localhost` are accepted. |
| `PORT` | `4317` | Dashboard and API port. |
| `BRIDGE_API_KEY` | empty | Key required on every `/api/*` request. Generated if empty. |
| `CHAT2GIT_ALLOW_WRITES` | `false` | Set to `true` to enable branch, file, delete, and pull-request operations. |
| `MAX_FILE_BYTES` | `1048576` | Largest file the read tool will return. |

### GitHub token

Create a fine-grained personal access token at <https://github.com/settings/personal-access-tokens/new> and limit it to the repositories you need:

- **Contents:** Read (Read and write if you enable writes)
- **Pull requests:** Read and write (only if you want pull requests)
- **Metadata:** Read (included by default)

Never commit `.env`. It is listed in `.gitignore`.

## Connecting an AI assistant (MCP)

Chat2git includes an MCP server over stdio. Copy `chat2git.mcp.example.json`, replace the path with your installation's absolute path, and add it to your MCP client's configuration:

```json
{
  "mcpServers": {
    "chat2git": {
      "command": "node",
      "args": ["C:/path/to/chat2git/src/mcp-server.mjs"]
    }
  }
}
```

### Tools

| Tool | Writes? | Description |
|---|---|---|
| `github_repo_info` | No | Repository metadata. |
| `github_repo_tree` | No | Paths and metadata, without file contents. |
| `github_read_file` | No | Read one text file. |
| `github_branches` | No | Branches and their latest commit SHAs. |
| `github_commits` | No | Recent commits on a branch. |
| `github_search_code` | No | Code search (needs a token). |
| `github_compare` | No | Compare two branches, tags, or commits. |
| `github_create_branch` | Yes | Create a branch. |
| `github_write_file` | Yes | Create or update a file on a branch. |
| `github_delete_file` | Yes | Delete a file (needs the file's SHA). |
| `github_create_pull_request` | Yes | Open a pull request. |

When writes are disabled, the four write tools are not listed.

## HTTP API

All `/api/*` routes need the header `X-Chat2git-Key: <key>`, except `GET /api/health`. Repository routes accept `owner` and `repo`, a GitHub `url`, or the repository selected in the dashboard.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Service status (no key needed). |
| GET | `/api/status` | Connected repository and capabilities. |
| POST | `/api/connect` | Select a repository (`{"url": "..."}`). |
| POST | `/api/disconnect` | Clear the selected repository. |
| GET | `/api/repo` | Repository metadata. |
| GET | `/api/tree?ref=` | File tree. |
| GET | `/api/file?path=&ref=` | Read one file. |
| GET | `/api/branches` | Branches. |
| GET | `/api/commits?branch=&limit=` | Recent commits. |
| GET | `/api/search?q=` | Code search. |
| GET | `/api/compare?base=&head=` | Compare two refs. |
| POST | `/api/branch` | Create a branch (writes). |
| POST | `/api/file` | Create or update a file (writes). |
| DELETE | `/api/file` | Delete a file (writes). |
| POST | `/api/pull-request` | Open a pull request (writes). |

## Security model

Chat2git is designed for a single user on their own machine.

- **Local only.** It refuses to bind to any address other than loopback. Requests with a foreign `Host` or `Origin` header are rejected, which blocks DNS-rebinding and cross-site attacks.
- **Key required.** Every API request needs the key. The dashboard receives it automatically, and only from the local page.
- **Writes off by default.** Writes need `CHAT2GIT_ALLOW_WRITES=true` in `.env`. The AI assistant cannot change this setting.
- **Explicit approval flag.** Each write also requires `"approved": true`. That flag is set by the caller, not by a person, so enable writes only if you accept the assistant making changes. Review every change in GitHub before merging.
- **Safe paths.** Owner, repository, and file path values are validated before they reach GitHub, which blocks path traversal.
- **No secrets to the model.** The token is used only server-side and is never returned by any route.

Do not expose Chat2git to a LAN or the internet. It has no TLS and no user accounts.

## Development

```bash
npm run check   # syntax check
npm test        # unit and integration tests (no network access needed)
```

The tests stub the GitHub API, so they never touch GitHub.

## Project layout

```
public/            dashboard (HTML, CSS, JS, logo)
src/server.mjs     local HTTP server and API
src/mcp-server.mjs MCP stdio server
src/github.mjs     GitHub client with validation
src/config.mjs     shared settings
test/              test suite
docs/SETUP.md      GitHub token setup guide
```

## Website and discovery

The project landing page and its search-discovery assets are maintained in [`site/`](site/). See [`site/SEO-PLAYBOOK.md`](site/SEO-PLAYBOOK.md) for deployment, Search Console, MCP Registry and responsible distribution steps. Before publishing, replace the `jeet1511` placeholders with the real repository owner and website URL. Run `npm run seo:audit` to check the metadata; use `npm run seo:audit -- --strict` as a release gate.

## Status

Early version (0.1.0). Public repository inspection and the core GitHub operations are implemented and covered by tests against a stubbed GitHub API. Live behavior against GitHub.com, and integration with specific AI assistants such as Xenochat, still need to be verified on your machine.

## License

See [LICENSE](LICENSE).
