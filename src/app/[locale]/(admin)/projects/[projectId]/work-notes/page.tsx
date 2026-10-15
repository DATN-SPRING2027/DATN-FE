import { setRequestLocale } from "next-intl/server";
import WorkNotesWorkspace from "@/components/work-notes/WorkNotesWorkspace";

export default async function ProjectWorkNotesPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <WorkNotesWorkspace key={projectId} projectId={projectId} />;
}
