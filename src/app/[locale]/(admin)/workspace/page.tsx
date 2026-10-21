import { setRequestLocale } from "next-intl/server";
import MemberWorkspace from "@/components/work/MemberWorkspace";

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
