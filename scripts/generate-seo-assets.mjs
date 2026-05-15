import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "src/tools/toolCatalog.ts");
const distDir = path.join(root, "dist");

const siteUrl = (
  process.env.VITE_SITE_URL ?? "https://hatemecha.github.io/iHatePDF"
).replace(/\/$/, "");

const catalogSource = readFileSync(catalogPath, "utf8");
const slugs = [
  ...catalogSource.matchAll(/slug:\s*"([^"]+)"/g),
].map((match) => match[1]);

const uniqueSlugs = [...new Set(slugs)];
const lastmod = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${siteUrl}/`, changefreq: "weekly", priority: "1.0" },
  ...uniqueSlugs.map((slug) => ({
    loc: `${siteUrl}/herramientas/${slug}`,
    changefreq: "monthly",
    priority: "0.8",
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf8");
writeFileSync(path.join(distDir, "robots.txt"), robots, "utf8");
console.log(
  `Wrote sitemap.xml and robots.txt (${uniqueSlugs.length} tool URLs) for ${siteUrl}`,
);
