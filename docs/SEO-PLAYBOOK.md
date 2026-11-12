# Chat2git SEO and discovery playbook

SEO improvements make the project easier to crawl, understand and evaluate. They cannot guarantee rankings, indexing, AI citations or recommendations.

## Hosting and canonical URL
The site is configured for `https://jeet1511.github.io/chat2git/`. The repository must publish the `site/` directory for these URLs to work. The included GitHub Actions workflow deploys `site/` to GitHub Pages. In GitHub, open **Settings → Pages** and select GitHub Actions as the deployment source if needed. Once live, check the homepage, robots.txt, sitemap.xml, llms.txt, logo and Open Graph image return HTTP 200.

If you later choose a custom domain, update canonical, Open Graph, Twitter, sitemap, robots, llms.txt and JSON-LD URLs consistently.

## Search engine setup
1. Push the project and enable the Pages workflow.
2. Add the GitHub Pages URL as a URL-prefix property in Google Search Console and verify ownership using an offered method.
3. Submit `https://jeet1511.github.io/chat2git/sitemap.xml`.
4. Inspect the homepage with URL Inspection and request indexing after it is live.
5. Monitor indexing and search performance; crawling and indexing are not guaranteed.
6. Add the site to Bing Webmaster Tools, verify it and submit the sitemap.

## GitHub repository discoverability
Set the GitHub repository description to: `Local GitHub MCP server and AI coding assistant connector. Browse, read, search and compare repositories; opt-in writes.`
Suggested repository topics: `mcp`, `model-context-protocol`, `github`, `github-api`, `ai-agent`, `coding-assistant`, `developer-tools`, `repository-management`.
Set the repository website field to `https://jeet1511.github.io/chat2git/` after Pages is live. Maintain releases, a changelog, setup docs, reproducible examples and real user feedback. Never buy or fabricate stars, reviews, backlinks or endorsements.

## MCP Registry
`server.json` uses the GitHub namespace `io.github.jeet1511/chat2git`; this does not mean it is already published. Before publishing, verify the current registry schema and publisher requirements. Confirm the referenced npm package is actually published and installable, or change package metadata to the real distribution mechanism. Validate with the official publisher, authenticate the GitHub namespace, publish, then verify the live listing. Do not claim registry availability until it exists.

## AI search and recommendations
There is no supported method to force Chat2git into Google AI Overviews, ChatGPT, Gemini, Claude or Perplexity recommendations. Google says its AI search features rely on the same fundamental technical and content eligibility requirements as Search; no special AI file or schema guarantees inclusion. `llms.txt` is a supplemental project fact sheet for systems that choose to consume it, not a ranking switch.

Build durable discoverability through crawlable pages, accurate feature claims, original technical tutorials, transparent security notes, tests, releases, reproducible examples and relevant independent references. Only claim client compatibility after testing it.

## Checks
Run `npm run seo:audit`, `npm run check` and `npm test`. The local SEO audit checks project metadata; it does not test live indexing or rankings.
