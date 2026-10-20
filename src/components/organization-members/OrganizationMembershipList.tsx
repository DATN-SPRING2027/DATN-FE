"use client";

import { useLocale, useTranslations } from "next-intl";
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

export default function OrganizationMembershipList({
  page,
  actorId,
  actionsDisabled,
  searchTerm,
  onPageChange,
  onSuspend,
  onSetRole,
}: {
  page: OrganizationMembershipPage;
  actorId: string;
  actionsDisabled: boolean;
  searchTerm: string;
  onPageChange: (next: number) => void;
  onSuspend: (membership: OrganizationMembership) => void;
  onSetRole: (membership: OrganizationMembership) => void;
}) {
  const t = useTranslations("organizationMembers");
  const locale = useLocale();
  const query = searchTerm.trim().toLocaleLowerCase(locale);
  const visibleMembers = query
    ? page.data.filter((membership) => {
        const role = membership.roleCode === "ADMIN" ? t("roleAdmin") : membership.roleCode === "MEMBER" ? t("roleMember") : t("roleUnassigned");
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
    <>
      {visibleMembers.length === 0 ? (
        <div role="status" className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-700">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{query ? t("searchEmpty") : t("membersEmpty")}</p>
          {query && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("searchLoadedPageHint")}</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
          <Table className="w-full min-w-[62rem] table-fixed text-start">
            <TableHeader className="bg-gray-50/80 dark:bg-white/2">
              <TableRow className="border-b border-gray-100 dark:border-gray-800">
                <TableCell isHeader className="w-[30%] px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("memberColumn")}</TableCell>
                <TableCell isHeader className="w-[19%] px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("roleColumn")}</TableCell>
                <TableCell isHeader className="w-[17%] px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("statusColumn")}</TableCell>
                <TableCell isHeader className="w-[15%] px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("createdColumn")}</TableCell>
                <TableCell isHeader className="w-[19%] px-5 py-3.5 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("actionsColumn")}</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.map((membership) => {
                const actions = getMembershipActions(membership, actorId);
                const name = membership.user?.fullName || t("nameUnavailable");
                const email = membership.user?.email ?? membership.userId;
                const canChangeRole = membership.status === "ACTIVE" && membership.user !== null && membership.userId.toLowerCase() !== actorId.toLowerCase();
                const roleLabel = membership.roleCode === "ADMIN" ? t("roleAdmin") : membership.roleCode === "MEMBER" ? t("roleMember") : t("roleUnassigned");
                const roleTone = membership.roleCode === "ADMIN"
                  ? "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20"
                  : membership.roleCode === "MEMBER"
                    ? "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                    : "bg-warning-50 text-warning-700 ring-warning-100 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-500/20";

                return (
                  <TableRow key={membership.id} className="border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2">
                    <TableCell className="px-5 py-4 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">{getInitials(name, email)}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">{name}</p>
                          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-middle">
                      <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${roleTone}`}><span className="truncate">{roleLabel}</span></span>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-middle"><OrganizationMembershipState status={membership.status} /></TableCell>
                    <TableCell className="px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-300"><time dateTime={membership.createdAt}>{formatDate(membership.createdAt, locale)}</time></TableCell>
                    <TableCell className="px-4 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canChangeRole && (
                          <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => onSetRole(membership)} startIcon={<PencilIcon className="size-3.5" aria-hidden="true" />} className="whitespace-nowrap px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                            {t("changeRole")}
                          </Button>
                        )}
                        {actions.includes("suspend") && (
                          <Button variant="outline" size="sm" disabled={actionsDisabled} onClick={() => onSuspend(membership)} startIcon={<LockIcon className="size-3.5" aria-hidden="true" />} className="whitespace-nowrap px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                            {t("suspend")}
                          </Button>
                        )}
                        {!canChangeRole && !actions.includes("suspend") && <span className="text-sm text-gray-400 dark:text-gray-500">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">
          {query ? t("searchMatchesOnPage", { count: visibleMembers.length }) : t("showingMembers", { from: start, to: end, total: page.pagination.totalItems })}
        </p>
        {totalPages > 1 && (
          <nav aria-label={t("membersPagination")} className="flex items-center gap-2">
            <Button variant="outline" size="sm" ariaLabel={t("previous")} disabled={page.pagination.page <= 1} onClick={() => onPageChange(page.pagination.page - 1)} className="size-9 px-0 py-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"><span aria-hidden="true" className="rtl:rotate-180">‹</span></Button>
            <span aria-current="page" className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white">{page.pagination.page}</span>
            <span className="sr-only">{t("pageOf", { page: page.pagination.page, total: totalPages })}</span>
            <Button variant="outline" size="sm" ariaLabel={t("next")} disabled={page.pagination.page >= totalPages} onClick={() => onPageChange(page.pagination.page + 1)} className="size-9 px-0 py-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"><span aria-hidden="true" className="rtl:rotate-180">›</span></Button>
          </nav>
        )}
      </div>
      {query && <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">{t("searchLoadedPageHint")}</p>}
    </>
  );
}
