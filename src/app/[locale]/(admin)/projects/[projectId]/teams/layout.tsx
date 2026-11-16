import { redirect } from "@/i18n/navigation";
import { teamDevelopmentEnabled } from "@/lib/teams-development";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export default async function TeamDevelopmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; projectId: string }>;
}) {
  if (!teamDevelopmentEnabled()) {
    const { locale, projectId } = await params;
    redirect({
      href: `/projects/${encodeURIComponent(projectId)}/members`,
      locale,
    });
  }
  return children;
}
