import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseUrl = "https://www.austerveil-ad.com";
const outDir = path.join(root, "wix-dump");
const pageDir = path.join(outDir, "www.austerveil-ad.com");
const assetDir = path.join(outDir, "static.wixstatic.com");
const manifestPath = path.join(outDir, "manifest.json");

const userAgent =
  "Mozilla/5.0 (compatible; AusterveilMigrationDump/1.1; +https://www.austerveil-ad.com/)";

function decode(value) {
  return value.replace(/&amp;/g, "&");
}

function slugFromUrl(url) {
  const parsed = new URL(url);
  const slug = parsed.pathname.replace(/^\/+|\/+$/g, "");
  return slug || "";
}

function pagePath(slug) {
  return path.join(pageDir, slug ? `${slug}.html` : "index.html");
}

function imagePath(url) {
  const parsed = new URL(url);
  const ext = path.extname(decodeURIComponent(parsed.pathname.split("/").pop() ?? "")) || ".bin";
  const hash = createHash("sha1").update(url).digest("hex");
  return path.join(assetDir, "media-flat", `${hash}${ext}`);
}

function extractImages(html) {
  return [
    ...new Set(
      (html.match(/https:\/\/static\.wixstatic\.com\/media\/[^"'\\\s<>]+/g) ?? []).map(decode),
    ),
  ];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return {
    contentType: response.headers.get("content-type") ?? "",
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {
      startedAt: new Date().toISOString(),
      startUrl: baseUrl,
      pages: [],
      assets: [],
      skipped: [],
      errors: [],
    };
  }
}

function upsert(list, entry) {
  const index = list.findIndex((item) => item.url === entry.url);
  if (index >= 0) list[index] = { ...list[index], ...entry };
  else list.push(entry);
}

const sitemapIndex = await fetchText(`${baseUrl}/sitemap.xml`);
const sitemapUrls = [...sitemapIndex.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]));
const pageUrls = new Set();

for (const sitemapUrl of sitemapUrls) {
  const sitemap = await fetchText(sitemapUrl);
  for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const url = decode(match[1]);
    if (url.startsWith(baseUrl)) pageUrls.add(url);
  }
}

// Some project links are present in Wix's runtime model even when not prominent in the sitemap ordering.
for (const file of ["projects.html", "projects-chinese.html"]) {
  try {
    const html = await readFile(path.join(pageDir, file), "utf8");
    for (const match of html.matchAll(/https:\/\/www\.austerveil-ad\.com\/([^"'\\\s<>?#]+)/g)) {
      pageUrls.add(`${baseUrl}/${decode(match[1])}`);
    }
  } catch {
    // The sitemap is still authoritative if a local file is unavailable.
  }
}

await mkdir(pageDir, { recursive: true });
await mkdir(path.join(assetDir, "media-flat"), { recursive: true });

const manifest = await readManifest();
let pagesDownloaded = 0;
let assetsDownloaded = 0;

for (const url of [...pageUrls].sort()) {
  const slug = slugFromUrl(url);
  try {
    const html = await fetchText(url);
    const file = pagePath(slug);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
    upsert(manifest.pages, {
      url,
      file: path.relative(root, file).replaceAll("\\", "/"),
      contentType: "text/html",
      bytes: Buffer.byteLength(html),
      status: 200,
    });
    pagesDownloaded += 1;

    for (const imageUrl of extractImages(html)) {
      const imageFile = imagePath(imageUrl);
      if (!manifest.assets.some((asset) => asset.url === imageUrl)) {
        try {
          const { contentType, buffer } = await fetchBuffer(imageUrl);
          await writeFile(imageFile, buffer);
          upsert(manifest.assets, {
            url: imageUrl,
            file: path.relative(root, imageFile).replaceAll("\\", "/"),
            contentType,
            bytes: buffer.byteLength,
            status: 200,
          });
          assetsDownloaded += 1;
        } catch (error) {
          manifest.errors.push({ url: imageUrl, kind: "asset", error: error.message });
        }
      }
    }
  } catch (error) {
    manifest.errors.push({ url, kind: "page", error: error.message });
  }
}

manifest.finishedAt = new Date().toISOString();
manifest.pageCount = manifest.pages.length;
manifest.assetCount = manifest.assets.length;
manifest.errorCount = manifest.errors.length;
manifest.skippedCount = manifest.skipped.length;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `synced sitemapUrls=${pageUrls.size} pagesDownloaded=${pagesDownloaded} assetsDownloaded=${assetsDownloaded} totalPages=${manifest.pageCount} totalAssets=${manifest.assetCount}`,
);
