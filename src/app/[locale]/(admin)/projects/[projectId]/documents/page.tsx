import { setRequestLocale } from "next-intl/server";
import ProjectDocumentsWorkspace from "@/components/work-notes/ProjectDocumentsWorkspace";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <ProjectDocumentsWorkspace key={projectId} projectId={projectId} />;
}
