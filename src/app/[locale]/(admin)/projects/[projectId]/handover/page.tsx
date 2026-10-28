import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import HandoverListWorkspace from "@/components/handover/HandoverListWorkspace";

export default async function ProjectHandoverListPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<main role="status">Loading knowledge handovers…</main>}>
      <HandoverListWorkspace key={projectId} projectId={projectId} />
    </Suspense>
  );
}

