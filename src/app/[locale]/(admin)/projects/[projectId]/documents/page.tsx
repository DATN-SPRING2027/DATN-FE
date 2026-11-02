import { setRequestLocale } from "next-intl/server";
import ProjectDocumentsWorkspace from "@/components/work-notes/ProjectDocumentsWorkspace";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectDocuments");
}

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams?: Promise<{ documentId?: string | string[] }>;
}) {
  const { locale, projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawDocId = resolvedSearchParams?.documentId;
  const initialDocumentId = Array.isArray(rawDocId) ? rawDocId[0] : rawDocId;
  setRequestLocale(locale);
  return (
    <ProjectDocumentsWorkspace
      key={`${projectId}:${initialDocumentId ?? ""}`}
      projectId={projectId}
      initialDocumentId={initialDocumentId}
    />
  );
}
