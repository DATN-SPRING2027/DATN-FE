import { setRequestLocale } from "next-intl/server";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";
import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectTeamEdit");
}

export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; teamId: string }>;
}) {
  const { locale, projectId, teamId } = await params;
  setRequestLocale(locale);
  return <TeamsWorkspace projectId={projectId} teamId={teamId} mode="edit" />;
}
