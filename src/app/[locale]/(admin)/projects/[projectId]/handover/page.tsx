import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import HandoverListWorkspace from "@/components/handover/HandoverListWorkspace";

export default async function ProjectHandoverListPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "handover" });
  return (
    <Suspense fallback={<main role="status">{t("list.loadingTitle")}</main>}>
      <HandoverListWorkspace key={projectId} projectId={projectId} />
    </Suspense>
  );
}
