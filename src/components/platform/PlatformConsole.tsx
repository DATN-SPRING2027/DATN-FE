"use client";

import PlatformAuditProjection from "@/components/platform/PlatformAuditProjection";
import PlatformDashboard from "@/components/platform/PlatformDashboard";
import PlatformMembershipDirectory from "@/components/platform/PlatformMembershipDirectory";
import PlatformOperationsDirectory from "@/components/platform/PlatformOperationsDirectory";
import PlatformPagination from "@/components/platform/PlatformPagination";
import PlatformUnavailablePage from "@/components/platform/PlatformUnavailablePage";
import PlatformShell from "@/components/platform/ui/PlatformShell";
import PageHeader from "@/components/platform/ui/PageHeader";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import EmptyState from "@/components/platform/ui/EmptyState";
import { TableSkeleton } from "@/components/platform/ui/LoadingSkeleton";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import {
  usePlatformChangeOrganizationMetadataMutation,
  usePlatformOrganizationInvitationsQuery,
} from "@/lib/queries/platform/usePlatformOperations";
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
import { useEffect, useState, type FormEvent } from "react";

const sectionIds = [
  "dashboard",
  "organizations",
  "users",
  "memberships",
  "projects",
  "security",
  "services",
  "jobs",
  "ai",
  "integrations",
  "incidents",
  "diagnostics",
  "audit",
  "account",
] as const;
type Section = (typeof sectionIds)[number];

function isSection(value: string | undefined): value is Section {
  return Boolean(value && (sectionIds as readonly string[]).includes(value));
}

function has(
  session: { permissions: readonly PlatformPermission[] } | undefined,
  permission: PlatformPermission,
) {
  return Boolean(session?.permissions.includes(permission));
}

function apiMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 403) return fallback;
  if (error.status === 404) return fallback;
  if (error.status === 409) return fallback;
  return fallback;
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function PlatformConsole() {
  const t = useTranslations("platformConsole");
  const router = useRouter();
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);
  const routeSection = pathSegments[1];
  const activeSection: Section = isSection(routeSection)
    ? routeSection
    : "dashboard";
  const routeOrganizationId =
    activeSection === "organizations" ? (pathSegments[2] ?? "") : "";
  const hasValidRouteOrganizationId = /^[a-f\d]{24}$/i.test(
    routeOrganizationId,
  );
  const session = usePlatformSessionQuery();
  const logout = usePlatformLogoutMutation();
  const canReadOrganizations = has(
    session.data,
    "platform.organizations.organization.read",
  );
  const canManageOrganizations = has(
    session.data,
    "platform.organizations.organization.manage",
  );
  const canCreateOrganization = has(session.data, "organization.create");
  const canLookupUsers = has(session.data, "platform.users.account.read");
  const canReadMemberships = has(
    session.data,
    "platform.memberships.membership.read",
  );
  const canSuspendMemberships = has(
    session.data,
    "platform.memberships.lifecycle.manage",
  );
  const canReadHealth = has(session.data, "platform.health.read");
  const shouldLoadOrganizations = ["organizations", "memberships"].includes(
    activeSection,
  );
  const shouldLoadHealth = activeSection === "services";
  const [organizationPage, setOrganizationPage] = useState(1);
  const [detailMembershipPageState, setDetailMembershipPageState] = useState({
    organizationId: routeOrganizationId,
    page: 1,
  });
  const detailMembershipPage =
    detailMembershipPageState.organizationId === routeOrganizationId
      ? detailMembershipPageState.page
      : 1;
  const setDetailMembershipPage = (page: number) =>
    setDetailMembershipPageState({ organizationId: routeOrganizationId, page });
  const organizations = usePlatformOrganizationsQuery(
    canReadOrganizations && shouldLoadOrganizations,
    organizationPage,
  );
  const health = usePlatformHealthQuery(canReadHealth && shouldLoadHealth);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    email: string;
    fullName: string;
  } | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationPlan, setOrganizationPlan] = useState<
    "FREE" | "ENTERPRISE"
  >("FREE");
  const [suspendTarget, setSuspendTarget] = useState<PlatformMembership | null>(
    null,
  );
  const [operationMessage, setOperationMessage] = useState("");
  const organizationRows = organizations.data?.data ?? [];
  const effectiveSelectedOrganizationId =
    routeOrganizationId ||
    (activeSection === "memberships"
      ? selectedOrganizationId || organizationRows[0]?.id
      : "") ||
    "";
  const organization = usePlatformOrganizationQuery(
    effectiveSelectedOrganizationId,
    canReadOrganizations &&
      activeSection === "organizations" &&
      Boolean(effectiveSelectedOrganizationId),
  );
  const organizationInvitations = usePlatformOrganizationInvitationsQuery(
    effectiveSelectedOrganizationId,
    activeSection === "organizations" &&
      hasValidRouteOrganizationId &&
      canReadMemberships,
    1,
  );
  const changeOrganizationMetadata =
    usePlatformChangeOrganizationMetadataMutation();
  const memberships = usePlatformMembershipsQuery(
    effectiveSelectedOrganizationId,
    canReadOrganizations &&
      canReadMemberships &&
      activeSection === "organizations" &&
      hasValidRouteOrganizationId,
    detailMembershipPage,
  );
  const lookup = usePlatformUserLookupMutation();
  const createOrganization = useCreatePlatformOrganizationMutation();
  const suspend = useSuspendPlatformMembershipMutation(
    effectiveSelectedOrganizationId,
  );

  useEffect(() => {
    if (session.isError) router.replace("/platform/signin");
  }, [router, session.isError]);

  const pageTitle = t(`pages.${activeSection}.title`);
  const pageDescription = t(`pages.${activeSection}.description`);

  async function signOut() {
    try {
      await logout.mutateAsync();
      router.replace("/platform/signin");
    } catch {
      setOperationMessage(t("errors.signOut"));
    }
  }

  async function runLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationMessage("");
    setSelectedUser(null);
    try {
      const user = await lookup.mutateAsync(lookupEmail.trim());
      setSelectedUser({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });
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
      setOperationMessage(
        t("results.organizationCreated", { name: created.name }),
      );
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
      setOperationMessage(
        t("results.membershipSuspended", {
          name: suspendTarget.user?.fullName ?? suspendTarget.userId,
        }),
      );
      setSuspendTarget(null);
    } catch (error) {
      setOperationMessage(apiMessage(error, t("errors.membershipSuspend")));
    }
  }

  if (session.isPending || (session.isFetching && !session.data)) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300"
        aria-live="polite"
      >
        {t("loading")}
      </main>
    );
  }
  if (session.isError || !session.data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300"
        aria-live="polite"
      >
        {t("sessionChecking")}
      </main>
    );
  }

  const getSectionCategory = (section: Section): string => {
    switch (section) {
      case "dashboard":
        return "Overview";
      case "organizations":
      case "users":
      case "memberships":
      case "projects":
        return "Administration";
      case "security":
        return "Security";
      case "services":
      case "jobs":
      case "ai":
      case "integrations":
      case "incidents":
        return "Operations";
      case "diagnostics":
        return "Support";
      case "audit":
        return "Governance";
      case "account":
        return "Account";
      default:
        return "Platform";
    }
  };

  return (
    <PlatformShell
      activeSection={activeSection}
      operatorName={session.data.name}
      operatorEmail={session.data.email}
      isSigningOut={logout.isPending}
      onSignOut={() => void signOut()}
    >
      {/* Top Page Header */}
      <PageHeader
        category={getSectionCategory(activeSection)}
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
            {activeSection === "organizations" && canReadOrganizations && (
              <Button
                variant="outline"
                size="sm"
                disabled={organizations.isFetching}
                onClick={() => void organizations.refetch()}
                className="h-8 text-xs"
              >
                {organizations.isFetching ? t("refreshing") : t("refresh")}
              </Button>
            )}
            {activeSection === "services" && canReadHealth && (
              <Button
                variant="outline"
                size="sm"
                disabled={health.isFetching}
                onClick={() => void health.refetch()}
                className="h-8 text-xs"
              >
                {health.isFetching ? t("refreshing") : t("refresh")}
              </Button>
            )}
          </div>
        }
      />

      {/* Operation Notice / Toast Banner */}
      {operationMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-xs font-medium text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <span>{operationMessage}</span>
          <button
            type="button"
            onClick={() => setOperationMessage("")}
            className="text-brand-600 hover:text-brand-800 dark:text-brand-400"
          >
            ×
          </button>
        </div>
      )}

      {/* DASHBOARD ROUTE */}
      {activeSection === "dashboard" && (
        <PlatformDashboard permissions={session.data.permissions} />
      )}

      {/* ORGANIZATIONS ROUTE */}
      {activeSection === "organizations" && (
        <div className="space-y-6">
          {canReadOrganizations && (
            <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("organizations.directory")}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("organizations.directoryHelp")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={organizations.isFetching}
                  onClick={() => void organizations.refetch()}
                  className="h-8 text-xs"
                >
                  {organizations.isFetching ? t("refreshing") : t("refresh")}
                </Button>
              </div>

              {organizations.isError ? (
                <QueryError
                  message={t("errors.organizationList")}
                  onRetry={() => void organizations.refetch()}
                />
              ) : organizations.isPending ? (
                <div>
                  <p role="status" className="sr-only">
                    {t("loadingOrganizations")}
                  </p>
                  <TableSkeleton rows={4} columns={4} />
                </div>
              ) : organizations.data?.data.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                      <tr>
                        <th className="px-5 py-3 text-start">
                          {t("table.organization")}
                        </th>
                        <th className="px-5 py-3 text-start">
                          {t("table.plan")}
                        </th>
                        <th className="px-5 py-3 text-start">
                          {t("table.updated")}
                        </th>
                        <th className="px-5 py-3 text-end">
                          {t("table.action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {organizations.data.data.map((row) => (
                        <tr
                          key={row.id}
                          className={`transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02] ${
                            routeOrganizationId === row.id
                              ? "bg-brand-50/40 dark:bg-brand-500/5"
                              : ""
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                                {getInitials(row.name)}
                              </span>
                              <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {row.name}
                                </p>
                                <p className="font-mono text-[10px] text-gray-400">
                                  {row.slug}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {row.plan}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">
                            {new Date(row.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5 text-end">
                            <Link
                              href={`/platform/organizations/${row.id}`}
                              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
                            >
                              {t("organizations.open")} →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={t("organizations.emptyTitle")}
                  body={t("organizations.emptyBody")}
                />
              )}

              {organizations.data?.pagination && (
                <PlatformPagination
                  ariaLabel={t("organizations.directory")}
                  page={organizations.data.pagination.page}
                  totalPages={organizations.data.pagination.totalPages}
                  totalItems={organizations.data.pagination.totalItems}
                  onPageChange={setOrganizationPage}
                />
              )}
            </section>
          )}

          {/* Create Organization Section */}
          {canCreateOrganization && (
            <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("organizations.createTitle")}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("organizations.createHelp")}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  organization.create
                </span>
              </div>

              <form
                onSubmit={(event) => void runCreateOrganization(event)}
                className="grid gap-4 md:grid-cols-3"
              >
                <div>
                  <Label htmlFor="platform-org-name">
                    {t("organizations.name")}
                  </Label>
                  <Input
                    id="platform-org-name"
                    value={organizationName}
                    maxLength={200}
                    required
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="platform-org-slug">
                    {t("organizations.slug")}
                  </Label>
                  <Input
                    id="platform-org-slug"
                    value={organizationSlug}
                    maxLength={100}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                    onChange={(event) =>
                      setOrganizationSlug(event.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="platform-org-plan">
                    {t("organizations.plan")}
                  </Label>
                  <select
                    id="platform-org-plan"
                    value={organizationPlan}
                    onChange={(event) =>
                      setOrganizationPlan(
                        event.target.value as "FREE" | "ENTERPRISE",
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="FREE">FREE</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>

                <div className="flex items-center justify-end pt-2 md:col-span-3">
                  <Button
                    disabled={!selectedUser || createOrganization.isPending}
                    className="h-10 px-5 text-xs font-semibold"
                  >
                    {createOrganization.isPending
                      ? t("organizations.creating")
                      : t("organizations.create")}
                  </Button>
                </div>
              </form>

              {/* First ADMIN Lookup Block */}
              <div className="dark:bg-gray-850/60 mt-5 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800">
                {canLookupUsers ? (
                  <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(event) => void runLookup(event)}
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="first-admin-email">
                        {t("organizations.firstAdminEmail")}
                      </Label>
                      <Input
                        id="first-admin-email"
                        type="email"
                        maxLength={254}
                        value={lookupEmail}
                        required
                        onChange={(event) => {
                          setLookupEmail(event.target.value);
                          setSelectedUser(null);
                        }}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={lookup.isPending}
                      className="h-11 text-xs"
                    >
                      {lookup.isPending
                        ? t("lookingUp")
                        : t("organizations.findFirstAdmin")}
                    </Button>
                  </form>
                ) : (
                  <PermissionNotice
                    message={t("users.accountLookupPermissionNeeded")}
                  />
                )}

                {selectedUser && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>
                      {t("organizations.selectedAdmin", {
                        name: selectedUser.fullName,
                        email: selectedUser.email,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {routeOrganizationId && !canReadOrganizations && (
            <PermissionNotice
              message={t("pages.organizations.readPermissionNeeded")}
            />
          )}

          {routeOrganizationId && !hasValidRouteOrganizationId && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {t("errors.invalidOrganizationId")}
            </div>
          )}

          {hasValidRouteOrganizationId &&
            canReadOrganizations &&
            organization.isPending && (
              <p role="status" className="px-5 py-8 text-xs text-gray-500">
                {t("loadingOrganizationDetail")}
              </p>
            )}

          {hasValidRouteOrganizationId &&
            canReadOrganizations &&
            organization.isError && (
              <QueryError
                message={t("errors.organizationDetail")}
                onRetry={() => void organization.refetch()}
              />
            )}

          {hasValidRouteOrganizationId &&
            organization.data &&
            !canReadMemberships && (
              <PermissionNotice
                message={t("memberships.readPermissionNeeded")}
              />
            )}

          {hasValidRouteOrganizationId && organization.data && (
            <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    {getInitials(organization.data.name)}
                  </span>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                      {t("organizations.selected")}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {organization.data.name}
                    </h3>
                    <p className="font-mono text-xs text-gray-400">
                      {organization.data.slug} · Plan: {organization.data.plan}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={organization.isFetching}
                  onClick={() => void organization.refetch()}
                  className="h-8 text-xs"
                >
                  {t("refresh")}
                </Button>
              </div>

              {canManageOrganizations && (
                <form
                  className="mt-5 flex flex-wrap items-end gap-3 border-b border-gray-100 pb-5 dark:border-gray-800"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void changeOrganizationMetadata
                      .mutateAsync({
                        organizationId: organization.data!.id,
                        name: String(formData.get("name") ?? "").trim(),
                        slug: String(formData.get("slug") ?? "").trim(),
                        expectedUpdatedAt: organization.data!.updatedAt,
                        reasonCode: "ACCESS_REVIEW",
                      })
                      .then(() =>
                        setOperationMessage(
                          "Organization metadata updated and audit state refreshed.",
                        ),
                      )
                      .catch((error: unknown) =>
                        setOperationMessage(
                          apiMessage(error, t("errors.organizationDetail")),
                        ),
                      );
                  }}
                >
                  <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-gray-500">
                    Display name
                    <Input
                      name="name"
                      defaultValue={organization.data.name}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-gray-500">
                    Slug
                    <Input
                      name="slug"
                      defaultValue={organization.data.slug}
                      maxLength={100}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={changeOrganizationMetadata.isPending}
                  >
                    {changeOrganizationMetadata.isPending
                      ? t("saving")
                      : "Save metadata"}
                  </Button>
                </form>
              )}

              {canReadMemberships && (
                <div className="mt-5 border-b border-gray-100 pb-5 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Pending invitations
                      </h4>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Safe invitation metadata only; tokens are never
                        returned.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={organizationInvitations.isFetching}
                      onClick={() => void organizationInvitations.refetch()}
                    >
                      {t("refresh")}
                    </Button>
                  </div>
                  {organizationInvitations.isPending ? (
                    <p role="status" className="mt-3 text-xs text-gray-500">
                      Loading invitations…
                    </p>
                  ) : organizationInvitations.isError ? (
                    <QueryError
                      message="Pending invitations could not be loaded."
                      onRetry={() => void organizationInvitations.refetch()}
                    />
                  ) : organizationInvitations.data?.data.length ? (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {organizationInvitations.data.data.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800"
                        >
                          <strong>{invitation.email}</strong>
                          <span className="mt-1 block text-gray-500">
                            Pending · expires{" "}
                            {new Date(invitation.expiresAt).toLocaleString()}
                          </span>
                          <span className="font-mono mt-1 block text-[10px] text-gray-400">
                            Membership {invitation.membershipId} · v
                            {invitation.version}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p role="status" className="mt-3 text-xs text-gray-500">
                      No pending invitations.
                    </p>
                  )}
                  <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">
                    Invite, resend, and cancel writes remain disabled while the
                    BE notification and cutover gates are closed.
                  </p>
                </div>
              )}

              {operationMessage && activeSection === "organizations" && (
                <p className="mt-3 text-xs" role="status">
                  {operationMessage}
                </p>
              )}

              {organization.isError && (
                <p role="alert" className="mt-3 text-xs text-rose-600">
                  {t("errors.organizationDetail")}
                </p>
              )}

              {canReadMemberships && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {t("memberships.title")}
                    </h4>
                    <span className="font-mono rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {memberships.data?.pagination.totalItems ?? 0}
                    </span>
                  </div>

                  {memberships.isError ? (
                    <QueryError
                      message={t("errors.membershipList")}
                      onRetry={() => void memberships.refetch()}
                    />
                  ) : memberships.isPending ? (
                    <div>
                      <p role="status" className="sr-only">
                        {t("loadingMemberships")}
                      </p>
                      <TableSkeleton rows={3} columns={4} />
                    </div>
                  ) : memberships.data?.data.length ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                      <table className="min-w-full text-xs">
                        <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-3 text-start">
                              {t("table.member")}
                            </th>
                            <th className="px-4 py-3 text-start">
                              {t("table.role")}
                            </th>
                            <th className="px-4 py-3 text-start">
                              {t("table.status")}
                            </th>
                            <th className="px-4 py-3 text-end">
                              {t("table.action")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {memberships.data.data.map((member) => (
                            <tr
                              key={member.id}
                              className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                            >
                              <td className="px-4 py-3">
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {member.user?.fullName ??
                                    t("memberships.userUnavailable")}
                                </p>
                                <p className="font-mono text-[10px] text-gray-400">
                                  {member.user?.email ?? member.userId}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                {member.organizationRoles.length
                                  ? member.organizationRoles.join(", ")
                                  : t("table.noRole")}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={member.status}
                                  label={t(`membershipStatus.${member.status}`)}
                                />
                              </td>
                              <td className="px-4 py-3 text-end">
                                {canSuspendMemberships &&
                                member.status === "ACTIVE" &&
                                member.userId !== session.data.id ? (
                                  <button
                                    type="button"
                                    onClick={() => setSuspendTarget(member)}
                                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-rose-500 dark:text-rose-400 dark:hover:bg-rose-500/10"
                                  >
                                    {t("memberships.suspend")}
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-gray-400">
                                    {member.userId === session.data.id
                                      ? t("memberships.currentOperator")
                                      : "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title={t("memberships.emptyTitle")}
                      body={t("memberships.emptyBody")}
                    />
                  )}

                  {memberships.data?.pagination && (
                    <PlatformPagination
                      ariaLabel={t("memberships.title")}
                      page={memberships.data.pagination.page}
                      totalPages={memberships.data.pagination.totalPages}
                      totalItems={memberships.data.pagination.totalItems}
                      onPageChange={setDetailMembershipPage}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {canLookupUsers && canCreateOrganization && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t("users.lookupCreateNote")}
            </p>
          )}

          {!canReadOrganizations &&
            canCreateOrganization &&
            !canLookupUsers && (
              <p className="text-xs text-gray-500">
                {t("noCapabilities.organizationReadNeeded")}
              </p>
            )}

          {!canReadOrganizations && (
            <PermissionNotice
              message={t("pages.organizations.readPermissionNeeded")}
            />
          )}

          <PlatformUnavailablePage
            partial
            items={[
              t("capabilities.organizationLifecycle"),
              t("capabilities.organizationInvitations"),
              t("capabilities.organizationMembershipRoles"),
            ]}
            title={t("capabilities.organizationTitle")}
            description={t("capabilities.organizationDescription")}
            dependency={t("capabilities.organizationDependency")}
          />
        </div>
      )}

      {/* USERS ROUTE */}
      {activeSection === "users" && (
        <PlatformOperationsDirectory
          section="users"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* MEMBERSHIPS ROUTE */}
      {activeSection === "memberships" && (
        <PlatformMembershipDirectory
          organizations={organizations.data}
          organizationsLoading={organizations.isPending}
          organizationsError={organizations.isError}
          onRetryOrganizations={() => void organizations.refetch()}
          organizationPage={organizationPage}
          onOrganizationPageChange={(page) => {
            setOrganizationPage(page);
            setSelectedOrganizationId("");
          }}
          organizationId={effectiveSelectedOrganizationId}
          canReadOrganizations={canReadOrganizations}
          canReadMemberships={canReadMemberships}
          canSuspendMemberships={canSuspendMemberships}
          currentUserId={session.data.id}
          onOrganizationChange={setSelectedOrganizationId}
          onSuspend={setSuspendTarget}
        />
      )}

      {/* PROJECTS ROUTE */}
      {activeSection === "projects" && (
        <PlatformOperationsDirectory
          section="projects"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* SECURITY ROUTE */}
      {activeSection === "security" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t("security.currentSession")}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("security.currentSessionNote")}
                </p>
              </div>
              <StatusBadge status="ACTIVE" label={t("sessionActive")} />
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField
                label={t("account.operator")}
                value={session.data.name}
              />
              <DetailField
                label={t("account.email")}
                value={session.data.email}
              />
              <DetailField
                label={t("account.context")}
                value={session.data.context}
              />
              <DetailField
                label={t("account.permissionCount")}
                value={String(session.data.permissions.length)}
              />
            </dl>
          </section>

          <PlatformOperationsDirectory
            section="security"
            permissions={session.data.permissions}
            operatorId={session.data.id}
          />
        </div>
      )}

      {/* SERVICES ROUTE */}
      {activeSection === "services" && (
        <div className="space-y-6">
          {canReadHealth ? (
            <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("health.title")}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("health.description")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={health.isFetching}
                  onClick={() => void health.refetch()}
                  className="h-8 text-xs"
                >
                  {t("refresh")}
                </Button>
              </div>

              {health.isPending ? (
                <p role="status" className="px-5 py-8 text-xs text-gray-500">
                  {t("health.checking")}
                </p>
              ) : health.isError ? (
                <QueryError
                  message={t("errors.health")}
                  onRetry={() => void health.refetch()}
                />
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <span
                    className="flex size-3 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      {t("health.healthy")}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {t("health.iamOnly")}
                    </p>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <PermissionNotice message={t("pages.services.permissionNeeded")} />
          )}

          <PlatformOperationsDirectory
            section="services"
            permissions={session.data.permissions}
            operatorId={session.data.id}
          />
        </div>
      )}

      {/* JOBS ROUTE */}
      {activeSection === "jobs" && (
        <PlatformOperationsDirectory
          section="jobs"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* AI & RAG ROUTE */}
      {activeSection === "ai" && (
        <PlatformOperationsDirectory
          section="ai"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* INTEGRATIONS ROUTE */}
      {activeSection === "integrations" && (
        <PlatformOperationsDirectory
          section="integrations"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* INCIDENTS ROUTE */}
      {activeSection === "incidents" && (
        <PlatformOperationsDirectory
          section="incidents"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* DIAGNOSTICS ROUTE */}
      {activeSection === "diagnostics" && (
        <PlatformOperationsDirectory
          section="diagnostics"
          permissions={session.data.permissions}
          operatorId={session.data.id}
        />
      )}

      {/* AUDIT ROUTE */}
      {activeSection === "audit" && (
        <PlatformAuditProjection permissions={session.data.permissions} />
      )}

      {/* ACCOUNT ROUTE */}
      {activeSection === "account" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t("account.identityTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("account.identityNote")}
            </p>
            <dl className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
              <DetailField
                label={t("account.operator")}
                value={session.data.name}
              />
              <DetailField
                label={t("account.email")}
                value={session.data.email}
              />
              <DetailField
                label={t("account.context")}
                value={session.data.context}
              />
              <DetailField
                label={t("account.sessionStatus")}
                value={t("sessionActive")}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t("account.permissionTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("account.permissionNote")}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {session.data.permissions.map((permission) => (
                <li
                  key={permission}
                  className="font-mono rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/60"
                >
                  {permission}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Suspend Membership Confirmation Dialog Modal */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSuspendTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-title"
            className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl duration-150 dark:border-gray-800 dark:bg-gray-900"
          >
            <h2
              id="suspend-title"
              className="text-base font-bold text-gray-900 dark:text-white"
            >
              {t("memberships.confirmTitle")}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {t("memberships.confirmBody", {
                name: suspendTarget.user?.fullName ?? suspendTarget.userId,
              })}
            </p>
            <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="mb-0.5 block font-semibold">Policy Guard</span>
              {t("memberships.confirmGuard")}
            </div>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={suspend.isPending}
                onClick={() => setSuspendTarget(null)}
                className="h-9 text-xs"
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={suspend.isPending}
                onClick={() => void confirmSuspend()}
                className="h-9 bg-rose-600 text-xs text-white hover:bg-rose-700"
              >
                {suspend.isPending
                  ? t("memberships.suspending")
                  : t("memberships.confirmSuspend")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </PlatformShell>
  );
}

function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations("platformConsole");
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"
      role="alert"
    >
      <p className="text-xs text-rose-600 dark:text-rose-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
      >
        {t("retry")}
      </button>
    </div>
  );
}

function PermissionNotice({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {message}
    </p>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dark:bg-gray-850/50 rounded-xl bg-gray-50/70 p-3">
      <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-bold text-gray-800 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}
