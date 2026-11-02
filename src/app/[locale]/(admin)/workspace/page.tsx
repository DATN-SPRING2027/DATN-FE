import { setRequestLocale } from "next-intl/server";
import MemberWorkspace from "@/components/work/MemberWorkspace";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "workspace");
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const [{ locale }, { projectId }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  return <MemberWorkspace initialProjectId={projectId} />;
}
