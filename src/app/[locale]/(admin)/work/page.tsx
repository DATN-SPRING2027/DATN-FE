import { setRequestLocale } from "next-intl/server";
import WorkWorkspace from "@/components/work/WorkWorkspace";

export default async function WorkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorkWorkspace />;
}
