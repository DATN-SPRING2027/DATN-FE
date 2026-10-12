import ProjectCreate from "@/components/projects/ProjectCreate";
import { setRequestLocale } from "next-intl/server";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProjectCreate />;
}
