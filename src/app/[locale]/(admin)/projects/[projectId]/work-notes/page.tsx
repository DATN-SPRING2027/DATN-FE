import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import WorkNotesWorkspace from "@/components/work-notes/WorkNotesWorkspace";

export default async function ProjectWorkNotesPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <Suspense fallback={<main role="status">{t("loading")}</main>}>
      <WorkNotesWorkspace key={projectId} projectId={projectId} />
    </Suspense>
  );
}
