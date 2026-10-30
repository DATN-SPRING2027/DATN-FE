import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SharedAiAnswerView from "@/components/ai-chat/SharedAiAnswerView";

export default async function ProjectSharedAiAnswerPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; shareId: string }>;
}) {
  const { locale, projectId, shareId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "AiChat" });
  return (
    <Suspense fallback={<main role="status">{t("sharedLoading")}</main>}>
      <SharedAiAnswerView
        key={`${projectId}:${shareId}`}
        projectId={projectId}
        shareId={shareId}
      />
    </Suspense>
  );
}
