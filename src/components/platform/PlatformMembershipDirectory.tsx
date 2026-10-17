"use client";

import Button from "@/components/ui/button/Button";
import PlatformUnavailablePage from "@/components/platform/PlatformUnavailablePage";
import PlatformPagination from "@/components/platform/PlatformPagination";
import { platformErrorMessageKey } from "@/lib/queries/platform/platform-api";
import type { PlatformMembership, PlatformOrganization, PlatformPage } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformMembershipsQuery } from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = Readonly<{
  organizations: PlatformPage<PlatformOrganization> | undefined;
  organizationsLoading: boolean;
  organizationsError: unknown;
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
  const [membershipPageState, setMembershipPageState] = useState({ organizationId, page: 1 });
  const membershipPage = membershipPageState.organizationId === organizationId ? membershipPageState.page : 1;
  const setMembershipPage = (page: number) => setMembershipPageState({ organizationId, page });
  const memberships = usePlatformMembershipsQuery(organizationId, canReadOrganizations && canReadMemberships && Boolean(organizationId), membershipPage);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <label className="block max-w-xl text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="membership-organization">{t("memberships.organization")}</label>
        {!canReadOrganizations ? <p className="mt-2 text-sm text-warning-800 dark:text-warning-300">{t("memberships.organizationPermissionNeeded")}</p> : organizationsError ? <div className="mt-2 flex flex-wrap items-center gap-3" role="alert"><p className="text-sm text-error-600 dark:text-error-400">{t(platformErrorMessageKey(organizationsError, "errors.organizationList"))}</p><button type="button" onClick={onRetryOrganizations} className="text-sm font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div> : organizationsLoading ? <p role="status" className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("loadingOrganizations")}</p> : organizations?.data.length ? <><select id="membership-organization" value={organizationId} onChange={(event) => { const nextOrganizationId = event.target.value; setMembershipPageState({ organizationId: nextOrganizationId, page: 1 }); onOrganizationChange(nextOrganizationId); }} className="mt-2 h-11 w-full max-w-xl rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white">{organizations.data.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.slug}</option>)}</select>{organizations.pagination && <PlatformPagination ariaLabel={t("organizations.directory")} page={organizationPage} totalPages={organizations.pagination.totalPages} totalItems={organizations.pagination.totalItems} onPageChange={onOrganizationPageChange} />}</> : <p role="status" className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("memberships.noOrganization")}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800"><div><h3 className="font-semibold text-gray-900 dark:text-white">{t("memberships.title")}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("memberships.directoryNote")}</p></div><Button variant="outline" size="sm" disabled={!canReadMemberships || !organizationId || memberships.isFetching} onClick={() => void memberships.refetch()}>{memberships.isFetching ? t("refreshing") : t("refresh")}</Button></div>
        {!canReadMemberships ? <p className="px-5 py-6 text-sm text-warning-800 dark:text-warning-300" role="status">{t("memberships.readPermissionNeeded")}</p> : !canReadOrganizations ? <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400" role="status">{t("memberships.organizationPermissionNeeded")}</p> : !organizationId ? <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400" role="status">{t("memberships.chooseOrganization")}</p> : memberships.isPending ? <p role="status" className="px-5 py-8 text-sm text-gray-500">{t("loadingMemberships")}</p> : memberships.isError ? <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert"><p className="text-sm text-error-600 dark:text-error-400">{t(platformErrorMessageKey(memberships.error, "errors.membershipList"))}</p><button type="button" onClick={() => void memberships.refetch()} className="text-sm font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div> : memberships.data?.data.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-5 py-3 text-start font-medium">{t("table.member")}</th><th className="px-5 py-3 text-start font-medium">{t("table.role")}</th><th className="px-5 py-3 text-start font-medium">{t("table.status")}</th><th className="px-5 py-3 text-start font-medium">{t("table.updated")}</th><th className="px-5 py-3 text-end font-medium">{t("table.action")}</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{memberships.data.data.map((member) => <tr key={member.id}><td className="px-5 py-3"><p className="font-medium text-gray-800 dark:text-gray-100">{member.user?.fullName ?? t("memberships.userUnavailable")}</p><p className="text-xs text-gray-500">{member.user?.email ?? member.userId}</p></td><td className="px-5 py-3 text-gray-600 dark:text-gray-300">{member.organizationRoles.length ? member.organizationRoles.join(", ") : t("table.noRole")}</td><td className="px-5 py-3"><StatusBadge status={member.status} label={t(`membershipStatus.${member.status}`)} /></td><td className="px-5 py-3 text-gray-500">{new Date(member.updatedAt).toLocaleString()}</td><td className="px-5 py-3 text-end">{canSuspendMemberships && member.status === "ACTIVE" && member.userId !== currentUserId ? <button type="button" onClick={() => onSuspend(member)} className="rounded-md px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-error-500 dark:text-error-400 dark:hover:bg-error-500/10">{t("memberships.suspend")}</button> : <span className="text-xs text-gray-400">{member.userId === currentUserId ? t("memberships.currentOperator") : t("memberships.noAction")}</span>}</td></tr>)}</tbody></table></div> : <div className="px-5 py-10 text-center"><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("memberships.emptyTitle")}</h4><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("memberships.emptyBody")}</p></div>}
        {memberships.data?.pagination && <PlatformPagination ariaLabel={t("memberships.title")} page={membershipPage} totalPages={memberships.data.pagination.totalPages} totalItems={memberships.data.pagination.totalItems} onPageChange={setMembershipPage} />}
      </section>
      <PlatformUnavailablePage partial items={[t("capabilities.membershipInvite"), t("capabilities.membershipResend"), t("capabilities.membershipRevoke"), t("capabilities.membershipRemove"), t("capabilities.membershipRole"), t("capabilities.membershipHistory")]} title={t("capabilities.membershipTitle")} description={t("capabilities.membershipDescription")} dependency={t("capabilities.membershipDependency")} />
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors = status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : status === "SUSPENDED" ? "bg-warning-50 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{label}</span>;
}
