import { redirect } from "@/i18n/navigation";
import { teamDevelopmentEnabled } from "@/lib/teams-development";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export default async function TeamDevelopmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  if (!teamDevelopmentEnabled()) {
    redirect({
      href: `/projects/${encodeURIComponent(projectId)}/members`,
      locale,
    });
  }
  return children;
}
