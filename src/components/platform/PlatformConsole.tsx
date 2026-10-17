"use client";

import BrandLogo from "@/components/common/BrandLogo";
import PlatformAuditProjection from "@/components/platform/PlatformAuditProjection";
import PlatformDashboard from "@/components/platform/PlatformDashboard";
import PlatformMembershipDirectory from "@/components/platform/PlatformMembershipDirectory";
import PlatformPagination from "@/components/platform/PlatformPagination";
import PlatformUnavailablePage from "@/components/platform/PlatformUnavailablePage";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getPlatformErrorKind, platformErrorMessageKey } from "@/lib/queries/platform/platform-api";
import {
  useCreatePlatformOrganizationMutation,
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
import { useEffect, useRef, useState, type FormEvent } from "react";

const sectionIds = [
  "dashboard", "organizations", "users", "memberships", "projects", "security",
  "services", "jobs", "ai", "integrations", "incidents", "diagnostics", "audit", "account",
] as const;
type Section = (typeof sectionIds)[number];

function isSection(value: string | undefined): value is Section {
  return Boolean(value && (sectionIds as readonly string[]).includes(value));
}

function has(session: { permissions: readonly PlatformPermission[] } | undefined, permission: PlatformPermission) {
  return Boolean(session?.permissions.includes(permission));
}

function apiMessage(error: unknown, fallback: string, translate: (key: string) => string): string {
  return translate(platformErrorMessageKey(error, fallback));
}

export default function PlatformConsole() {
  const t = useTranslations("platformConsole");
  const router = useRouter();
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);
  const routeSection = pathSegments[1];
  const activeSection: Section = isSection(routeSection) ? routeSection : "dashboard";
  const routeOrganizationId = activeSection === "organizations" ? pathSegments[2] ?? "" : "";
  const hasValidRouteOrganizationId = /^[a-f\d]{24}$/i.test(routeOrganizationId);
  const session = usePlatformSessionQuery();
  const logout = usePlatformLogoutMutation();
  const canReadOrganizations = has(session.data, "platform.organizations.organization.read");
  const canCreateOrganization = has(session.data, "organization.create");
  const canLookupUsers = has(session.data, "platform.users.account.read");
  const canReadMemberships = has(session.data, "platform.memberships.membership.read");
  const canSuspendMemberships = has(session.data, "platform.memberships.lifecycle.manage");
  const canReadHealth = has(session.data, "platform.health.read");
  const shouldLoadOrganizations = ["organizations", "memberships"].includes(activeSection);
  const shouldLoadHealth = activeSection === "services";
  const [organizationPage, setOrganizationPage] = useState(1);
  const [detailMembershipPageState, setDetailMembershipPageState] = useState({ organizationId: routeOrganizationId, page: 1 });
  const detailMembershipPage = detailMembershipPageState.organizationId === routeOrganizationId ? detailMembershipPageState.page : 1;
  const setDetailMembershipPage = (page: number) => setDetailMembershipPageState({ organizationId: routeOrganizationId, page });
  const organizations = usePlatformOrganizationsQuery(canReadOrganizations && shouldLoadOrganizations, organizationPage);
  const health = usePlatformHealthQuery(canReadHealth && shouldLoadHealth);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; fullName: string } | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationPlan, setOrganizationPlan] = useState<"FREE" | "ENTERPRISE">("FREE");
  const [suspendTarget, setSuspendTarget] = useState<PlatformMembership | null>(null);
  const [operationMessage, setOperationMessage] = useState("");
  const lookupRequestId = useRef(0);
  const organizationRows = organizations.data?.data ?? [];
  const effectiveSelectedOrganizationId = routeOrganizationId || (activeSection === "memberships" ? selectedOrganizationId || organizationRows[0]?.id : "") || "";
  const organization = usePlatformOrganizationQuery(effectiveSelectedOrganizationId, canReadOrganizations && activeSection === "organizations" && Boolean(effectiveSelectedOrganizationId));
  const memberships = usePlatformMembershipsQuery(effectiveSelectedOrganizationId, canReadOrganizations && canReadMemberships && activeSection === "organizations" && hasValidRouteOrganizationId, detailMembershipPage);
  const lookup = usePlatformUserLookupMutation();
  const createOrganization = useCreatePlatformOrganizationMutation();
  const suspend = useSuspendPlatformMembershipMutation(effectiveSelectedOrganizationId);

  const navigationGroups = [
    { title: t("navigation.dashboardGroup"), items: [{ id: "dashboard" as const, href: "/platform", label: t("navigation.dashboard") }] },
    { title: t("navigation.administrationGroup"), items: [
      { id: "organizations" as const, href: "/platform/organizations", label: t("navigation.organizations") },
      { id: "users" as const, href: "/platform/users", label: t("navigation.users") },
      { id: "memberships" as const, href: "/platform/memberships", label: t("navigation.memberships") },
      { id: "projects" as const, href: "/platform/projects", label: t("navigation.projects") },
    ] },
    { title: t("navigation.securityGroup"), items: [{ id: "security" as const, href: "/platform/security", label: t("navigation.security") }] },
    { title: t("navigation.operationsGroup"), items: [
      { id: "services" as const, href: "/platform/services", label: t("navigation.services") },
      { id: "jobs" as const, href: "/platform/jobs", label: t("navigation.jobs") },
      { id: "ai" as const, href: "/platform/ai", label: t("navigation.ai") },
      { id: "integrations" as const, href: "/platform/integrations", label: t("navigation.integrations") },
      { id: "incidents" as const, href: "/platform/incidents", label: t("navigation.incidents") },
    ] },
    { title: t("navigation.supportGroup"), items: [{ id: "diagnostics" as const, href: "/platform/diagnostics", label: t("navigation.diagnostics") }] },
    { title: t("navigation.auditGroup"), items: [{ id: "audit" as const, href: "/platform/audit", label: t("navigation.audit") }] },
    { title: t("navigation.accountGroup"), items: [{ id: "account" as const, href: "/platform/account", label: t("navigation.account") }] },
  ];

  const sessionErrorKind = getPlatformErrorKind(session.error);
  const needsSignIn = session.isError && ["unauthenticated", "forbidden"].includes(sessionErrorKind);

  useEffect(() => {
    if (needsSignIn) router.replace("/platform/signin");
  }, [needsSignIn, router]);

  const pageTitle = t(`pages.${activeSection}.title`);
  const pageDescription = t(`pages.${activeSection}.description`);

  async function signOut() {
    try {
      await logout.mutateAsync();
      router.replace("/platform/signin");
    } catch (error) {
      if (getPlatformErrorKind(error) === "unauthenticated") {
        router.replace("/platform/signin");
        return;
      }
      setOperationMessage(apiMessage(error, "errors.signOut", t));
    }
  }

  async function runLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationMessage("");
    setSelectedUser(null);
    const requestId = ++lookupRequestId.current;
    const requestedEmail = lookupEmail.trim();
    try {
      const user = await lookup.mutateAsync(requestedEmail);
      if (requestId !== lookupRequestId.current) return;
      setSelectedUser({ id: user.id, email: user.email, fullName: user.fullName });
    } catch (error) {
      if (requestId !== lookupRequestId.current) return;
      setOperationMessage(getPlatformErrorKind(error) === "notFound"
        ? t("errors.userLookup")
        : apiMessage(error, "errors.userLookup", t));
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
      setOperationMessage(apiMessage(error, "errors.organizationCreate", t));
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
      setOperationMessage(apiMessage(error, "errors.membershipSuspend", t));
    }
  }

  if (session.isPending || session.isFetching && !session.data) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300" aria-live="polite">{t("loading")}</main>;
  }
  if (session.isError) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300" role="alert" aria-live="polite">
      <p>{needsSignIn ? t("sessionChecking") : t(platformErrorMessageKey(session.error, "errors.server"))}</p>
      {!needsSignIn && <Button variant="outline" size="sm" onClick={() => void session.refetch()}>{t("retry")}</Button>}
    </main>;
  }
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
          <nav aria-label={t("navigation.title")} className="no-scrollbar flex gap-3 overflow-x-auto lg:flex-col lg:gap-4">
            {navigationGroups.map((group) => (
              <div key={group.title} className="shrink-0 lg:shrink">
                <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase lg:block">{group.title}</p>
                <div className="flex gap-1 lg:flex-col">
                  {group.items.map((item) => (
                    <Link key={item.id} href={item.href} aria-current={activeSection === item.id ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition ${activeSection === item.id ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"}`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-4 border-t border-gray-100 px-3 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">{t("securityNote")}</div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-400">{t("eyebrow")}</p>
              <h2 className="mt-1 text-title-md font-semibold text-gray-900 dark:text-white">{pageTitle}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">{pageDescription}</p>
            </div>
            <span className="rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300">{t("sessionActive")}</span>
          </div>

          {operationMessage && <div role="status" className="rounded-lg border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-blue-light-800 dark:border-blue-light-500/20 dark:bg-blue-light-500/10 dark:text-blue-light-200">{operationMessage}</div>}

          {activeSection === "dashboard" && <PlatformDashboard permissions={session.data.permissions} />}

          {activeSection === "organizations" && (
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
                  {organizations.isError ? <QueryError error={organizations.error} fallbackKey="errors.organizationList" onRetry={() => void organizations.refetch()} /> : organizations.isPending ? <LoadingRow label={t("loadingOrganizations")} /> : organizations.data?.data.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-5 py-3 text-start font-medium">{t("table.organization")}</th><th className="px-5 py-3 text-start font-medium">{t("table.plan")}</th><th className="px-5 py-3 text-start font-medium">{t("table.updated")}</th><th className="px-5 py-3 text-end font-medium">{t("table.action")}</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {organizations.data.data.map((row) => <tr key={row.id} className={routeOrganizationId === row.id ? "bg-brand-50/50 dark:bg-brand-500/5" : ""}>
                            <td className="px-5 py-3"><p className="font-medium text-gray-800 dark:text-gray-100">{row.name}</p><p className="text-xs text-gray-500">{row.slug}</p></td>
                            <td className="px-5 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{row.plan}</span></td>
                            <td className="px-5 py-3 text-gray-500">{new Date(row.updatedAt).toLocaleDateString()}</td>
                            <td className="px-5 py-3 text-end"><Link href={`/platform/organizations/${row.id}`} className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10">{t("organizations.open")}</Link></td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState title={t("organizations.emptyTitle")} body={t("organizations.emptyBody")} />}
                  {organizations.data?.pagination && <PlatformPagination ariaLabel={t("organizations.directory")} page={organizations.data.pagination.page} totalPages={organizations.data.pagination.totalPages} totalItems={organizations.data.pagination.totalItems} onPageChange={setOrganizationPage} />}
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
                    {canLookupUsers ? <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void runLookup(event)}>
                      <div className="min-w-0 flex-1"><Label htmlFor="first-admin-email">{t("organizations.firstAdminEmail")}</Label><Input id="first-admin-email" type="email" maxLength={254} value={lookupEmail} required onChange={(event) => { lookupRequestId.current += 1; setLookupEmail(event.target.value); setSelectedUser(null); setOperationMessage(""); }} /></div>
                      <Button type="submit" variant="outline" disabled={lookup.isPending}>{lookup.isPending ? t("lookingUp") : t("organizations.findFirstAdmin")}</Button>
                    </form> : <PermissionNotice message={t("users.accountLookupPermissionNeeded")} />}
                    {selectedUser && <p className="mt-3 text-sm text-success-700 dark:text-success-300">{t("organizations.selectedAdmin", { name: selectedUser.fullName, email: selectedUser.email })}</p>}
                  </div>
                </section>
              )}

              {routeOrganizationId && !canReadOrganizations && <PermissionNotice message={t("pages.organizations.readPermissionNeeded")} />}
              {routeOrganizationId && !hasValidRouteOrganizationId && <div role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">{t("errors.invalidOrganizationId")}</div>}
              {hasValidRouteOrganizationId && canReadOrganizations && organization.isPending && <LoadingRow label={t("loadingOrganizationDetail")} />}
              {hasValidRouteOrganizationId && canReadOrganizations && organization.isError && <QueryError error={organization.error} fallbackKey="errors.organizationDetail" onRetry={() => void organization.refetch()} />}
              {hasValidRouteOrganizationId && organization.data && !canReadMemberships && <PermissionNotice message={t("memberships.readPermissionNeeded")} />}
              {hasValidRouteOrganizationId && organization.data && <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("organizations.selected")}</p><h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{organization.data.name}</h3><p className="mt-1 text-sm text-gray-500">{organization.data.slug} · {organization.data.plan}</p></div><Button variant="outline" size="sm" disabled={organization.isFetching} onClick={() => void organization.refetch()}>{t("refresh")}</Button></div>
                {organization.isError && <p role="alert" className="mt-3 text-sm text-error-600">{t("errors.organizationDetail")}</p>}
                {canReadMemberships && <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("memberships.title")}</h4><span className="text-xs text-gray-500">{memberships.data?.pagination.totalItems ?? 0}</span></div>
                  {memberships.isError ? <QueryError error={memberships.error} fallbackKey="errors.membershipList" onRetry={() => void memberships.refetch()} /> : memberships.isPending ? <LoadingRow label={t("loadingMemberships")} /> : memberships.data?.data.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-3 py-2 text-start font-medium">{t("table.member")}</th><th className="px-3 py-2 text-start font-medium">{t("table.role")}</th><th className="px-3 py-2 text-start font-medium">{t("table.status")}</th><th className="px-3 py-2 text-end font-medium">{t("table.action")}</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{memberships.data.data.map((member) => <tr key={member.id}><td className="px-3 py-3"><p className="font-medium text-gray-800 dark:text-gray-100">{member.user?.fullName ?? t("memberships.userUnavailable")}</p><p className="text-xs text-gray-500">{member.user?.email ?? member.userId}</p></td><td className="px-3 py-3 text-gray-600 dark:text-gray-300">{member.organizationRoles.length ? member.organizationRoles.join(", ") : t("table.noRole")}</td><td className="px-3 py-3"><StatusBadge status={member.status} label={t(`membershipStatus.${member.status}`)} /></td><td className="px-3 py-3 text-end">{canSuspendMemberships && member.status === "ACTIVE" && member.userId !== session.data.id ? <button type="button" onClick={() => setSuspendTarget(member)} className="rounded-md px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-error-500 dark:text-error-400 dark:hover:bg-error-500/10">{t("memberships.suspend")}</button> : <span className="text-xs text-gray-400">{member.userId === session.data.id ? t("memberships.currentOperator") : "—"}</span>}</td></tr>)}</tbody></table></div> : <EmptyState title={t("memberships.emptyTitle")} body={t("memberships.emptyBody")} />}
                  {memberships.data?.pagination && <PlatformPagination ariaLabel={t("memberships.title")} page={memberships.data.pagination.page} totalPages={memberships.data.pagination.totalPages} totalItems={memberships.data.pagination.totalItems} onPageChange={setDetailMembershipPage} />}
                </div>}
              </section>}

              {canLookupUsers && canCreateOrganization && <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{t("users.lookupCreateNote")}</p>}
              {!canReadOrganizations && canCreateOrganization && !canLookupUsers && <p className="text-sm text-gray-500">{t("noCapabilities.organizationReadNeeded")}</p>}
              {!canReadOrganizations && <p className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">{t("pages.organizations.readPermissionNeeded")}</p>}
              <PlatformUnavailablePage partial items={[t("capabilities.organizationMetadata"), t("capabilities.organizationLifecycle"), t("capabilities.organizationInvitations"), t("capabilities.organizationMembershipRoles")]} title={t("capabilities.organizationTitle")} description={t("capabilities.organizationDescription")} dependency={t("capabilities.organizationDependency")} />
            </div>
          )}

          {activeSection === "users" && <div className="space-y-5">
            <PlatformUnavailablePage partial items={[t("capabilities.userDirectory"), t("capabilities.userDetail"), t("capabilities.userStatus"), t("capabilities.userMemberships"), t("capabilities.userSessions")]} title={t("capabilities.userTitle")} description={t("capabilities.userDescription")} dependency={t("capabilities.userDependency")} />
          </div>}

          {activeSection === "memberships" && <div className="space-y-5">
            <PlatformMembershipDirectory organizations={organizations.data} organizationsLoading={organizations.isPending} organizationsError={organizations.error} onRetryOrganizations={() => void organizations.refetch()} organizationPage={organizationPage} onOrganizationPageChange={(page) => { setOrganizationPage(page); setSelectedOrganizationId(""); }} organizationId={effectiveSelectedOrganizationId} canReadOrganizations={canReadOrganizations} canReadMemberships={canReadMemberships} canSuspendMemberships={canSuspendMemberships} currentUserId={session.data.id} onOrganizationChange={setSelectedOrganizationId} onSuspend={setSuspendTarget} />
          </div>}

          {activeSection === "projects" && <PlatformUnavailablePage items={[t("capabilities.projectDirectory"), t("capabilities.projectMetadata"), t("capabilities.projectVisibility"), t("capabilities.projectAccess")]} title={t("capabilities.projectTitle")} description={t("capabilities.projectDescription")} dependency={t("capabilities.projectDependency")} />}

          {activeSection === "security" && <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-900 dark:text-white">{t("security.currentSession")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("security.currentSessionNote")}</p></div><span className="rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300">{t("sessionActive")}</span></div><dl className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 dark:border-gray-800"><DetailField label={t("account.operator")} value={session.data.name} /><DetailField label={t("account.email")} value={session.data.email} /><DetailField label={t("account.context")} value={session.data.context} /><DetailField label={t("account.permissionCount")} value={String(session.data.permissions.length)} /></dl></section>
            <PlatformUnavailablePage partial items={[t("capabilities.securityOtherSessions"), t("capabilities.securityRevoke"), t("capabilities.securityAnomalies"), t("capabilities.securityEvents")]} title={t("capabilities.securityTitle")} description={t("capabilities.securityDescription")} dependency={t("capabilities.securityDependency")} />
          </div>}

          {activeSection === "services" && <div className="space-y-5">
            {canReadHealth ? <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-900 dark:text-white">{t("health.title")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("health.description")}</p></div><Button variant="outline" size="sm" disabled={health.isFetching} onClick={() => void health.refetch()}>{t("refresh")}</Button></div>{health.isPending ? <LoadingRow label={t("health.checking")} /> : health.isError ? <QueryError error={health.error} fallbackKey="errors.health" onRetry={() => void health.refetch()} /> : <div className="mt-5 flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-4 dark:border-success-500/20 dark:bg-success-500/10"><span className="h-2.5 w-2.5 rounded-full bg-success-500" aria-hidden="true" /><div><p className="font-medium text-success-800 dark:text-success-300">{t("health.healthy")}</p><p className="text-sm text-success-700 dark:text-success-400">{t("health.iamOnly")}</p></div></div>}</section> : <PermissionNotice message={t("pages.services.permissionNeeded")} />}
            <PlatformUnavailablePage partial items={[t("capabilities.serviceStatus"), t("capabilities.serviceDependencies"), t("capabilities.serviceDiagnostics")]} title={t("capabilities.serviceTitle")} description={t("capabilities.serviceDescription")} dependency={t("capabilities.serviceDependency")} />
          </div>}

          {activeSection === "jobs" && <PlatformUnavailablePage items={[t("capabilities.jobsDirectory"), t("capabilities.jobsStatus"), t("capabilities.jobsRetry"), t("capabilities.jobsCancel"), t("capabilities.queueStatus")]} title={t("capabilities.jobsTitle")} description={t("capabilities.jobsDescription")} dependency={t("capabilities.jobsDependency")} />}
          {activeSection === "ai" && <PlatformUnavailablePage items={[t("capabilities.aiRag"), t("capabilities.aiIndex"), t("capabilities.aiModels"), t("capabilities.aiProcessing")]} title={t("capabilities.aiTitle")} description={t("capabilities.aiDescription")} dependency={t("capabilities.aiDependency")} />}
          {activeSection === "integrations" && <PlatformUnavailablePage items={[t("capabilities.integrationDirectory"), t("capabilities.integrationStatus"), t("capabilities.integrationTest"), t("capabilities.integrationReconnect")]} title={t("capabilities.integrationTitle")} description={t("capabilities.integrationDescription")} dependency={t("capabilities.integrationDependency")} />}
          {activeSection === "incidents" && <PlatformUnavailablePage items={[t("capabilities.incidentDirectory"), t("capabilities.incidentLifecycle"), t("capabilities.incidentNotes"), t("capabilities.incidentAudit")]} title={t("capabilities.incidentTitle")} description={t("capabilities.incidentDescription")} dependency={t("capabilities.incidentDependency")} />}
          {activeSection === "diagnostics" && <PlatformUnavailablePage items={[t("capabilities.diagnosticsTrace"), t("capabilities.diagnosticsTools"), t("capabilities.diagnosticsOutput")]} title={t("capabilities.diagnosticsTitle")} description={t("capabilities.diagnosticsDescription")} dependency={t("capabilities.diagnosticsDependency")} />}

          {activeSection === "audit" && <PlatformAuditProjection permissions={session.data.permissions} />}

          {activeSection === "account" && <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><h3 className="font-semibold text-gray-900 dark:text-white">{t("account.identityTitle")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("account.identityNote")}</p><dl className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 dark:border-gray-800"><DetailField label={t("account.operator")} value={session.data.name} /><DetailField label={t("account.email")} value={session.data.email} /><DetailField label={t("account.context")} value={session.data.context} /><DetailField label={t("account.sessionStatus")} value={t("sessionActive")} /></dl></section>
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"><h3 className="font-semibold text-gray-900 dark:text-white">{t("account.permissionTitle")}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("account.permissionNote")}</p><ul className="mt-4 flex flex-wrap gap-2">{session.data.permissions.map((permission) => <li key={permission} className="rounded-md bg-gray-100 px-2.5 py-1.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{permission}</li>)}</ul></section>
          </div>}
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

function QueryError({ error, fallbackKey, onRetry }: { error: unknown; fallbackKey: string; onRetry: () => void }) {
  const t = useTranslations("platformConsole");
  return <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert"><p className="text-sm text-error-600 dark:text-error-400">{t(platformErrorMessageKey(error, fallbackKey))}</p><button type="button" onClick={onRetry} className="text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors = status === "ACTIVE"
    ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300"
    : status === "SUSPENDED"
      ? "bg-warning-50 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>{label}</span>;
}

function PermissionNotice({ message }: { message: string }) {
  return <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">{message}</p>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{value}</dd></div>;
}
