"use client";

import { CloseIcon } from "@/icons";
import dialogStyles from "./ui/platformDialog.module.css";
import PlatformAccountDirectory from "./PlatformAccountDirectory";
import PlatformAuditProjection from "@/components/platform/PlatformAuditProjection";
import PlatformDashboard from "@/components/platform/PlatformDashboard";
import PlatformMembershipDirectory from "@/components/platform/PlatformMembershipDirectory";
import PlatformOperationsDirectory from "@/components/platform/PlatformOperationsDirectory";
import PlatformOrganizationsView from "@/components/platform/PlatformOrganizationsView";
import PlatformShell from "@/components/platform/ui/PlatformShell";
import PageHeader from "@/components/platform/ui/PageHeader";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  isReadAccessLost,
  QueryRefreshStatus,
} from "@/components/platform/PlatformOperationsUi";
import Button from "@/components/ui/button/Button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { usePlatformChangeOrganizationMetadataMutation } from "@/lib/queries/platform/usePlatformOperations";
import {
  useCreatePlatformOrganizationMutation,
  usePlatformHealthQuery,
  usePlatformLogoutMutation,
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
  const previousPath = useRef(pathname);
  const { isStale: isSessionStale, refetch: refetchSession } = session;
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // Keep the existing freshness check without remounting the Console.
    if (isSessionStale) void refetchSession();
  }, [pathname, isSessionStale, refetchSession]);
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
  const shouldLoadOrganizations = activeSection === "organizations";
  const shouldLoadHealth = activeSection === "services";
  const [organizationPage, setOrganizationPage] = useState(1);
  const organizations = usePlatformOrganizationsQuery(
    canReadOrganizations && shouldLoadOrganizations && !routeOrganizationId,
    organizationPage,
    10,
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const effectiveSelectedOrganizationId =
    routeOrganizationId ||
    (activeSection === "memberships" ? selectedOrganizationId : "") ||
    "";
  const organization = usePlatformOrganizationQuery(
    effectiveSelectedOrganizationId,
    canReadOrganizations &&
      activeSection === "organizations" &&
      hasValidRouteOrganizationId,
  );
  const changeOrganizationMetadata =
    usePlatformChangeOrganizationMetadataMutation();
  const lookup = usePlatformUserLookupMutation();
  const createOrganization = useCreatePlatformOrganizationMutation();
  const suspend = useSuspendPlatformMembershipMutation(
    suspendTarget?.organizationId ?? effectiveSelectedOrganizationId,
  );

  useEffect(() => {
    if (session.isError && (!session.data || isReadAccessLost(session.error)))
      router.replace("/signin");
  }, [router, session.isError, session.data, session.error]);

  const pageTitle = t(`pages.${activeSection}.title`);
  const pageDescription = t(`pages.${activeSection}.description`);

  async function signOut() {
    try {
      await logout.mutateAsync();
      router.replace("/signin");
    } catch {
      setOperationMessage(t("errors.signOut"));
    }
  }

  async function runLookup() {
    if (!canCreateOrganization || !canLookupUsers || lookup.isPending)
      return false;
    setOperationMessage("");
    setSelectedUser(null);
    try {
      const user = await lookup.mutateAsync(lookupEmail.trim());
      setSelectedUser({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });
      return true;
    } catch {
      setOperationMessage(t("errors.userLookup"));
      return false;
    }
  }

  async function runCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperationMessage("");
    if (
      !canCreateOrganization ||
      !canLookupUsers ||
      createOrganization.isPending ||
      !selectedUser ||
      selectedUser.email.toLowerCase() !== lookupEmail.trim().toLowerCase()
    )
      return false;
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
      return true;
    } catch (error) {
      setOperationMessage(apiMessage(error, t("errors.organizationCreate")));
      return false;
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

  if (session.isPending && !session.data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300"
        aria-live="polite"
      >
        {t("loading")}
      </main>
    );
  }
  if (
    (session.isError && (!session.data || isReadAccessLost(session.error))) ||
    !session.data
  ) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300"
        aria-live="polite"
      >
        {t("sessionChecking")}
      </main>
    );
  }

  return (
    <PlatformShell
      activeSection={activeSection}
      permissions={session.data.permissions}
      operatorName={session.data.name}
      operatorEmail={session.data.email}
      isSigningOut={logout.isPending}
      onSignOut={() => void signOut()}
    >
      {session.data &&
        !isReadAccessLost(session.error) &&
        (session.isFetching || session.isRefetchError) && (
          <div className={session.isRefetchError ? "mb-4" : "sr-only"}>
            <QueryRefreshStatus
              hasData
              isFetching={session.isFetching}
              isRefetchError={session.isRefetchError}
              onRetry={() => void session.refetch()}
            />
          </div>
        )}
      {/* Top Page Header */}
      {[
        "users",
        "dashboard",
        "memberships",
        "services",
        "jobs",
        "ai",
        "integrations",
        "security",
        "incidents",
        "diagnostics",
        "audit",
        "account",
      ].includes(activeSection) ||
      (activeSection === "organizations" &&
        !routeOrganizationId &&
        canReadOrganizations) ? null : (
        <PageHeader
          hideTitle={activeSection === "organizations" && !routeOrganizationId}
          title={pageTitle}
          description={pageDescription}
        />
      )}

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
          <PlatformOrganizationsView
            key={routeOrganizationId || "directory"}
            organizations={organizations}
            setOrganizationPage={setOrganizationPage}
            canReadOrganizations={canReadOrganizations}
            canManageOrganizations={canManageOrganizations}
            canCreateOrganization={canCreateOrganization}
            canLookupUsers={canLookupUsers}
            selectedOrganizationId={selectedOrganizationId}
            routeOrganizationId={routeOrganizationId}
            hasValidRouteOrganizationId={hasValidRouteOrganizationId}
            organizationName={organizationName}
            setOrganizationName={setOrganizationName}
            organizationSlug={organizationSlug}
            setOrganizationSlug={setOrganizationSlug}
            organizationPlan={organizationPlan}
            setOrganizationPlan={setOrganizationPlan}
            lookupEmail={lookupEmail}
            setLookupEmail={setLookupEmail}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            runLookup={runLookup}
            runCreateOrganization={runCreateOrganization}
            createOrganizationPending={createOrganization.isPending}
            lookupPending={lookup.isPending}
            organization={organization}
            changeOrganizationMetadata={changeOrganizationMetadata}
            setOperationMessage={setOperationMessage}
            isCreateModalOpen={isCreateModalOpen}
            setIsCreateModalOpen={setIsCreateModalOpen}
          />

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
          canReadMemberships={canReadMemberships}
          canSuspendMemberships={canSuspendMemberships}
          currentUserId={session.data.id}
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
          <PlatformOperationsDirectory
            section="security"
            permissions={session.data.permissions}
            operatorId={session.data.id}
          />
          <details className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-800">
            <summary className="cursor-pointer text-xs font-medium">
              {t("security.currentSession")}
            </summary>

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
              <div>
                <dt className="text-xs text-gray-500">
                  {t("account.sessionStatus")}
                </dt>
                <dd>
                  <StatusBadge status="ACTIVE" label={t("sessionActive")} />
                </dd>
              </div>
            </dl>
          </details>
        </div>
      )}

      {/* SERVICES ROUTE */}
      {activeSection === "services" && (
        <div className="space-y-6">
          <PlatformOperationsDirectory
            section="services"
            permissions={session.data.permissions}
            operatorId={session.data.id}
          />
          {canReadHealth ? (
            <details className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-800">
              <summary className="cursor-pointer text-xs font-medium">
                {t("health.title")}
              </summary>
              {health.data !== undefined &&
                !isReadAccessLost(health.error) &&
                (health.isFetching || health.isRefetchError) && (
                  <div className="px-5 pt-4">
                    <QueryRefreshStatus
                      hasData
                      isFetching={health.isFetching}
                      isRefetchError={health.isRefetchError}
                      onRetry={() => void health.refetch()}
                    />
                  </div>
                )}
              {health.isPending && !health.data ? (
                <p role="status" className="px-5 py-8 text-xs text-gray-500">
                  {t("health.checking")}
                </p>
              ) : health.isError &&
                (!health.data || isReadAccessLost(health.error)) ? (
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
            </details>
          ) : (
            <PermissionNotice message={t("pages.services.permissionNeeded")} />
          )}
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
        <PlatformAccountDirectory account={session.data} />
      )}

      {/* Suspend Membership Confirmation Dialog Modal */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSuspendTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-title"
            className={`${dialogStyles.surface} ${dialogStyles.confirmation} relative`}
          >
            <button
              type="button"
              aria-label={t("cancel")}
              className={`${dialogStyles.close} absolute end-3 top-3`}
              disabled={suspend.isPending}
              onClick={() => setSuspendTarget(null)}
            >
              <CloseIcon aria-hidden="true" />
            </button>
            <h2
              id="suspend-title"
              className="pe-10 text-base font-bold text-gray-900 dark:text-white"
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
