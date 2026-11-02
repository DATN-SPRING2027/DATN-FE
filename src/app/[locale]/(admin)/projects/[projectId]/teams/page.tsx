import { setRequestLocale } from "next-intl/server";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";
import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectTeams");
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <TeamsWorkspace projectId={projectId} />;
}
