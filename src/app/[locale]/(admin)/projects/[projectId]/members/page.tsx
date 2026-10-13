import { setRequestLocale } from "next-intl/server";
import ProjectMembers from "@/components/projects/members/ProjectMembers";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <ProjectMembers projectId={projectId} />;
}
