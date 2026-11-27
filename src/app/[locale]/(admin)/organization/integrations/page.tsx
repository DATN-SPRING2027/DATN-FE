import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import OrganizationIntegrationsManager from "@/components/organization-integrations/OrganizationIntegrationsManager";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "organizationIntegrations", {
    descriptionKey: "organizationIntegrationsDescription",
  });
}

export default async function OrganizationIntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationIntegrationsManager />;
}
