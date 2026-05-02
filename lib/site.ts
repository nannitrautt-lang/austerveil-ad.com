import siteData from "@/data/site-data.json";

export type SiteImage = {
  src: string;
  alt: string;
};

export type SitePage = {
  slug: string;
  title: string;
  description: string;
  kind: "page" | "section" | "project";
  paragraphs: string[];
  images: SiteImage[];
  links?: string[];
};

export const pages = siteData.pages as SitePage[];

export const allProjects = pages.filter((page) => page.kind === "project");

export const mainPages = pages.filter((page) =>
  ["", "about", "studio", "projects", "news", "form"].includes(page.slug),
);

export function getPage(slug: string) {
  return pages.find((page) => page.slug === slug);
}

export function getHeroImage(page: SitePage) {
  return page.images[0] ?? allProjects.find((project) => project.images[0])?.images[0];
}

export function urlForPage(slug: string) {
  return slug ? `/${slug}` : "/";
}

export function displayTitle(page: SitePage) {
  return page.slug === "" ? "austerveil architecture & design" : page.title;
}
