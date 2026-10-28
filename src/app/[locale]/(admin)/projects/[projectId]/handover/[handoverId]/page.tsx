import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import HandoverDetailWorkspace from "@/components/handover/HandoverDetailWorkspace";

export default async function ProjectHandoverDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; handoverId: string }>;
}) {
  const { locale, projectId, handoverId } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<main role="status">Loading handover workspace…</main>}>
      <HandoverDetailWorkspace
        key={`${projectId}:${handoverId}`}
        projectId={projectId}
        handoverId={handoverId}
      />
    </Suspense>
  );
}

