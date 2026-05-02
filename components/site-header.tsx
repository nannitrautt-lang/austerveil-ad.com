import Link from "next/link";
import { mainPages, urlForPage } from "@/lib/site";

const labels: Record<string, string> = {
  "": "Home",
  about: "About",
  studio: "Studio",
  projects: "Projects",
  news: "News",
  form: "Contact",
};

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Austerveil home">
        <span>energy rationalization</span>
        <strong>architecture & design | a_a&d</strong>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {mainPages.map((page) => (
          <Link key={page.slug || "home"} href={urlForPage(page.slug)}>
            {labels[page.slug] ?? page.title}
          </Link>
        ))}
        <Link href="/home-chinese">中文</Link>
      </nav>
    </header>
  );
}
