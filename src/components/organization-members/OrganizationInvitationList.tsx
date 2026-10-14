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
  actionsDisabled,
  onPageChange,
  onAction,
}: {
  page: AdminInvitationPage;
  actionsDisabled: boolean;
  onPageChange: (next: number) => void;
  onAction: (action: "resend" | "cancel", invitation: AdminInvitation) => void;
}) {
  const t = useTranslations("organizationMembers");
  const locale = useLocale();
  const totalPages = page.pagination.totalPages;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="overflow-x-auto">
        <Table className="min-w-[620px] text-start">
          <TableHeader className="bg-gray-50 dark:bg-white/2">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("email")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("invitationState")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("expiresColumn")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data.map((invitation) => {
              const actions = getInvitationActions(invitation);
              return (
                <TableRow key={invitation.id} className="border-t border-gray-100 dark:border-gray-800">
                  <TableCell className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{invitation.email}</TableCell>
                  <TableCell className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{t("invitationPending")}</TableCell>
                  <TableCell className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                    <time dateTime={invitation.expiresAt}>{formatDate(invitation.expiresAt, locale)}</time>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-end align-middle">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      {actions.includes("resend") && <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => onAction("resend", invitation)}>{t("resend")}</Button>}
                      {actions.includes("cancel") && <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => onAction("cancel", invitation)}>{t("cancelInvitation")}</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <nav aria-label={t("invitationsPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("pageOf", { page: page.pagination.page, total: totalPages })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page.pagination.page <= 1} onClick={() => onPageChange(page.pagination.page - 1)}>{t("previous")}</Button>
            <Button variant="outline" size="sm" disabled={page.pagination.page >= totalPages} onClick={() => onPageChange(page.pagination.page + 1)}>{t("next")}</Button>
          </div>
        </nav>
      )}
    </div>
  );
}
