import { setRequestLocale } from "next-intl/server";
import OrganizationMembershipManager from "@/components/organization-members/OrganizationMembershipManager";

import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "organizationMembers");
}

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationMembershipManager />;
}
