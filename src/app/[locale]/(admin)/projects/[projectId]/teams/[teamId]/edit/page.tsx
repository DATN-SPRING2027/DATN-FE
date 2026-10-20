import { setRequestLocale } from "next-intl/server";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";
export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; teamId: string }>;
}) {
  const { locale, projectId, teamId } = await params;
  setRequestLocale(locale);
  return <TeamsWorkspace projectId={projectId} teamId={teamId} mode="edit" />;
}
