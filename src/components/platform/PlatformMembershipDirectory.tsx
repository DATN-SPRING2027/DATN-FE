"use client";

import Button from "@/components/ui/button/Button";
import PlatformUnavailablePage from "@/components/platform/PlatformUnavailablePage";
import PlatformPagination from "@/components/platform/PlatformPagination";
import type {
  PlatformMembership,
  PlatformOrganization,
  PlatformPage,
} from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformMembershipsQuery } from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useState } from "react";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import { TableSkeleton } from "./ui/LoadingSkeleton";

type Props = Readonly<{
  organizations: PlatformPage<PlatformOrganization> | undefined;
  organizationsLoading: boolean;
  organizationsError: boolean;
  onRetryOrganizations: () => void;
  organizationPage: number;
  onOrganizationPageChange: (page: number) => void;
  organizationId: string;
  canReadOrganizations: boolean;
  canReadMemberships: boolean;
  canSuspendMemberships: boolean;
  currentUserId: string;
  onOrganizationChange: (id: string) => void;
  onSuspend: (membership: PlatformMembership) => void;
}>;

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function PlatformMembershipDirectory({
  organizations,
  organizationsLoading,
  organizationsError,
  onRetryOrganizations,
  organizationPage,
  onOrganizationPageChange,
  organizationId,
  canReadOrganizations,
  canReadMemberships,
  canSuspendMemberships,
  currentUserId,
  onOrganizationChange,
  onSuspend,
}: Props) {
  const t = useTranslations("platformConsole");
  const [membershipPageState, setMembershipPageState] = useState({
    organizationId,
    page: 1,
  });
  const membershipPage =
    membershipPageState.organizationId === organizationId
      ? membershipPageState.page
      : 1;
  const setMembershipPage = (page: number) =>
    setMembershipPageState({ organizationId, page });
  const memberships = usePlatformMembershipsQuery(
    organizationId,
    canReadOrganizations && canReadMemberships && Boolean(organizationId),
    membershipPage,
  );

  return (
    <div className="space-y-6">
      {/* Scope / Organization Selector Card */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl flex-1">
            <label
              className="block text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
              htmlFor="membership-organization"
            >
              {t("memberships.organization")}
            </label>

            {!canReadOrganizations ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {t("memberships.organizationPermissionNeeded")}
              </p>
            ) : organizationsError ? (
              <div
                className="mt-2 flex flex-wrap items-center gap-2"
                role="alert"
              >
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {t("errors.organizationList")}
                </p>
                <button
                  type="button"
                  onClick={onRetryOrganizations}
                  className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t("retry")}
                </button>
              </div>
            ) : organizationsLoading ? (
              <p
                role="status"
                className="mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                {t("loadingOrganizations")}
              </p>
            ) : organizations?.data.length ? (
              <div className="mt-2 space-y-3">
                <select
                  id="membership-organization"
                  value={organizationId}
                  onChange={(event) => {
                    const nextOrganizationId = event.target.value;
                    setMembershipPageState({
                      organizationId: nextOrganizationId,
                      page: 1,
                    });
                    onOrganizationChange(nextOrganizationId);
                  }}
                  className="dark:bg-gray-850/60 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-xs text-gray-900 transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-gray-800 dark:text-white"
                >
                  {organizations.data.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} · {organization.slug}
                    </option>
                  ))}
                </select>

                {organizations.pagination && (
                  <PlatformPagination
                    ariaLabel={t("organizations.directory")}
                    page={organizationPage}
                    totalPages={organizations.pagination.totalPages}
                    totalItems={organizations.pagination.totalItems}
                    onPageChange={onOrganizationPageChange}
                  />
                )}
              </div>
            ) : (
              <p
                role="status"
                className="mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                {t("memberships.noOrganization")}
              </p>
            )}
          </div>

          {organizationId && (
            <div className="dark:bg-gray-850 flex items-center gap-2 rounded-xl bg-gray-50 p-3 sm:self-end">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Total Members:
              </span>
              <span className="font-mono text-sm font-bold text-gray-800 dark:text-gray-200">
                {memberships.data?.pagination.totalItems ?? "—"}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Membership Directory Table */}
      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t("memberships.title")}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("memberships.directoryNote")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !canReadMemberships || !organizationId || memberships.isFetching
            }
            onClick={() => void memberships.refetch()}
            className="h-8 text-xs"
          >
            {memberships.isFetching ? t("refreshing") : t("refresh")}
          </Button>
        </div>

        {!canReadMemberships ? (
          <p
            className="px-5 py-8 text-center text-xs text-amber-700 dark:text-amber-400"
            role="status"
          >
            {t("memberships.readPermissionNeeded")}
          </p>
        ) : !canReadOrganizations ? (
          <p
            className="px-5 py-8 text-center text-xs text-gray-500 dark:text-gray-400"
            role="status"
          >
            {t("memberships.organizationPermissionNeeded")}
          </p>
        ) : !organizationId ? (
          <p
            className="px-5 py-8 text-center text-xs text-gray-500 dark:text-gray-400"
            role="status"
          >
            {t("memberships.chooseOrganization")}
          </p>
        ) : memberships.isPending ? (
          <div>
            <p role="status" className="sr-only">
              {t("loadingMemberships")}
            </p>
            <TableSkeleton rows={4} columns={5} />
          </div>
        ) : memberships.isError ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-6"
            role="alert"
          >
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {t("errors.membershipList")}
            </p>
            <button
              type="button"
              onClick={() => void memberships.refetch()}
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              {t("retry")}
            </button>
          </div>
        ) : memberships.data?.data.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 text-start">{t("table.member")}</th>
                  <th className="px-5 py-3 text-start">{t("table.role")}</th>
                  <th className="px-5 py-3 text-start">{t("table.status")}</th>
                  <th className="px-5 py-3 text-start">{t("table.updated")}</th>
                  <th className="px-5 py-3 text-end">{t("table.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {memberships.data.data.map((member) => (
                  <tr
                    key={member.id}
                    className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {getInitials(member.user?.fullName ?? "?")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {member.user?.fullName ??
                              t("memberships.userUnavailable")}
                          </p>
                          <p className="truncate text-[11px] text-gray-400">
                            {member.user?.email ?? member.userId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {member.organizationRoles.length ? (
                          member.organizationRoles.map((role) => (
                            <span
                              key={role}
                              className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">
                            {t("table.noRole")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={member.status}
                        label={t(`membershipStatus.${member.status}`)}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">
                      {new Date(member.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      {canSuspendMemberships &&
                      member.status === "ACTIVE" &&
                      member.userId !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => onSuspend(member)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-rose-500 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          {t("memberships.suspend")}
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {member.userId === currentUserId
                            ? t("memberships.currentOperator")
                            : t("memberships.noAction")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={t("memberships.emptyTitle")}
            body={t("memberships.emptyBody")}
          />
        )}

        {memberships.data?.pagination && (
          <PlatformPagination
            ariaLabel={t("memberships.title")}
            page={membershipPage}
            totalPages={memberships.data.pagination.totalPages}
            totalItems={memberships.data.pagination.totalItems}
            onPageChange={setMembershipPage}
          />
        )}
      </section>

      {/* Compact unavailable banner for missing operations */}
      <PlatformUnavailablePage
        partial
        items={[
          t("capabilities.membershipInvite"),
          t("capabilities.membershipResend"),
          t("capabilities.membershipRevoke"),
          t("capabilities.membershipRemove"),
          t("capabilities.membershipRole"),
          t("capabilities.membershipHistory"),
        ]}
        title={t("capabilities.membershipTitle")}
        description={t("capabilities.membershipDescription")}
        dependency={t("capabilities.membershipDependency")}
      />
    </div>
  );
}
