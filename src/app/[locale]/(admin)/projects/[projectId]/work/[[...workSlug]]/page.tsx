import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import WorkWorkspace from "@/components/work/WorkWorkspace";
import { parseProjectWorkSlugs } from "@/components/work/work-route";
import { formatAppTitle } from "@/lib/page-titles";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; workSlug?: string[] }>;
}): Promise<Metadata> {
  const { workSlug } = await params;
  const parsed = parseProjectWorkSlugs(workSlug);
  const candidateRef = parsed.subtaskRef ?? parsed.taskRef;
  if (candidateRef && !OBJECT_ID_PATTERN.test(candidateRef)) {
    return {
      title: {
        absolute: formatAppTitle(candidateRef.toUpperCase()),
      },
    };
  }
  return buildAppPageMetadata(params, "projectWork");
}

export default async function ProjectWorkPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; workSlug?: string[] }>;
}) {
  const { locale, projectId, workSlug } = await params;
  setRequestLocale(locale);
  return (
    <WorkWorkspace
      key={projectId}
      projectId={projectId}
      initialWorkSlug={workSlug}
      hideProjectBanner
    />
  );
}
