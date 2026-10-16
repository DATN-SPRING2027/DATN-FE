"use client";

import BrandLogo from "@/components/common/BrandLogo";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import {
  useCreatePlatformOrganizationMutation,
  usePlatformAuditQuery,
  usePlatformHealthQuery,
  usePlatformLogoutMutation,
  usePlatformMembershipsQuery,
  usePlatformOrganizationQuery,
  usePlatformOrganizationsQuery,
  usePlatformSessionQuery,
  usePlatformUserLookupMutation,
  useSuspendPlatformMembershipMutation,
  type PlatformMembership,
  type PlatformPermission,
} from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Section = "organizations" | "health" | "audit";

function has(session: { permissions: readonly PlatformPermission[] } | undefined, permission: PlatformPermission) {
  return Boolean(session?.permissions.includes(permission));
}

function apiMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 403) return fallback;
  if (error.status === 404) return fallback;
  if (error.status === 409) return fallback;
  return fallback;
}

export default function PlatformConsole() {
  const t = useTranslations("platformConsole");
  const router = useRouter();
  const session = usePlatformSessionQuery();
  const logout = usePlatformLogoutMutation();
  const canReadOrganizations = has(session.data, "platform.organizations.organization.read");
  const canCreateOrganization = has(session.data, "organization.create");
  const canLookupUsers = has(session.data, "platform.users.account.read");
  const canReadMemberships = has(session.data, "platform.memberships.membership.read");
  const canSuspendMemberships = has(session.data, "platform.memberships.lifecycle.manage");
  const canReadHealth = has(session.data, "platform.health.read");
  const canReadAudit = has(session.data, "platform.audit.read");
  const organizations = usePlatformOrganizationsQuery(canReadOrganizations);
  const health = usePlatformHealthQuery(canReadHealth);
  const audit = usePlatformAuditQuery(canReadAudit);
  const [section, setSection] = useState<Section>("organizations");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupPurpose, setLookupPurpose] = useState<"create" | "standalone">("standalone");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; fullName: string } | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationPlan, setOrganizationPlan] = useState<"FREE" | "ENTERPRISE">("FREE");
  const [suspendTarget, setSuspendTarget] = useState<PlatformMembership | null>(null);
  const [operationMessage, setOperationMessage] = useState("");
  const organizationRows = organizations.data?.data ?? [];
  const effectiveSelectedOrganizationId = selectedOrganizationId || organizationRows[0]?.id || "";
  const organization = usePlatformOrganizationQuery(effectiveSelectedOrganizationId, canReadOrganizations);
  const memberships = usePlatformMembershipsQuery(effectiveSelectedOrganizationId, canReadMemberships);
  const lookup = usePlatformUserLookupMutation();
  const createOrganization = useCreatePlatformOrganizationMutation();
  const suspend = useSuspendPlatformMembershipMutation(effectiveSelectedOrganizationId);

  const sections = useMemo(() => [
    ...(canReadOrganizations || canCreateOrganization ? [{ id: "organizations" as const, label: t("navigation.organizations") }] : []),
    ...(canReadHealth ? [{ id: "health" as const, label: t("navigation.health") }] : []),
    ...(canReadAudit ? [{ id: "audit" as const, label: t("navigation.audit") }] : []),
  ], [canCreateOrganization, canReadAudit, canReadHealth, canReadOrganizations, t]);

  useEffect(() => {
    if (session.isError) router.replace("/platform/signin");
  }, [router, session.isError]);

  const activeSection = sections.some((item) => item.id === section) ? section : sections[0]?.id ?? "organizations";

  async function signOut() {
    try {
      await logout.mutateAsync();
      router.replace("/platform/signin");
    } catch {
      setOperationMessage(t("errors.signOut"));
    }
  }

  async function runLookup(event: FormEvent<HTMLFormElement>, purpose: "create" | "standalone") {
    event.preventDefault();
    setOperationMessage("");
    setLookupPurpose(purpose);
    setSelectedUser(null);
    try {
      const user = await lookup.mutateAsync(lookupEmail.trim());
      setSelectedUser({ id: user.id, email: user.email, fullName: user.fullName });
    } catch {
      setOperationMessage(t("errors.userLookup"));
    }
  }

  async function runCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationMessage("");
    if (!selectedUser) return;
    try {
      const created = await createOrganization.mutateAsync({
        name: organizationName.trim(),
        slug: organizationSlug.trim().toLowerCase(),
        plan: organizationPlan,
        firstAdminUserId: selectedUser.id,
      });
      setSelectedOrganizationId(created.id);
      setOperationMessage(t("results.organizationCreated", { name: created.name }));
      setOrganizationName("");
      setOrganizationSlug("");
      setSelectedUser(null);
      setLookupEmail("");
    } catch (error) {
      setOperationMessage(apiMessage(error, t("errors.organizationCreate")));
    }
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    setOperationMessage("");
    try {
      await suspend.mutateAsync({
        membershipId: suspendTarget.id,
        expectedMembershipVersion: suspendTarget.version,
        reasonCode: "ACCESS_REVIEW",
      });
      setOperationMessage(t("results.membershipSuspended", { name: suspendTarget.user?.fullName ?? suspendTarget.userId }));
      setSuspendTarget(null);
    } catch (error) {
      setOperationMessage(apiMessage(error, t("errors.membershipSuspend")));
    }
  }

  if (session.isPending || session.isFetching && !session.data) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300" aria-live="polite">{t("loading")}</main>;
  }
  if (!session.data) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300" aria-live="polite">{t("sessionChecking")}</main>;
  }

  const canAccessAny = sections.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo className="h-9" priority />
            <div className="hidden border-s border-gray-200 ps-4 sm:block dark:border-gray-700">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">{t("eyebrow")}</p>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white">{t("title")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-end sm:block">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{session.data.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{session.data.email}</p>
            </div>
            <Button variant="outline" size="sm" disabled={logout.isPending} onClick={() => void signOut()}>{logout.isPending ? t("signOutPending") : t("signOut")}</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-(--breakpoint-2xl) gap-6 px-4 py-6 md:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-8">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("navigation.title")}</p>
          <nav aria-label={t("navigation.title")} className="flex gap-1 overflow-x-auto lg:flex-col">
            {sections.map((item) => (
              <button key={item.id} type="button" aria-current={activeSection === item.id ? "page" : undefined} onClick={() => setSection(item.id)} className={`shrink-0 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition ${activeSection === item.id ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-4 border-t border-gray-100 px-3 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">{t("securityNote")}</div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-400">{t("eyebrow")}</p>
              <h2 className="mt-1 text-title-md font-semibold text-gray-900 dark:text-white">{activeSection === "organizations" ? t("sections.organizations") : activeSection === "health" ? t("sections.health") : t("sections.audit")}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">{activeSection === "organizations" ? t("descriptions.organizations") : activeSection === "health" ? t("descriptions.health") : t("descriptions.audit")}</p>
            </div>
            <span className="rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300">{t("sessionActive")}</span>
          </div>

          {operationMessage && <div role="status" className="rounded-lg border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-blue-light-800 dark:border-blue-light-500/20 dark:bg-blue-light-500/10 dark:text-blue-light-200">{operationMessage}</div>}

          {!canAccessAny && <EmptyState title={t("noCapabilities.title")} body={t("noCapabilities.body")} />}

          {activeSection === "organizations" && canAccessAny && (
            <div className="space-y-5">
              {canReadOrganizations && (
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{t("organizations.directory")}</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("organizations.directoryHelp")}</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={organizations.isFetching} onClick={() => void organizations.refetch()}>{organizations.isFetching ? t("refreshing") : t("refresh")}</Button>
                  </div>
                  {organizations.isError ? <QueryError message={t("errors.organizationList")} onRetry={() => void organizations.refetch()} /> : organizations.isPending ? <LoadingRow label={t("loadingOrganizations")} /> : organizations.data?.data.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-5 py-3 text-start font-medium">{t("table.organization")}</th><th className="px-5 py-3 text-start font-medium">{t("table.plan")}</th><th className="px-5 py-3 text-start font-medium">{t("table.updated")}</th><th className="px-5 py-3 text-end font-medium">{t("table.action")}</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {organizations.data.data.map((row) => <tr key={row.id} className={effectiveSelectedOrganizationId === row.id ? "bg-brand-50/50 dark:bg-brand-500/5" : ""}>
                            <td className="px-5 py-3"><p className="font-medium text-gray-800 dark:text-gray-100">{row.name}</p><p className="text-xs text-gray-500">{row.slug}</p></td>
                            <td className="px-5 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{row.plan}</span></td>
                            <td className="px-5 py-3 text-gray-500">{new Date(row.updatedAt).toLocaleDateString()}</td>
                            <td className="px-5 py-3 text-end"><button type="button" onClick={() => setSelectedOrganizationId(row.id)} className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10">{t("organizations.open")}</button></td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState title={t("organizations.emptyTitle")} body={t("organizations.emptyBody")} />}
                </section>
              )}

              {canCreateOrganization && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-5"><h3 className="font-semibold text-gray-900 dark:text-white">{t("organizations.createTitle")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("organizations.createHelp")}</p></div>
                  <form onSubmit={(event) => void runCreateOrganization(event)} className="grid gap-4 md:grid-cols-2">
                    <div><Label htmlFor="platform-org-name">{t("organizations.name")}</Label><Input id="platform-org-name" value={organizationName} maxLength={200} required onChange={(event) => setOrganizationName(event.target.value)} /></div>
                    <div><Label htmlFor="platform-org-slug">{t("organizations.slug")}</Label><Input id="platform-org-slug" value={organizationSlug} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" required onChange={(event) => setOrganizationSlug(event.target.value)} /></div>
                    <div><Label htmlFor="platform-org-plan">{t("organizations.plan")}</Label><select id="platform-org-plan" value={organizationPlan} onChange={(event) => setOrganizationPlan(event.target.value as "FREE" | "ENTERPRISE")} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="FREE">FREE</option><option value="ENTERPRISE">ENTERPRISE</option></select></div>
                    <div className="flex items-end"><Button disabled={!selectedUser || createOrganization.isPending}>{createOrganization.isPending ? t("organizations.creating") : t("organizations.create")}</Button></div>
                  </form>
                  <div className="mt-5 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void runLookup(event, "create")}>
                      <div className="min-w-0 flex-1"><Label htmlFor="first-admin-email">{t("organizations.firstAdminEmail")}</Label><Input id="first-admin-email" type="email" maxLength={254} value={lookupEmail} required onChange={(event) => { setLookupEmail(event.target.value); setSelectedUser(null); }} /></div>
                      <Button type="submit" variant="outline" disabled={lookup.isPending}>{lookup.isPending ? t("lookingUp") : t("organizations.findFirstAdmin")}</Button>
                    </form>
                    {selectedUser && lookupPurpose === "create" && <p className="mt-3 text-sm text-success-700 dark:text-success-300">{t("organizations.selectedAdmin", { name: selectedUser.fullName, email: selectedUser.email })}</p>}
                  </div>
                </section>
              )}

              {canLookupUsers && !canCreateOrganization && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t("users.lookupTitle")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("users.lookupHelp")}</p>
                  <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void runLookup(event, "standalone")}><div className="min-w-0 flex-1"><Label htmlFor="platform-user-email">{t("users.email")}</Label><Input id="platform-user-email" type="email" maxLength={254} value={lookupEmail} required onChange={(event) => setLookupEmail(event.target.value)} /></div><Button type="submit" variant="outline" disabled={lookup.isPending}>{lookup.isPending ? t("lookingUp") : t("users.lookup")}</Button></form>
                  {selectedUser && lookupPurpose === "standalone" && <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"><p className="font-medium text-gray-800 dark:text-gray-100">{selectedUser.fullName}</p><p className="text-sm text-gray-500">{selectedUser.email}</p><p className="mt-2 text-xs text-gray-400">{t("users.activeAccount")}</p></div>}
                </section>
              )}

              {effectiveSelectedOrganizationId && organization.data && <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("organizations.selected")}</p><h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{organization.data.name}</h3><p className="mt-1 text-sm text-gray-500">{organization.data.slug} · {organization.data.plan}</p></div><Button variant="outline" size="sm" disabled={organization.isFetching} onClick={() => void organization.refetch()}>{t("refresh")}</Button></div>
                {organization.isError && <p role="alert" className="mt-3 text-sm text-error-600">{t("errors.organizationDetail")}</p>}
                {canReadMemberships && <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("memberships.title")}</h4><span className="text-xs text-gray-500">{memberships.data?.pagination.totalItems ?? 0}</span></div>
                  {memberships.isError ? <QueryError message={t("errors.membershipList")} onRetry={() => void memberships.refetch()} /> : memberships.isPending ? <LoadingRow label={t("loadingMemberships")} /> : memberships.data?.data.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-3 py-2 text-start font-medium">{t("table.member")}</th><th className="px-3 py-2 text-start font-medium">{t("table.role")}</th><th className="px-3 py-2 text-start font-medium">{t("table.status")}</th><th className="px-3 py-2 text-end font-medium">{t("table.action")}</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{memberships.data.data.map((member) => <tr key={member.id}><td className="px-3 py-3"><p className="font-medium text-gray-800 dark:text-gray-100">{member.user?.fullName ?? t("memberships.userUnavailable")}</p><p className="text-xs text-gray-500">{member.user?.email ?? member.userId}</p></td><td className="px-3 py-3 text-gray-600 dark:text-gray-300">{member.organizationRoles.length ? member.organizationRoles.join(", ") : t("table.noRole")}</td><td className="px-3 py-3"><StatusBadge status={member.status} label={t(`membershipStatus.${member.status}`)} /></td><td className="px-3 py-3 text-end">{canSuspendMemberships && member.status === "ACTIVE" && member.userId !== session.data.id ? <button type="button" onClick={() => setSuspendTarget(member)} className="rounded-md px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-error-500 dark:text-error-400 dark:hover:bg-error-500/10">{t("memberships.suspend")}</button> : <span className="text-xs text-gray-400">{member.userId === session.data.id ? t("memberships.currentOperator") : "—"}</span>}</td></tr>)}</tbody></table></div> : <EmptyState title={t("memberships.emptyTitle")} body={t("memberships.emptyBody")} />}
                </div>}
              </section>}

              {canLookupUsers && canCreateOrganization && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{t("users.lookupCreateNote")}</p>}
              {!canReadOrganizations && canCreateOrganization && !canLookupUsers && <p className="text-sm text-gray-500">{t("noCapabilities.organizationReadNeeded")}</p>}
            </div>
          )}

          {activeSection === "health" && canReadHealth && <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-900 dark:text-white">{t("health.title")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("health.description")}</p></div><Button variant="outline" size="sm" disabled={health.isFetching} onClick={() => void health.refetch()}>{t("refresh")}</Button></div>{health.isPending ? <LoadingRow label={t("health.checking")} /> : health.isError ? <QueryError message={t("errors.health")} onRetry={() => void health.refetch()} /> : <div className="mt-5 flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-4 dark:border-success-500/20 dark:bg-success-500/10"><span className="h-2.5 w-2.5 rounded-full bg-success-500" aria-hidden="true" /><div><p className="font-medium text-success-800 dark:text-success-300">{t("health.healthy")}</p><p className="text-sm text-success-700 dark:text-success-400">{t("health.iamOnly")}</p></div></div>}</section>}

          {activeSection === "audit" && canReadAudit && <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800"><div><h3 className="font-semibold text-gray-900 dark:text-white">{t("audit.title")}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("audit.boundedNote")}</p></div><Button variant="outline" size="sm" disabled={audit.isFetching} onClick={() => void audit.refetch()}>{t("refresh")}</Button></div>{audit.isError ? <QueryError message={t("errors.audit")} onRetry={() => void audit.refetch()} /> : audit.isPending ? <LoadingRow label={t("audit.loading")} /> : audit.data?.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-5 py-3 text-start font-medium">{t("table.event")}</th><th className="px-5 py-3 text-start font-medium">{t("table.target")}</th><th className="px-5 py-3 text-start font-medium">{t("table.actor")}</th><th className="px-5 py-3 text-start font-medium">{t("table.time")}</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{audit.data.map((row, index) => <tr key={`${row.action}-${row.targetResourceId}-${row.occurredAt}-${index}`}><td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{row.action}</td><td className="px-5 py-3"><p>{row.targetResource}</p><p className="text-xs text-gray-500">{row.targetResourceId}</p></td><td className="px-5 py-3 font-mono text-xs text-gray-500">{row.actorUserId}</td><td className="px-5 py-3 text-gray-500">{new Date(row.occurredAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title={t("audit.emptyTitle")} body={t("audit.emptyBody")} />}</section>}
        </section>
      </div>

      {suspendTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSuspendTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="suspend-title" className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-gray-700 dark:bg-gray-900"><h2 id="suspend-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t("memberships.confirmTitle")}</h2><p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{t("memberships.confirmBody", { name: suspendTarget.user?.fullName ?? suspendTarget.userId })}</p><p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">{t("memberships.confirmGuard")}</p><div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="outline" disabled={suspend.isPending} onClick={() => setSuspendTarget(null)}>{t("cancel")}</Button><Button type="button" disabled={suspend.isPending} onClick={() => void confirmSuspend()}>{suspend.isPending ? t("memberships.suspending") : t("memberships.confirmSuspend")}</Button></div></section></div>}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="px-5 py-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-500 dark:bg-gray-800 dark:text-gray-300" aria-hidden="true">—</div><h3 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h3><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">{body}</p></div>;
}

function LoadingRow({ label }: { label: string }) {
  return <p className="px-5 py-8 text-sm text-gray-500" role="status">{label}</p>;
}

function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("platformConsole");
  return <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert"><p className="text-sm text-error-600 dark:text-error-400">{message}</p><button type="button" onClick={onRetry} className="text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors = status === "ACTIVE"
    ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300"
    : status === "SUSPENDED"
      ? "bg-warning-50 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{label}</span>;
}
