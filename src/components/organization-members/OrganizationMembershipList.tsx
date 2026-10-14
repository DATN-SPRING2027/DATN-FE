"use client";

import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OrganizationMembership,
  OrganizationMembershipPage,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { getMembershipActions } from "@/lib/queries/organization-memberships/organization-membership-actions";
import OrganizationMembershipState from "./OrganizationMembershipState";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function OrganizationMembershipList({
  page,
  actorId,
  actionsDisabled,
  onPageChange,
  onSuspend,
}: {
  page: OrganizationMembershipPage;
  actorId: string;
  actionsDisabled: boolean;
  onPageChange: (next: number) => void;
  onSuspend: (membership: OrganizationMembership) => void;
}) {
  const t = useTranslations("organizationMembers");
  const locale = useLocale();
  const totalPages = page.pagination.totalPages;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="overflow-x-auto">
        <Table className="min-w-[680px] text-start">
          <TableHeader className="bg-gray-50 dark:bg-white/2">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("memberColumn")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("statusColumn")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("createdColumn")}</TableCell>
              <TableCell isHeader className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data.map((membership) => {
              const actions = getMembershipActions(membership, actorId);
              return (
                <TableRow key={membership.id} className="border-t border-gray-100 dark:border-gray-800">
                  <TableCell className="px-5 py-4 align-middle">
                    <div className="font-medium text-gray-800 dark:text-white/90">
                      {membership.user?.fullName || t("nameUnavailable")}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {membership.user?.email ?? membership.userId}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-4 align-middle"><OrganizationMembershipState status={membership.status} /></TableCell>
                  <TableCell className="px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-300">
                    <time dateTime={membership.createdAt}>{formatDate(membership.createdAt, locale)}</time>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-end align-middle">
                    {actions.includes("suspend") ? (
                      <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => onSuspend(membership)}>
                        {t("suspend")}
                      </Button>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <nav aria-label={t("membersPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
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
