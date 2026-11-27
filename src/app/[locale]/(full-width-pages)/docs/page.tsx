import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import DeveloperDocsView from "@/components/docs/DeveloperDocsView";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildAppPageMetadata(params, "developerDocs", {
    descriptionKey: "developerDocsDescription",
  });
}

export default async function DeveloperDocsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DeveloperDocsView />;
}
