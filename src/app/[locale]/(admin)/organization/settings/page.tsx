import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import OrganizationSettingsManager from "@/components/organization-settings/OrganizationSettingsManager";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "organizationSettings", {
    descriptionKey: "organizationSettingsDescription",
  });
}

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationSettingsManager />;
}
