"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminInvitation, AdminInvitationPage } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { getInvitationActions } from "@/lib/queries/organization-memberships/organization-membership-actions";

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
    <div className="overflow-hidden lg:rounded-xl lg:border lg:border-gray-100 dark:lg:border-gray-800">
      <Table className="w-full table-fixed text-start">
        <TableHeader className="sr-only bg-gray-50 lg:not-sr-only lg:table-header-group dark:bg-white/2">
          <TableRow>
            <TableCell isHeader className="w-1/2 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("email")}</TableCell>
            <TableCell isHeader className="w-1/5 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("invitationState")}</TableCell>
            <TableCell isHeader className="w-1/5 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("expiresColumn")}</TableCell>
            {actionsEnabled && <TableCell isHeader className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>}
          </TableRow>
        </TableHeader>
        <TableBody className="block space-y-3 p-1 lg:table-row-group lg:space-y-0 lg:p-0">
          {page.data.map((invitation) => {
            const actions = getInvitationActions(invitation);
            return (
              <TableRow key={invitation.id} className="grid grid-cols-2 gap-x-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-gray-100 lg:p-0 lg:shadow-none dark:lg:border-gray-800">
                <TableCell className="col-span-2 min-w-0 break-all px-0 py-0 text-sm font-medium text-gray-800 dark:text-white/90 lg:table-cell lg:px-5 lg:py-4">{invitation.email}</TableCell>
                <TableCell className="col-span-1 flex items-center gap-2 px-0 py-2 text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-4">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("invitationState")}</span>
                  {t("invitationPending")}
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-2 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-4">
                  <span className="text-theme-xs font-medium text-gray-500 lg:sr-only">{t("expiresColumn")}</span>
                  <time dateTime={invitation.expiresAt}>{formatDate(invitation.expiresAt, locale)}</time>
                </TableCell>
                {actionsEnabled && <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 px-0 pt-3 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-5 lg:py-4">
                  <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto">
                    {actions.includes("resend") && <Button variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" onClick={() => onAction("resend", invitation)}>{t("resend")}</Button>}
                    {actions.includes("cancel") && <Button variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" onClick={() => onAction("cancel", invitation)}>{t("cancelInvitation")}</Button>}
                  </div>
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <nav aria-label={t("invitationsPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("pageOf", { page: page.pagination.page, total: totalPages })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={page.pagination.page <= 1} onClick={() => onPageChange(page.pagination.page - 1)}>{t("previous")}</Button>
            <Button variant="outline" size="sm" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={page.pagination.page >= totalPages} onClick={() => onPageChange(page.pagination.page + 1)}>{t("next")}</Button>
          </div>
        </nav>
      )}
    </div>
  );
}
