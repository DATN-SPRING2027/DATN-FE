import { setRequestLocale } from "next-intl/server";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";
export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <TeamsWorkspace projectId={projectId} />;
}
