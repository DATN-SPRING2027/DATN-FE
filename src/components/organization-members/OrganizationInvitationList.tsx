"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminInvitation, AdminInvitationPage } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { getInvitationActions } from "@/lib/queries/organization-memberships/organization-membership-actions";
import OrganizationActionMenu from "./OrganizationActionMenu";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function OrganizationInvitationList({
  page,
  actionsEnabled,
  onPageChange,
  onAction,
}: {
  page: AdminInvitationPage;
  actionsEnabled: boolean;
  onPageChange: (next: number) => void;
  onAction: (action: "resend" | "cancel", invitation: AdminInvitation) => void;
}) {
  const t = useTranslations("organizationMembers");
  const locale = useLocale();
  const totalPages = page.pagination.totalPages;

  return (
    <div>
      <Table className="w-full table-fixed text-start">
        <TableHeader className="sr-only bg-gray-50 lg:not-sr-only lg:table-header-group dark:bg-white/2">
          <TableRow>
            <TableCell isHeader className="w-1/3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("email")}</TableCell>
            <TableCell isHeader className="w-1/6 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("invitationState")}</TableCell>
            <TableCell isHeader className="w-1/6 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("sentColumn")}</TableCell>
            <TableCell isHeader className="w-1/6 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5 dark:text-gray-400">{t("expiresColumn")}</TableCell>
            <TableCell isHeader className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="block space-y-2 lg:table-row-group lg:space-y-0">
          {page.data.map((invitation) => {
            const actions = getInvitationActions(invitation);
            const actionLabel = t("invitationActionsFor", { email: invitation.email });
            const actionItems = actionsEnabled
              ? actions.map((action) => ({
                  key: action,
                  label: t(action === "resend" ? "resend" : "cancelInvitation"),
                  onSelect: () => onAction(action, invitation),
                }))
              : [];

            return (
              <TableRow key={invitation.id} className="grid grid-cols-2 gap-x-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-gray-100 lg:px-0 lg:py-0 dark:lg:border-gray-800">
                <TableCell className="col-span-2 min-w-0 break-all px-0 py-0 text-sm font-medium text-gray-800 dark:text-white/90 lg:table-cell lg:px-5 lg:py-3">{invitation.email}</TableCell>
                <TableCell className="col-span-1 flex items-center gap-2 px-0 py-2 text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("invitationState")}</span>
                  <span className={invitation.status === "PENDING" ? "inline-flex rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" : "text-sm text-gray-600 dark:text-gray-300"}>{t(invitation.status)}</span>
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-2 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("sentColumn")}</span>
                  <time dateTime={invitation.createdAt}>{formatDate(invitation.createdAt, locale)}</time>
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-2 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("expiresColumn")}</span>
                  <time dateTime={invitation.expiresAt}>{formatDate(invitation.expiresAt, locale)}</time>
                </TableCell>
                <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 px-0 pt-2 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-3 lg:py-2">
                  {actionItems.length > 0 ? (
                    <OrganizationActionMenu label={actionLabel} items={actionItems} />
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t("actionsUnavailable")}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <nav aria-label={t("invitationsPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-1 py-4 dark:border-gray-800">
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
