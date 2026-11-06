import KnowledgeUniverseWorkspace from "@/components/knowledge-universe/KnowledgeUniverseWorkspace";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "knowledge");
}

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KnowledgeUniverseWorkspace />;
}
