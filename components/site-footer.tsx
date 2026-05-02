import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>© 2015 austerveil_architecture & design</p>
      <div>
        <Link href="/services--skills">Services</Link>
        <Link href="/careers">Careers</Link>
        <Link href="/partners">Partners</Link>
      </div>
    </footer>
  );
}
