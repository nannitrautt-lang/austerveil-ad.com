import { notFound } from "next/navigation";
import { PageView } from "@/components/page-view";
import { getPage } from "@/lib/site";

export default function Home() {
  const page = getPage("");
  if (!page) notFound();
  return <PageView page={page} />;
}
