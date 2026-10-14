import { setRequestLocale } from "next-intl/server";
import OrganizationMembershipManager from "@/components/organization-members/OrganizationMembershipManager";

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganizationMembershipManager />;
}
