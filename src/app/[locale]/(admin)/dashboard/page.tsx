import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import OrganizationOverviewDashboard from "@/components/organization-overview/OrganizationOverviewDashboard";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "dashboard", {
    descriptionKey: "dashboardDescription",
  });
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationOverviewDashboard />;
}
