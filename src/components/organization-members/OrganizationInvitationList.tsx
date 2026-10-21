"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { MailIcon } from "@/icons";
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
    <div className="w-full max-w-full overflow-x-auto">
      <Table className="table-fixed block w-full min-w-0 text-start lg:table lg:min-w-full">
        <TableHeader className="hidden bg-gray-50/75 lg:table-header-group dark:bg-white/2">
          <TableRow className="border-b border-gray-100 dark:border-gray-800">
            <TableCell isHeader className="w-[36%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
              {t("email")}
            </TableCell>
            <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
              {t("invitationState")}
            </TableCell>
            <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
              {t("sentColumn")}
            </TableCell>
            <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
              {t("expiresColumn")}
            </TableCell>
            <TableCell isHeader className="w-[10%] px-4 py-3 text-end text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-5 dark:text-gray-400">
              {t("actionsColumn")}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="block w-full space-y-3 lg:table-row-group lg:space-y-0">
          {page.data.map((invitation) => {
            const actions = getInvitationActions(invitation);
            const actionLabel = t("invitationActionsFor", { email: invitation.invitedEmail });
            const actionItems = actionsEnabled
              ? actions.map((action) => ({
                  key: action,
                  label: t(action === "resend" ? "resend" : "cancelInvitation"),
                  onSelect: () => onAction(action, invitation),
                }))
              : [];

            return (
              <TableRow
                key={invitation.id}
                className="grid w-full grid-cols-2 gap-y-3 gap-x-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-gray-100 lg:p-0 dark:lg:border-gray-800"
              >
                <TableCell className="col-span-2 px-0 py-0 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-500/10 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20">
                      <MailIcon className="size-4" />
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                      {invitation.invitedEmail}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="col-span-1 flex items-center gap-2 px-0 py-1 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("invitationState")}</span>
                  <span className={invitation.status === "PENDING" ? "inline-flex rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400" : "text-sm text-gray-600 dark:text-gray-300"}>
                    {t(invitation.status)}
                  </span>
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-1 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3.5 lg:text-start">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("sentColumn")}</span>
                  <time dateTime={invitation.createdAt}>{formatDate(invitation.createdAt, locale)}</time>
                </TableCell>
                <TableCell className="col-span-1 flex items-center justify-end gap-2 px-0 py-1 text-end text-sm text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3.5 lg:text-start">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">{t("expiresColumn")}</span>
                  <time dateTime={invitation.expiresAt}>{formatDate(invitation.expiresAt, locale)}</time>
                </TableCell>
                <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 pt-3 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-5 lg:py-3.5 lg:pt-0">
                  <div className="flex items-center justify-end">
                    {actionItems.length > 0 ? (
                      <OrganizationActionMenu label={actionLabel} items={actionItems} />
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{t("actionsUnavailable")}</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <nav aria-label={t("invitationsPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
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
