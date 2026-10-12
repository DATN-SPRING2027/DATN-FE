import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import { setRequestLocale } from "next-intl/server";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProjectWorkspace />;
}
