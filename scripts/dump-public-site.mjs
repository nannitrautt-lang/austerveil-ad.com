import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const startUrl = new URL(process.argv[2] ?? "https://www.austerveil-ad.com/");
const outDir = path.resolve(process.argv[3] ?? "wix-dump");
const maxPages = Number(process.env.MAX_PAGES ?? 80);
const maxAssets = Number(process.env.MAX_ASSETS ?? 1200);
const fetchTimeoutMs = Number(process.env.FETCH_TIMEOUT_MS ?? 15000);

const userAgent =
  "Mozilla/5.0 (compatible; AusterveilMigrationDump/1.0; +https://www.austerveil-ad.com/)";

const pageQueue = [startUrl];
const seenPages = new Set();
const seenAssets = new Set();
const manifest = {
  startedAt: new Date().toISOString(),
  startUrl: startUrl.href,
  pages: [],
  assets: [],
  skipped: [],
  errors: [],
};

const assetHosts = [
  "static.wixstatic.com",
  "static.parastorage.com",
  "static.wixstatic.com",
  "video.wixstatic.com",
  "static.filesusr.com",
  "static.wixstatic.com",
  "fonts.gstatic.com",
  "fonts.googleapis.com",
];

function isSameSite(url) {
  return url.hostname === startUrl.hostname;
}

function isAllowedAsset(url) {
  return isSameSite(url) || assetHosts.some((host) => url.hostname === host);
}

function withoutHash(url) {
  const copy = new URL(url.href);
  copy.hash = "";
  return copy;
}

function safeSegment(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 160);
}

function extensionFromContentType(contentType) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "text/html") return ".html";
  if (type === "text/css") return ".css";
  if (type === "application/javascript" || type === "text/javascript") return ".js";
  if (type === "application/json") return ".json";
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/svg+xml") return ".svg";
  if (type === "font/woff2") return ".woff2";
  if (type === "font/woff") return ".woff";
  if (type === "video/mp4") return ".mp4";
  return "";
}

function outputPathForUrl(url, contentType = "") {
  const host = safeSegment(url.hostname);
  const pathname = url.pathname.endsWith("/")
    ? `${url.pathname}index`
    : url.pathname;
  const parsed = path.parse(pathname);
  const ext = parsed.ext || extensionFromContentType(contentType);
  const base = safeSegment(parsed.name || "index");
  const query = url.search ? `__q_${safeSegment(url.search.slice(1))}` : "";
  const dir = path.join(outDir, host, ...pathname.split("/").slice(1, -1).map(safeSegment));
  return path.join(dir, `${base}${query}${ext || ".bin"}`);
}

function extractUrls(text, baseUrl) {
  const results = [];
  const patterns = [
    /\b(?:href|src|poster|action)=["']([^"']+)["']/gi,
    /\b(?:href|src|poster|action)=([^\s"'<>]+)/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      results.push(match[1]);
    }
  }

  const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
  let srcsetMatch;
  while ((srcsetMatch = srcsetPattern.exec(text))) {
    for (const candidate of srcsetMatch[1].split(",")) {
      const [candidateUrl] = candidate.trim().split(/\s+/);
      if (candidateUrl) results.push(candidateUrl);
    }
  }

  return results
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((raw) => !raw.startsWith("data:") && !raw.startsWith("blob:"))
    .filter((raw) => !raw.startsWith("mailto:") && !raw.startsWith("tel:"))
    .map((raw) => {
      try {
        return withoutHash(new URL(raw, baseUrl));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function fetchUrl(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(fetchTimeoutMs),
    headers: { "user-agent": userAgent },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, contentType, buffer };
}

async function saveBuffer(url, buffer, contentType, kind) {
  const filePath = outputPathForUrl(url, contentType);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  const entry = {
    url: url.href,
    file: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
    contentType,
    bytes: buffer.byteLength,
    status: 200,
  };
  manifest[kind].push(entry);
  return filePath;
}

async function addExistingIfPresent(url, contentType, kind) {
  const filePath = outputPathForUrl(url, contentType);
  try {
    const fileStat = await stat(filePath);
    const entry = {
      url: url.href,
      file: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
      contentType,
      bytes: fileStat.size,
      status: 200,
      cached: true,
    };
    manifest[kind].push(entry);
    return { filePath, entry };
  } catch {
    return null;
  }
}

async function downloadAsset(url) {
  const normalized = withoutHash(url).href;
  if (seenAssets.has(normalized) || manifest.assets.length >= maxAssets) return;
  seenAssets.add(normalized);

  try {
    const existing = await addExistingIfPresent(url, "", "assets");
    if (existing) return;
    const { response, contentType, buffer } = await fetchUrl(url);
    if (!response.ok) {
      manifest.errors.push({ url: url.href, status: response.status, kind: "asset" });
      return;
    }

    const filePath = await saveBuffer(url, buffer, contentType, "assets");
    if (contentType.includes("text/css")) {
      const text = buffer.toString("utf8");
      for (const nestedUrl of extractUrls(text, url)) {
        if (isAllowedAsset(nestedUrl)) await downloadAsset(nestedUrl);
      }
    }
    console.log(`asset ${response.status} ${url.href} -> ${path.relative(process.cwd(), filePath)}`);
  } catch (error) {
    manifest.errors.push({ url: url.href, error: error.message, kind: "asset" });
  }
}

async function crawlPage(url) {
  const normalized = withoutHash(url).href;
  if (seenPages.has(normalized) || seenPages.size >= maxPages) return;
  seenPages.add(normalized);

  try {
    let response;
    let contentType;
    let buffer;
    const existing = await addExistingIfPresent(url, "text/html", "pages");
    if (existing) {
      contentType = existing.entry.contentType;
      buffer = await readFile(existing.filePath);
    } else {
      const fetched = await fetchUrl(url);
      response = fetched.response;
      contentType = fetched.contentType;
      buffer = fetched.buffer;
      if (!response.ok) {
        manifest.errors.push({ url: url.href, status: response.status, kind: "page" });
        return;
      }

      const filePath = await saveBuffer(url, buffer, contentType || "text/html", "pages");
      console.log(`page ${response.status} ${url.href} -> ${path.relative(process.cwd(), filePath)}`);
    }

    const textTypes = ["text/html", "text/css", "application/javascript", "text/javascript"];
    if (!textTypes.some((type) => contentType.includes(type))) return;

    const text = buffer.toString("utf8");
    for (const foundUrl of extractUrls(text, url)) {
      if (isSameSite(foundUrl)) {
        const looksLikePage =
          !path.extname(foundUrl.pathname) ||
          foundUrl.pathname.endsWith("/") ||
          foundUrl.pathname.endsWith(".html");
        if (looksLikePage && !seenPages.has(foundUrl.href)) {
          pageQueue.push(foundUrl);
        } else if (isAllowedAsset(foundUrl)) {
          await downloadAsset(foundUrl);
        }
      } else if (isAllowedAsset(foundUrl)) {
        await downloadAsset(foundUrl);
      } else {
        manifest.skipped.push({ url: foundUrl.href, reason: "external host" });
      }
    }
  } catch (error) {
    manifest.errors.push({ url: url.href, error: error.message, kind: "page" });
  }
}

await mkdir(outDir, { recursive: true });

while (pageQueue.length > 0 && seenPages.size < maxPages) {
  const next = pageQueue.shift();
  await crawlPage(next);
}

manifest.finishedAt = new Date().toISOString();
manifest.pageCount = manifest.pages.length;
manifest.assetCount = manifest.assets.length;
manifest.errorCount = manifest.errors.length;
manifest.skippedCount = manifest.skipped.length;

await writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(
  `done pages=${manifest.pageCount} assets=${manifest.assetCount} errors=${manifest.errorCount} skipped=${manifest.skippedCount}`,
);
