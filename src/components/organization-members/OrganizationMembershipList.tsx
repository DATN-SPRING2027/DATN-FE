"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { LockIcon, PencilIcon } from "@/icons";
import type { OrganizationMembership, OrganizationMembershipPage } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { getMembershipActions } from "@/lib/queries/organization-memberships/organization-membership-actions";
import OrganizationMembershipState from "./OrganizationMembershipState";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function getInitials(name: string, email: string): string {
  const value = name.trim() || email.trim();
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase();
  return [...value].slice(0, 2).join("").toLocaleUpperCase();
}

function ProtectedActionBadge({
  label,
  tooltipText,
}: {
  label: string;
  tooltipText: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={`${label}: ${tooltipText}`}
        title={tooltipText}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700/60 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <LockIcon className="size-3 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <span>{label}</span>
      </button>
      <div
        role="tooltip"
        className={`pointer-events-none absolute bottom-full end-0 z-30 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-normal text-white shadow-md transition-all duration-150 dark:bg-gray-800 dark:text-gray-200 ${
          showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        {tooltipText}
        <div className="absolute -bottom-1 end-3 size-2 rotate-45 bg-gray-900 dark:bg-gray-800" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function OrganizationMembershipList({
  page,
  actorId,
  canManageActions,
  actionsDisabled,
  searchTerm,
  onPageChange,
  onSuspend,
  onSetRole,
}: {
  page: OrganizationMembershipPage;
  actorId: string;
  canManageActions: boolean;
  actionsDisabled: boolean;
  searchTerm: string;
  onPageChange: (next: number) => void;
  onSuspend: (membership: OrganizationMembership) => void;
  onSetRole: (membership: OrganizationMembership) => void;
}) {
  const t = useTranslations("organizationMembers");
  const displayRoleLabel = useRoleDisplayLabel();
  const locale = useLocale();
  const query = searchTerm.trim().toLocaleLowerCase(locale);
  const visibleMembers = query
    ? page.data.filter((membership) => {
        const role = membership.roleCode === "ADMIN" || membership.roleCode === "MEMBER" ? displayRoleLabel(membership.roleCode) : t("roleUnassigned");
        const searchable = [membership.user?.fullName, membership.user?.email, membership.userId, role]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(locale);
        return searchable.includes(query);
      })
    : page.data;
  const totalPages = page.pagination.totalPages;
  const start = page.data.length === 0 ? 0 : (page.pagination.page - 1) * page.pagination.pageSize + 1;
  const end = start === 0 ? 0 : start + page.data.length - 1;

  return (
    <div className="space-y-4">
      {visibleMembers.length === 0 && (
        <div role="status" className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-700">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{query ? t("searchEmpty") : t("membersEmpty")}</p>
        </div>
      )}
      <div className="w-full max-w-full overflow-x-auto" hidden={visibleMembers.length === 0}>
        <Table className="table-fixed block w-full min-w-0 text-start lg:table lg:min-w-full">
          <TableHeader className="hidden bg-gray-50/75 lg:table-header-group dark:bg-white/2">
            <TableRow className="border-b border-gray-100 dark:border-gray-800">
              <TableCell isHeader className="w-[32%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
                {t("memberColumn")}
              </TableCell>
              <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
                {t("roleColumn")}
              </TableCell>
              <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
                {t("statusColumn")}
              </TableCell>
              <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
                {t("createdColumn")}
              </TableCell>
              <TableCell isHeader className="w-[18%] px-4 py-3 text-end text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
                {t("actionsColumn")}
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="block w-full space-y-3 lg:table-row-group lg:space-y-0">
            {visibleMembers.map((membership) => {
              const isSelf = membership.userId === actorId;
              const actions = canManageActions ? getMembershipActions(membership, actorId) : [];
              const name = membership.user?.fullName || t("nameUnavailable");
              const email = membership.user?.email ?? membership.userId;
              const canChangeRole = canManageActions && membership.status === "ACTIVE" && membership.user !== null && membership.userId.toLowerCase() !== actorId.toLowerCase();
              const roleLabel = membership.roleCode === "ADMIN" || membership.roleCode === "MEMBER" ? displayRoleLabel(membership.roleCode) : t("roleUnassigned");
              const roleTone = membership.roleCode === "ADMIN"
                ? "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20"
                : membership.roleCode === "MEMBER"
                  ? "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                  : "bg-warning-50 text-warning-700 ring-warning-100 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-500/20";
              const unavailableText = isSelf
                ? t("selfActionsUnavailable")
                : !canManageActions
                  ? t("permissionActionsUnavailable")
                  : t("actionsUnavailable");

              return (
                <TableRow
                  key={membership.id}
                  className="border-b border-gray-100 grid w-full grid-cols-2 gap-y-3 gap-x-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 lg:p-0 dark:lg:border-gray-800"
                >
                  <TableCell className="col-span-2 px-0 py-0 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        aria-hidden="true"
                        className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 ring-1 ring-brand-500/10 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-400/20"
                      >
                        {getInitials(name, email)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium text-gray-900 dark:text-white/90 text-sm">
                            {name}
                          </span>
                          {isSelf && (
                            <span className="inline-flex shrink-0 items-center rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                              {t("you")}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="col-span-1 flex items-center gap-2 px-0 py-1 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                    <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("roleColumn")}</span>
                    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${roleTone}`}>
                      <span className="truncate">{roleLabel}</span>
                    </span>
                  </TableCell>
                  <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-1 align-middle lg:table-cell lg:px-5 lg:py-3.5 lg:justify-start">
                    <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("statusColumn")}</span>
                    <OrganizationMembershipState status={membership.status} />
                  </TableCell>
                  <TableCell className="col-span-1 flex items-center gap-2 px-0 py-1 text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3.5">
                    <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("createdColumn")}</span>
                    <time dateTime={membership.createdAt} className="font-normal text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(membership.createdAt, locale)}
                    </time>
                  </TableCell>
                  <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 pt-3 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-5 lg:py-3.5 lg:pt-0">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canChangeRole && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionsDisabled}
                          onClick={() => onSetRole(membership)}
                          startIcon={<PencilIcon className="size-3.5" aria-hidden="true" />}
                          className="whitespace-nowrap px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        >
                          {t("changeRole")}
                        </Button>
                      )}
                      {actions.includes("suspend") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionsDisabled}
                          onClick={() => onSuspend(membership)}
                          startIcon={<LockIcon className="size-3.5" aria-hidden="true" />}
                          className="whitespace-nowrap px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        >
                          {t("suspend")}
                        </Button>
                      )}
                      {isSelf && !canChangeRole && !actions.includes("suspend") && (
                        <ProtectedActionBadge
                          label={t("protected")}
                          tooltipText={unavailableText}
                        />
                      )}
                      {!isSelf && !canChangeRole && !actions.includes("suspend") && (
                        <span className="text-xs text-gray-400 dark:text-gray-500" title={unavailableText}>
                          {unavailableText}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">
          {query ? t("searchMatchesOnPage", { count: visibleMembers.length }) : t("showingMembers", { from: start, to: end, total: page.pagination.totalItems })}
        </p>
        {totalPages > 1 && (
          <nav aria-label={t("membersPagination")} className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              ariaLabel={t("previous")}
              disabled={page.pagination.page <= 1}
              onClick={() => onPageChange(page.pagination.page - 1)}
              className="size-9 px-0 py-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <span aria-hidden="true" className="rtl:rotate-180">‹</span>
            </Button>
            <span aria-current="page" className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white">
              {page.pagination.page}
            </span>
            <span className="sr-only">{t("pageOf", { page: page.pagination.page, total: totalPages })}</span>
            <Button
              variant="outline"
              size="sm"
              ariaLabel={t("next")}
              disabled={page.pagination.page >= totalPages}
              onClick={() => onPageChange(page.pagination.page + 1)}
              className="size-9 px-0 py-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <span aria-hidden="true" className="rtl:rotate-180">›</span>
            </Button>
          </nav>
        )}
      </div>
      {query && <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">{t("searchLoadedPageHint")}</p>}
    </div>
  );
}
