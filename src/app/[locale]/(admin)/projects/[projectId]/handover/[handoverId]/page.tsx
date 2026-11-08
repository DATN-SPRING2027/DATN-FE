import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import HandoverDetailWorkspace from "@/components/handover/HandoverDetailWorkspace";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectHandoverDetail");
}

export default async function ProjectHandoverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string; handoverId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ locale, projectId, handoverId }, { view }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "handover" });
  return (
    <Suspense fallback={<main role="status">{t("detail.loadingTitle")}</main>}>
      <HandoverDetailWorkspace
        key={`${projectId}:${handoverId}`}
        projectId={projectId}
        handoverId={handoverId}
        preferParticipant={view === "participant"}
      />
    </Suspense>
  );
}
