import ProjectDetail from "@/components/projects/ProjectDetail";
import { setRequestLocale } from "next-intl/server";
import { teamFixturePreviewEnabled } from "@/lib/teams-development";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectOverview");
}

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ teamPreview?: string }>;
}) {
  const [{ locale, projectId }, { teamPreview }] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(locale);
  const fixturePreview = teamFixturePreviewEnabled(teamPreview);
  return (
    <ProjectDetail
      projectId={projectId}
      initialTab="overview"
      showTeams={false}
      teamMode={fixturePreview ? "fixture" : "api"}
    />
  );
}
