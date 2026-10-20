import ProjectDetail from "@/components/projects/ProjectDetail";
import { setRequestLocale } from "next-intl/server";
import {
  teamDevelopmentEnabled,
  teamFixturePreviewEnabled,
} from "@/lib/teams-development";

export default async function ProjectPage({
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
  const apiEnabled = teamDevelopmentEnabled();
  const fixturePreview = teamFixturePreviewEnabled(teamPreview);
  return (
    <ProjectDetail
      projectId={projectId}
      showTeams={apiEnabled || fixturePreview}
      teamMode={fixturePreview ? "fixture" : "api"}
    />
  );
}
