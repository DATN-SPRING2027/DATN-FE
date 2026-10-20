"use client";

import type { OrganizationMembershipStatus } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { useTranslations } from "next-intl";

const tones: Record<OrganizationMembershipStatus, string> = {
  PENDING_INVITE: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300",
  ACTIVE: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300",
  SUSPENDED: "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300",
  REMOVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const dotTones: Record<OrganizationMembershipStatus, string> = {
  PENDING_INVITE: "bg-warning-500",
  ACTIVE: "bg-success-500",
  SUSPENDED: "bg-error-500",
  REMOVED: "bg-gray-400",
};

export default function OrganizationMembershipState({ status }: { status: OrganizationMembershipStatus }) {
  const t = useTranslations("organizationMembers");
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${tones[status]}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotTones[status]}`} />
      {t(status)}
    </span>
  );
}
