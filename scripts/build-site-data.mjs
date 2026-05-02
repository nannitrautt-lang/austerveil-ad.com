import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const pageDir = path.join(root, "wix-dump", "www.austerveil-ad.com");
const manifestPath = path.join(root, "wix-dump", "manifest.json");
const publicAssetRoot = path.join(root, "public", "migrated-assets");
const dataDir = path.join(root, "data");

const projectSlugs = new Set([
  "centralpod-new",
  "wine-connection",
  "shenbao-building-boutique-offices",
  "seesaw-reel",
  "kafe-kitchen",
  "zhishangyuan",
  "project-wine",
  "baoshan-fudan-creative-park",
  "xingyuan-boutique-offices",
  "fishtank-cafe",
  "riverfront-flower-mill",
  "seesaw-cafe",
  "karma",
  "jiangyuan-boutique-offices",
  "boutique-205",
  "grisution",
  "yy200-offices",
  "seesaw-coffee-training-academy",
  "yanan-circus-offices",
  "rambouillet",
  "the-pangolins",
]);

const nonProjectSlugs = new Set([
  "",
  "about",
  "about-chinese",
  "ad-publication",
  "ad-publication-chinese",
  "blank",
  "careers",
  "careers-chinese",
  "cbn-weekly",
  "cbn-weekly-chinese",
  "china-daily",
  "china-daily-chinese",
  "china-life-chinese",
  "city-life",
  "contact-chinese",
  "contact-hong-kong",
  "contact-hong-kong-chinese",
  "environmental-engineering-projects-c1ftm",
  "environmental-engineering-projects-c1s5s",
  "form",
  "home-chinese",
  "new-chinese",
  "news",
  "office-projects",
  "office-projects-chinese",
  "orange-a3",
  "orange-a3-chinese",
  "partners",
  "partners-chinese",
  "projects",
  "projects-chinese",
  "projects-re-order",
  "residential-projects",
  "residential-projects-chinese",
  "retail-projects-chinese",
  "retailfb-projects",
  "services--skills",
  "services--skills-chinese",
  "studio",
  "studio-chinese",
  "vta",
  "vta-chinese",
]);

const sectionSlugs = new Set([
  "about",
  "studio",
  "projects",
  "news",
  "form",
  "services--skills",
  "careers",
  "partners",
  "vta",
  "office-projects",
  "retailfb-projects",
  "residential-projects",
  "environmental-engineering-projects-c1ftm",
  "home-chinese",
  "about-chinese",
  "studio-chinese",
  "projects-chinese",
  "new-chinese",
  "contact-chinese",
  "contact-hong-kong",
  "contact-hong-kong-chinese",
  "office-projects-chinese",
  "residential-projects-chinese",
  "retail-projects-chinese",
  "services--skills-chinese",
  "vta-chinese",
]);

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function slugFromFile(file) {
  if (file === "index.html") return "";
  return file.replace(/\.html$/, "");
}

function titleFromHtml(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return decodeHtml(match?.[1] ?? fallback).replace(/\s*\|\s*a_a&d/i, "").trim();
}

function descriptionFromHtml(html) {
  const match = html.match(/<meta name="description" content="([^"]*)"/i);
  return decodeHtml(match?.[1] ?? "").trim();
}

function extractBodyText(html) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  return decodeHtml(withoutScripts.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/^-->\s*/, "")
    .trim();
}

function cleanupText(text, pageTitle) {
  const titleParts = [
    pageTitle,
    "top of page",
    "energy rationalization | architecture & design | a_a&d",
    "EN 中文 About Studio Projects News Contact More Use tab to navigate through the menu items.",
    "© 2015 austerveil_architecture & design bottom of page",
  ];

  let cleaned = text;
  for (const part of titleParts) {
    cleaned = cleaned.replace(part, " ");
  }
  return cleaned
    .replace(/-->/g, " ")
    .replace(/\|\s*a_a&d/g, " ")
    .replace(/Â²/g, "²")
    .replace(/faÃ§ade/g, "façade")
    .replace(/RÃ©el/g, "Réel")
    .replace(/CafÃ©/g, "Café")
    .replace(/dâ€™Azur/g, "d’Azur")
    .replace(/\s+/g, " ")
    .replace(/\s+}/g, "")
    .replace(/press to zoom/g, "")
    .replace(/<< BACK/g, "")
    .trim();
}

function splitParagraphs(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const paragraphs = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > 420 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.length ? paragraphs : text ? [text] : [];
}

function extractImageUrls(html) {
  const matches = html.match(/https:\/\/static\.wixstatic\.com\/media\/[^"'\\\s<>]+/g) ?? [];
  const unique = [...new Set(matches.map((url) => decodeHtml(url)))];
  return unique.filter((url) => !url.includes("Logo-long-2024"));
}

function extractInternalSlugs(html) {
  return [
    ...new Set(
      [...html.matchAll(/https:\/\/www\.austerveil-ad\.com\/([^"'\\\s<>?#]+)/g)]
        .map((match) => decodeHtml(match[1]).replace(/^\/+|\/+$/g, ""))
        .filter(Boolean),
    ),
  ];
}

function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
  } catch {
    return "image";
  }
}

function extensionFromUrl(url) {
  const name = fileNameFromUrl(url).split("?")[0];
  const ext = path.extname(name);
  return ext || ".bin";
}

function readableTitleFromSlug(slug) {
  return slug
    ? slug
        .split("-")
        .map((word) =>
          word.length <= 3 && word === word.toLowerCase()
            ? word.toUpperCase()
            : word.charAt(0).toUpperCase() + word.slice(1),
        )
        .join(" ")
    : "Austerveil Architecture & Design";
}

function localUrlForAsset(url, manifest) {
  const asset = manifest.assets.find((item) => item.url === url);
  if (!asset) return url;
  const source = path.join(root, asset.file);
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const publicPath = path.join(publicAssetRoot, `${hash}${extensionFromUrl(url)}`).replaceAll("\\", "/");
  return { source, publicPath, url: `/${path.relative(path.join(root, "public"), publicPath).replaceAll("\\", "/")}` };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await mkdir(publicAssetRoot, { recursive: true });
await mkdir(dataDir, { recursive: true });

const files = (await readdir(pageDir)).filter((file) => file.endsWith(".html"));
const linkedProjectSlugs = new Set(projectSlugs);

for (const file of ["projects.html", "projects-chinese.html", "office-projects.html", "retailfb-projects.html", "residential-projects.html"]) {
  try {
    const html = await readFile(path.join(pageDir, file), "utf8");
    for (const match of html.matchAll(/https:\/\/www\.austerveil-ad\.com\/([^"'\\\s<>?#]+)/g)) {
      const slug = decodeHtml(match[1]).replace(/^\/+|\/+$/g, "");
      if (slug && !nonProjectSlugs.has(slug)) linkedProjectSlugs.add(slug);
    }
  } catch {
    // Optional source pages may not exist in partial dumps.
  }
}
const pages = [];
const copyJobs = new Map();

for (const file of files) {
  const slug = slugFromFile(file);
  const html = await readFile(path.join(pageDir, file), "utf8");
  const title = titleFromHtml(html, readableTitleFromSlug(slug));
  const description = descriptionFromHtml(html);
  const text = cleanupText(extractBodyText(html), title);
  const imageUrls = extractImageUrls(html);
  const links = extractInternalSlugs(html).filter((link) => link !== slug);
  const images = [];

  for (const url of imageUrls) {
    const mapped = localUrlForAsset(url, manifest);
    if (typeof mapped === "string") {
      images.push({ src: mapped, alt: fileNameFromUrl(url) });
    } else {
      copyJobs.set(mapped.source, mapped.publicPath);
      images.push({ src: mapped.url, alt: fileNameFromUrl(url) });
    }
  }

  pages.push({
    slug,
    title,
    description,
    kind: linkedProjectSlugs.has(slug) ? "project" : sectionSlugs.has(slug) ? "section" : "page",
    paragraphs: splitParagraphs(text).slice(0, projectSlugs.has(slug) ? 8 : 12),
    images: images.slice(0, projectSlugs.has(slug) ? 16 : 24),
    links,
  });
}

for (const [source, destination] of copyJobs) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

pages.sort((a, b) => {
  if (a.slug === "") return -1;
  if (b.slug === "") return 1;
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  return a.title.localeCompare(b.title);
});

await writeFile(path.join(dataDir, "site-data.json"), `${JSON.stringify({ pages }, null, 2)}\n`);
console.log(`generated ${pages.length} pages and copied ${copyJobs.size} assets`);
