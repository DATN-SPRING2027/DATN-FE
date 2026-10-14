"use client";

import Badge from "@/components/ui/badge/Badge";
import type { OrganizationMembershipStatus } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { useTranslations } from "next-intl";

const tones: Record<OrganizationMembershipStatus, "warning" | "success" | "error" | "light"> = {
  PENDING_INVITE: "warning",
  ACTIVE: "success",
  SUSPENDED: "error",
  REMOVED: "light",
};

export default function OrganizationMembershipState({ status }: { status: OrganizationMembershipStatus }) {
  const t = useTranslations("organizationMembers");
  return <Badge color={tones[status]} size="sm">{t(status)}</Badge>;
}
