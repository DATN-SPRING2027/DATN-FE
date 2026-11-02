import { setRequestLocale } from "next-intl/server";
import WorkWorkspace from "@/components/work/WorkWorkspace";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "projectWork");
}

export default async function ProjectWorkPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  return <WorkWorkspace key={projectId} projectId={projectId} hideProjectBanner />;
}
