import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), errors=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const required=["site/index.html","site/robots.txt","site/sitemap.xml","site/llms.txt","site/og-image.png","site/logo.svg","server.json"];
for(const f of required) if(!fs.existsSync(path.join(root,f))) errors.push(`Missing: ${f}`);
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
const html=read("site/index.html"), robots=read("site/robots.txt"), sitemap=read("site/sitemap.xml"), llms=read("site/llms.txt");
const server=JSON.parse(read("server.json")), pkg=JSON.parse(read("package.json"));
const checks=[
["canonical URL",/<link rel="canonical" href="https:\/\/jeet1511\.github\.io\/chat2git\/">/.test(html)],
["page title",/<title>[^<]{20,80}<\/title>/.test(html)],
["meta description",/<meta name="description" content="[^"]{70,180}">/.test(html)],
["Open Graph metadata",/<meta property="og:title"/.test(html)&&/<meta property="og:image"/.test(html)],
["JSON-LD",/application\/ld\+json/.test(html)],
["robots sitemap",/Sitemap: https:\/\/jeet1511\.github\.io\/chat2git\/sitemap\.xml/.test(robots)],
["sitemap URL",/https:\/\/jeet1511\.github\.io\/chat2git\//.test(sitemap)],
["llms project identity",/https:\/\/github\.com\/jeet1511\/chat2git/.test(llms)],
["MCP namespace",server.name==="io.github.jeet1511/chat2git"],
["package repository",pkg.repository?.url==="https://github.com/jeet1511/chat2git.git"]
];
for(const [label,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${label}`);if(!ok)errors.push(label);}
const publicText=[html,robots,sitemap,llms,read("server.json"),read("README.md")].join("\n");
if(/YOUR-USERNAME|YOUR_USERNAME|your-repo-url/i.test(publicText))errors.push("Unresolved placeholder in public metadata");
if(!fs.existsSync(path.join(root,"site/.nojekyll")))errors.push("Missing site/.nojekyll");
if(errors.length){console.error("\nAudit failed:\n"+errors.join("\n"));process.exit(1);}
console.log(`\nSEO metadata audit passed (${checks.length} checks). Live indexing and rankings are not tested.`);
