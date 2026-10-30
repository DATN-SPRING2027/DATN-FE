import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import HandoverDetailWorkspace from "@/components/handover/HandoverDetailWorkspace";

export default async function ProjectHandoverDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; handoverId: string }>;
}) {
  const { locale, projectId, handoverId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "handover" });
  return (
    <Suspense fallback={<main role="status">{t("detail.loadingTitle")}</main>}>
      <HandoverDetailWorkspace
        key={`${projectId}:${handoverId}`}
        projectId={projectId}
        handoverId={handoverId}
      />
    </Suspense>
  );
}
