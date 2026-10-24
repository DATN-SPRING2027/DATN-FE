import { setRequestLocale } from "next-intl/server";
import ProjectWorkReportsWorkspace from "@/components/work-notes/ProjectWorkReportsWorkspace";

export default async function ProjectWorkReportsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <ProjectWorkReportsWorkspace key={projectId} projectId={projectId} />;
}
