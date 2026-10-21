import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import OrganizationSettingsManager from "@/components/organization-settings/OrganizationSettingsManager";

export const metadata: Metadata = {
  title: "Continuum AI — Organization Settings",
  description: "Manage organization profile, governance policy, and manager permissions",
};

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationSettingsManager />;
}
