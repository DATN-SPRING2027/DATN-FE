"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import type { OrganizationMembership, OrganizationMembershipPage } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { getMembershipActions } from "@/lib/queries/organization-memberships/organization-membership-actions";
import OrganizationMembershipState from "./OrganizationMembershipState";
import OrganizationActionMenu from "./OrganizationActionMenu";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function getInitials(name: string, email: string): string {
  const value = name.trim() || email.trim();
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase();
  return [...value].slice(0, 2).join("").toLocaleUpperCase();
}

export default function OrganizationMembershipList({
  page,
  actorId,
  canManageActions,
  actionsDisabled,
  onPageChange,
  onSuspend,
}: {
  page: OrganizationMembershipPage;
  actorId: string;
  canManageActions: boolean;
  actionsDisabled: boolean;
  onPageChange: (next: number) => void;
  onSuspend: (membership: OrganizationMembership) => void;
}) {
  const t = useTranslations("organizationMembers");
  const locale = useLocale();
  const totalPages = page.pagination.totalPages;

  return (
    <div>
      <Table className="w-full table-fixed text-start">
        <TableHeader className="sr-only bg-gray-50 lg:not-sr-only lg:table-header-group dark:bg-white/2">
          <TableRow>
            <TableCell isHeader className="w-1/2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("memberColumn")}</TableCell>
            <TableCell isHeader className="w-1/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("statusColumn")}</TableCell>
            <TableCell isHeader className="w-1/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("createdColumn")}</TableCell>
            <TableCell isHeader className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="block space-y-2 lg:table-row-group lg:space-y-0">
          {page.data.map((membership) => {
            const actions = getMembershipActions(membership, actorId);
            const name = membership.user?.fullName || t("nameUnavailable");
            const email = membership.user?.email ?? membership.userId;
            const unavailableText = membership.userId === actorId
              ? t("selfActionsUnavailable")
              : !canManageActions
                ? t("permissionActionsUnavailable")
                : t("actionsUnavailable");
            const actionItems = actions.includes("suspend")
              ? [{ key: "suspend", label: t("suspend"), onSelect: () => onSuspend(membership) }]
              : [];
            const actionLabel = t("memberActionsFor", { name });

            return (
              <TableRow key={membership.id} className="grid grid-cols-2 gap-x-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-gray-100 lg:px-0 lg:py-0 dark:lg:border-gray-800">
                <TableCell className="col-span-2 flex min-w-0 items-center gap-3 px-0 py-0 align-middle lg:table-cell lg:px-5 lg:py-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    {getInitials(name, email)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-800 dark:text-white/90">{name}</div>
                    <div className="mt-0.5 break-all text-sm text-gray-500 dark:text-gray-400">{email}</div>
                  </div>
                </TableCell>
                <TableCell className="col-span-1 flex items-center gap-2 px-0 py-2 align-middle lg:table-cell lg:px-5 lg:py-3">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("statusColumn")}</span>
                  <OrganizationMembershipState status={membership.status} />
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-2 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("createdColumn")}</span>
                  <time dateTime={membership.createdAt}>{formatDate(membership.createdAt, locale)}</time>
                </TableCell>
                <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 px-0 pt-2 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-3 lg:py-2">
                  {canManageActions && actionItems.length > 0 ? (
                    <OrganizationActionMenu label={actionLabel} items={actionItems} disabled={actionsDisabled} />
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{unavailableText}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <nav aria-label={t("membersPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-1 py-4 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("pageOf", { page: page.pagination.page, total: totalPages })}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={page.pagination.page <= 1} onClick={() => onPageChange(page.pagination.page - 1)}>{t("previous")}</Button>
            <Button type="button" variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={page.pagination.page >= totalPages} onClick={() => onPageChange(page.pagination.page + 1)}>{t("next")}</Button>
          </div>
        </nav>
      )}
    </div>
  );
}
