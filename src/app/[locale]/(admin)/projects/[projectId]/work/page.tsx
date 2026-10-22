import { setRequestLocale } from "next-intl/server";
import WorkWorkspace from "@/components/work/WorkWorkspace";

export default async function ProjectWorkPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <WorkWorkspace key={projectId} projectId={projectId} hideProjectBanner />;
}
