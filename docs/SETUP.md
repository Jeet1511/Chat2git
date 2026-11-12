# GitHub token setup

This release uses a fine-grained GitHub Personal Access Token (PAT), not an embedded OAuth application.

1. Open https://github.com/settings/personal-access-tokens/new
2. Create a fine-grained token.
3. Choose **Only select repositories** and select the repositories Chat2git should access.
4. Grant minimum permissions:
   - Metadata: Read-only
   - Contents: Read-only for browsing; Read and write for file/branch changes
   - Pull requests: Read and write only if creating PRs
5. Generate the token and copy it once.
6. Paste it into `.env` as `GITHUB_TOKEN=...`.
7. Restart the bridge processes.

Do not paste the token into Xenochat prompts or commit `.env` to Git. `.env` is ignored by `.gitignore`.
