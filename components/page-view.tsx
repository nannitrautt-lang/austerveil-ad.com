import Link from "next/link";
import {
  allProjects,
  displayTitle,
  getHeroImage,
  type SitePage,
  urlForPage,
} from "@/lib/site";

const categoryLinks = [
  ["All Projects", "/projects"],
  ["Office", "/office-projects"],
  ["Retail / F&B", "/retailfb-projects"],
  ["Residential", "/residential-projects"],
  ["Environmental Engineering", "/environmental-engineering-projects-c1ftm"],
];

function cleanParagraph(paragraph: string) {
  return paragraph
    .replace(/^Architecture Design - Consulting Serivces\s*/i, "")
    .replace(/^Architecture Projects\s*/i, "")
    .replace(/^About Us - Sustainable Architecture\s*/i, "")
    .trim();
}

function Gallery({ page }: { page: SitePage }) {
  if (!page.images.length) return null;

  return (
    <section className="gallery" aria-label={`${page.title} images`}>
      {page.images.slice(0, page.kind === "project" ? 12 : 10).map((image, index) => (
        <figure key={`${image.src}-${index}`} className={index === 0 ? "feature-image" : ""}>
          <img src={image.src} alt={image.alt} loading={index === 0 ? "eager" : "lazy"} />
        </figure>
      ))}
    </section>
  );
}

function isChineseRoute(slug: string) {
  return slug.includes("chinese") || slug.endsWith("-cn");
}

function ProjectGrid({ page }: { page: SitePage }) {
  const wantsChinese = isChineseRoute(page.slug);
  const projectsForLanguage = allProjects.filter(
    (project) => isChineseRoute(project.slug) === wantsChinese,
  );
  const bySlug = new Map(projectsForLanguage.map((project) => [project.slug, project]));
  const linkedProjects =
    page.links
      ?.map((slug) => bySlug.get(slug))
      .filter((project): project is SitePage => Boolean(project)) ?? [];
  const projects = linkedProjects.length ? linkedProjects : projectsForLanguage;

  return (
    <section className="project-grid" aria-label="Project archive">
      {projects.map((project) => {
        const image = getHeroImage(project);
        return (
          <Link key={project.slug} href={urlForPage(project.slug)} className="project-card">
            {image ? <img src={image.src} alt={project.title} loading="lazy" /> : null}
            <span>{project.title.replace(/\s+-\s+.*$/, "")}</span>
          </Link>
        );
      })}
    </section>
  );
}

function StudioLinks() {
  return (
    <nav className="subnav" aria-label="Studio pages">
      <Link href="/studio">Team</Link>
      <Link href="/services--skills">Services</Link>
      <Link href="/careers">Careers</Link>
      <Link href="/partners">Partners</Link>
    </nav>
  );
}

function ContactPanel() {
  return (
    <section className="contact-panel" aria-label="Contact information">
      <h2>Contact Information</h2>
      <p>aad</p>
      <p>433 YuYuan Road, Jing'an District, Shanghai 200040</p>
      <p>89 Queensway, Admiralty Lippo Center, T2, S406, Hong Kong</p>
      <p>
        <a href="mailto:contact@austerveil-ad.com">contact@austerveil-ad.com</a>
      </p>
      <p>
        <a href="tel:+8618221786802">+86 182 2178 6802</a>
      </p>
    </section>
  );
}

export function PageView({ page }: { page: SitePage }) {
  const hero = getHeroImage(page);
  const isProjectListing =
    page.slug === "projects" ||
    page.slug === "projects-chinese" ||
    page.slug.endsWith("-projects") ||
    page.slug === "environmental-engineering-projects-c1ftm";
  const isStudioPage = ["studio", "services--skills", "careers", "partners"].includes(page.slug);
  const isContact = page.slug === "form" || page.slug === "contact-chinese";

  return (
    <main>
      <section className="page-hero">
        <div className="hero-text">
          <p className="eyebrow">
            {page.kind === "project" ? "Project" : "Austerveil Architecture & Design"}
          </p>
          <h1>{displayTitle(page)}</h1>
          {page.description ? <p className="lede">{page.description}</p> : null}
        </div>
        {hero ? (
          <figure className="hero-media">
            <img src={hero.src} alt={hero.alt || page.title} />
          </figure>
        ) : null}
      </section>

      {isStudioPage ? <StudioLinks /> : null}

      {isProjectListing ? (
        <nav className="subnav" aria-label="Project categories">
          {categoryLinks.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="content-columns">
        <div>
          {page.paragraphs.map((paragraph, index) => {
            const cleaned = cleanParagraph(paragraph);
            return cleaned ? <p key={index}>{cleaned}</p> : null;
          })}
        </div>
        {isContact ? <ContactPanel /> : null}
      </section>

      {isProjectListing ? <ProjectGrid page={page} /> : <Gallery page={page} />}
    </main>
  );
}
