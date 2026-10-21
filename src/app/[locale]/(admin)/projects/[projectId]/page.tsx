import ProjectDetail from "@/components/projects/ProjectDetail";
import { setRequestLocale } from "next-intl/server";
import { teamFixturePreviewEnabled } from "@/lib/teams-development";

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
  const fixturePreview = teamFixturePreviewEnabled(teamPreview);
  return (
    <ProjectDetail
      projectId={projectId}
      showTeams={false}
      teamMode={fixturePreview ? "fixture" : "api"}
    />
  );
}
