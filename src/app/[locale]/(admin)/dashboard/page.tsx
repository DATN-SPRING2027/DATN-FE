import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import OrganizationOverviewDashboard from "@/components/organization-overview/OrganizationOverviewDashboard";

export const metadata: Metadata = {
  title: "Continuum AI — Organization Overview",
  description: "Organization governance, membership, and project workspace overview",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationOverviewDashboard />;
}
