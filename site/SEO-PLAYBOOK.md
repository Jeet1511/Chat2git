# Chat2git search visibility and distribution plan

This plan is based on the current product (local GitHub bridge, MCP stdio server, local dashboard/API, read-first defaults) and official search/discovery documentation reviewed on 1 November 2026. It is an implementation and launch checklist, not a ranking guarantee.

## 1. Positioning and search intent

Primary positioning: **local GitHub MCP server for AI coding assistants**.

Prioritize these intent clusters naturally in page titles, headings, documentation and examples:

- GitHub MCP server / GitHub MCP connector
- MCP server for GitHub repositories
- AI coding assistant GitHub integration
- local GitHub bridge for AI agents
- inspect, read, search and compare GitHub repositories with MCP
- safe GitHub write operations with opt-in and per-call approval

Do not repeat keyword lists in body copy. Explain the product's actual differentiators: local-only execution, MCP stdio, a dashboard and HTTP API, read-first defaults, and explicit write gating. Do not claim compatibility with clients that have not been tested.

## 2. Technical SEO completed in this package

- Reworked the homepage title, meta description, H1 and visible copy around the actual product category and user tasks.
- Added useful explanatory sections for capabilities, operating flow and security model.
- Kept important content in crawlable HTML rather than relying on client-side rendering.
- Added/retained canonical, Open Graph, Twitter card, favicon and SoftwareApplication/WebSite JSON-LD metadata.
- Kept robots.txt, sitemap.xml and llms.txt. `llms.txt` is optional distribution context, not a Google ranking lever.
- Removed FAQPage JSON-LD rather than implying FAQ rich results are a realistic ranking tactic. The FAQs remain visible and useful to visitors.
- Added `scripts/seo-audit.mjs` to flag deployment placeholders and core on-page metadata regressions.

## 3. Required before deployment

1. Replace every `jeet1511` placeholder in `site/index.html`, `site/robots.txt`, `site/sitemap.xml`, `site/llms.txt` and `server.json` with the real GitHub owner and public website URL.
2. Confirm that the GitHub repository is public and that the Pages/custom-domain URL is correct. Do not publish a canonical URL that redirects elsewhere or points to a non-existent repository.
3. Ensure the deployed site serves `site/` at the intended root, with `index.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, logo assets and `og-image.png` reachable over HTTPS.
4. Run `node scripts/seo-audit.mjs --strict`. Fix all blockers.
5. Validate JSON-LD with Schema.org Validator and test the deployed URL with Google Rich Results Test / URL Inspection. Structured data must match visible page content.
6. Verify that the page returns HTTP 200, is not blocked by robots/noindex, has a self-consistent canonical, and that sitemap URLs return 200.

## 4. Search engine submission and measurement

- Add the verified domain/property in Google Search Console. Submit `/sitemap.xml`; inspect the homepage URL and request indexing after deployment.
- Add the site in Bing Webmaster Tools. Import verified Search Console data where available, submit the sitemap and enable IndexNow only if a reliable publishing workflow can send updates.
- Check indexing, canonical selection, crawl errors, search queries, impressions, clicks and CTR weekly for the first month, then monthly.
- Record a baseline before changing titles or page copy again. Avoid reacting to daily ranking fluctuations.
- Search Console reporting is the source of truth for Google organic performance; no third-party tool can promise or reveal Google's internal ranking position for every user.

## 5. Distribution that can create real discovery

Prioritize legitimate developer discovery surfaces:

- Publish and maintain the GitHub repository with a clear README, release notes, screenshots, reproducible setup steps, issue templates and a permissive license.
- Add accurate GitHub repository topics such as `mcp`, `model-context-protocol`, `github-api`, `ai-agents`, `developer-tools`, and `github-integration` (only where they describe the code).
- Publish the MCP server to the official MCP Registry after correcting `server.json`, verifying package identity/version and meeting the registry's current publisher requirements.
- Publish to npm only after deciding to support a stable package installation path, testing a clean install, and ensuring the package contents exclude secrets and local state. `private: false` alone does not publish a package.
- Write genuinely useful technical articles: a reproducible MCP GitHub setup tutorial, a security model walkthrough, and a comparison of local stdio vs hosted remote MCP. Link to the project when it is directly relevant; disclose limitations and avoid fabricated benchmarks.
- Share releases and technical demonstrations in relevant developer communities only where self-promotion is allowed. Answer real questions; do not mass-post, buy links, create fake reviews, or use automated backlink schemes.

## 6. AI answer and recommendation visibility

There is no reliable switch that puts a project at the top of ChatGPT, Gemini, Claude, Perplexity or Google's AI answers. Improve the chance of accurate discovery by making the public facts easy to verify:

- Keep one consistent project name, repository URL, website URL, version and feature description across README, site, registry metadata and release notes.
- Explain precisely what the tool does and does not do. State that it is local-only and does not provide a hosted remote endpoint.
- Provide complete, crawlable setup instructions, actual configuration examples, tool names, permissions and tested client compatibility.
- Maintain release history, changelog, known limitations and issue responses so third parties can independently evaluate it.
- Treat `llms.txt` as optional supplementary documentation. Google's current guidance says it is not used as a special ranking signal for Search or AI features.

## 7. Content roadmap (quality over page count)

Build these only when each page can contain tested, original detail:

1. **Getting started:** install, configure a token, launch dashboard, connect an MCP client, troubleshoot common errors.
2. **Security model:** loopback binding, Host/Origin checks, API key handling, token flow, read/write capability gating, approval semantics and threat model.
3. **MCP tools reference:** each tool's inputs, outputs, permission needs, limits and examples.
4. **Compatibility matrix:** clients actually tested, versions, platform, connection mode and known issues.
5. **Architecture:** local HTTP server, MCP stdio server, GitHub API boundary and data flow.

Do not create dozens of near-duplicate keyword landing pages. One excellent page per distinct user need is preferable.

## 8. Current limitations / open dependencies

- The real GitHub owner and production website URL were not supplied; `jeet1511` placeholders are intentionally not guessed.
- No public deployment, Search Console, Bing Webmaster Tools, npm or MCP Registry account was accessed from this task.
- No indexing, ranking, traffic or AI citation outcome can be claimed until the site is deployed and measured.
- The project is version 0.1.0; live GitHub behavior and specific client compatibility still require real-world verification.

## Official references

- Google Search Central, AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
- Google Search Central, generative AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search Central, SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Central, build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Official MCP Registry documentation: https://registry.modelcontextprotocol.io/docs
- Official MCP Registry API reference: https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/api/official-registry-api.md
