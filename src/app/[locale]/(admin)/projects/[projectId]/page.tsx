import ProjectDetail from "@/components/projects/ProjectDetail";
import { setRequestLocale } from "next-intl/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <ProjectDetail projectId={projectId} />;
}
