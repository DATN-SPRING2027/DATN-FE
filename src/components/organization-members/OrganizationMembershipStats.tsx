"use client";

import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  GroupIcon,
  TimeIcon,
  UserIcon,
} from "@/icons";
import { useOrganizationMembershipsQuery } from "@/lib/queries/organization-memberships/useOrganizationMemberships";

const countFilter = { page: 1, pageSize: 1 } as const;

export default function OrganizationMembershipStats({
  actorId,
  organizationId,
  pendingCount,
  pendingCountUnavailable = false,
}: {
  actorId: string;
  organizationId: string;
  pendingCount?: number;
  pendingCountUnavailable?: boolean;
}) {
  const t = useTranslations("organizationMembers");
  const total = useOrganizationMembershipsQuery(actorId, organizationId, countFilter);
  const active = useOrganizationMembershipsQuery(actorId, organizationId, {
    ...countFilter,
    status: "ACTIVE",
  });
  const suspended = useOrganizationMembershipsQuery(actorId, organizationId, {
    ...countFilter,
    status: "SUSPENDED",
  });

  const cards = [
    {
      label: t("totalMembers"),
      value: total.data?.pagination.totalItems ?? (total.isError ? null : undefined),
      icon: GroupIcon,
      tone: "brand",
    },
    {
      label: t("activeMembers"),
      value: active.data?.pagination.totalItems ?? (active.isError ? null : undefined),
      icon: CheckCircleIcon,
      tone: "success",
    },
    {
      label: t("pendingInvitations"),
      value: pendingCount ?? (pendingCountUnavailable ? null : undefined),
      icon: TimeIcon,
      tone: "warning",
    },
    {
      label: t("suspendedMembers"),
      value: suspended.data?.pagination.totalItems ?? (suspended.isError ? null : undefined),
      icon: UserIcon,
      tone: "error",
    },
  ] as const;

  const toneClasses = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300",
    success: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300",
    error: "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-300",
  } as const;

  return (
    <section aria-label={t("membershipSummary")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <article
          key={label}
          aria-busy={value === undefined}
          className="flex min-h-22 items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/3 sm:px-5"
        >
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`} aria-hidden="true">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            {value === undefined ? (
              <span className="block h-7 w-10 motion-safe:animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            ) : (
              <p className="text-xl font-semibold leading-7 text-gray-900 dark:text-white/90">{value ?? "—"}</p>
            )}
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
