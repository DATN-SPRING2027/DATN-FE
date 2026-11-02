import { setRequestLocale } from "next-intl/server";
import ProjectWorkReportsWorkspace from "@/components/work-notes/ProjectWorkReportsWorkspace";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectWorkReports");
}

export default async function ProjectWorkReportsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <ProjectWorkReportsWorkspace key={projectId} projectId={projectId} />;
}
