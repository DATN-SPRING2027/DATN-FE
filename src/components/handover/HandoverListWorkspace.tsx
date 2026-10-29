"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import {
  useProjectMembersQuery,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import { useProjectManagementAccess } from "@/lib/queries/projects/useProjectSettings";
import { useHandoversQuery } from "@/lib/queries/handovers/useHandovers";
import {
  canonicalizeCommandIntent,
  formatHandoverEtag,
  generateIdempotencyKey,
  setHandoverCoordinator,
} from "@/lib/queries/handovers/handover.service";
import type { HandoverStatus } from "@/lib/queries/handovers/handover.types";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  CloseLineIcon,
  HandShakeIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  TimeIcon,
  UserCircleIcon,
} from "@/icons";
import CreateHandoverModal from "./CreateHandoverModal";
import {
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatUtcDate,
  resolveMemberName,
  statusBadgeColor,
} from "./handover-ui.utils";

export default function HandoverListWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("handover");
  const router = useRouter();
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId ?? "";
  const isOrgManager = Boolean(currentUser.data?.roles?.includes("ADMIN"));

  const projectQuery = useProjectQuery(organizationId, projectId);
  const membersQuery = useProjectMembersQuery(organizationId, projectId, {
    page: 1,
    pageSize: 100,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HandoverStatus | "ALL">(
    "ALL",
  );
  const [departingFilter, setDepartingFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Safe Coordinator Recovery Modal (for Organization Managers or Leaders)
  const [isCoordModalOpen, setIsCoordModalOpen] = useState(false);
  const [coordHandoverId, setCoordHandoverId] = useState("");
  const [coordVersion, setCoordVersion] = useState("1");
  const [coordLeaderId, setCoordLeaderId] = useState("");
  const [coordReason, setCoordReason] = useState("");
  const [coordPending, setCoordPending] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [coordSuccess, setCoordSuccess] = useState<string | null>(null);
  const coordIdemRef = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );

  const handoversQuery = useHandoversQuery(projectId, {});

  const members = useMemo(
    () => membersQuery.data?.data ?? [],
    [membersQuery.data],
  );
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "ACTIVE"),
    [members],
  );
  const membersById = useMemo(() => {
    const map = new Map<string, ProjectMembership>();
    for (const m of members) {
      map.set(m.userId, m);
    }
    return map;
  }, [members]);

  const managementAccess = useProjectManagementAccess(
    organizationId,
    projectId,
    Boolean(organizationId && projectId),
  );

  // Project Leaders and Organization Managers can initiate a handover; backend enforces authoritative IAM scope.
  const canInitiateHandover =
    isOrgManager ||
    managementAccess.canAccessSettings ||
    managementAccess.isPending;

  const allItems = useMemo(
    () => handoversQuery.data?.data ?? [],
    [handoversQuery.data],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (departingFilter && item.departingUserId !== departingFilter) {
        return false;
      }
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, statusFilter, departingFilter, search]);

  const metrics = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let completed = 0;
    let unassignedSuccessor = 0;
    for (const h of allItems) {
      if (h.status === "OPEN") {
        open += 1;
        if (h.overdue) overdue += 1;
        if (!h.successorUserId) unassignedSuccessor += 1;
      } else if (h.status === "COMPLETED") {
        completed += 1;
      }
    }
    return {
      total: allItems.length,
      open,
      overdue,
      completed,
      unassignedSuccessor,
    };
  }, [allItems]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    departingFilter.length > 0;

  const encodedProjectId = encodeURIComponent(projectId);
  const projectName =
    projectQuery.data?.name ??
    t("projectFallback", { id: projectId.slice(0, 8) });

  const isAccessDenied =
    handoversQuery.error instanceof ApiError &&
    [401, 403, 404].includes(handoversQuery.error.status);

  const handleAppointCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);
    setCoordSuccess(null);
    const trimmedId = coordHandoverId.trim();
    const parsedVersion = Number(coordVersion);
    if (!trimmedId || !Number.isInteger(parsedVersion) || parsedVersion < 1) {
      setCoordError("Provide a valid Handover ID and integer version (>= 1).");
      return;
    }
    if (!coordLeaderId.trim() || !coordReason.trim()) {
      setCoordError(
        "Select a Project Leader and enter an appointment reason.",
      );
      return;
    }
    const coordFp = canonicalizeCommandIntent({
      projectId,
      trimmedId,
      parsedVersion,
      assignedLeaderId: coordLeaderId.trim(),
      reason: coordReason.trim(),
    });
    const coordIdemKey =
      coordIdemRef.current?.fingerprint === coordFp
        ? coordIdemRef.current.key
        : ((coordIdemRef.current = {
            fingerprint: coordFp,
            key: generateIdempotencyKey(),
          }),
          coordIdemRef.current.key);

    setCoordPending(true);
    try {
      const res = await setHandoverCoordinator(
        projectId,
        trimmedId,
        formatHandoverEtag(trimmedId, parsedVersion),
        {
          assignedLeaderId: coordLeaderId.trim(),
          reason: coordReason.trim(),
        },
        coordIdemKey,
      );
      coordIdemRef.current = null;
      setCoordSuccess(
        t("detail.coordinatorSafeReceiptSuccess", {
          version: String(res.data.version),
          status: res.data.status,
        }),
      );
      setCoordVersion(String(res.data.version));
      void handoversQuery.refetch();
    } catch (err) {
      setCoordError(
        extractHandoverErrorMessage(err, "Coordinator update failed."),
      );
    } finally {
      setCoordPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-6">
      {/* Header & Breadcrumb */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <nav
            aria-label={t("breadcrumb")}
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            <Link
              href="/projects"
              className="font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t("projectsBreadcrumb")}
            </Link>
            <span
              aria-hidden="true"
              className="text-gray-300 dark:text-gray-600"
            >
              /
            </span>
            <Link
              href={`/projects/${encodedProjectId}/overview`}
              className="max-w-[200px] truncate font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:max-w-xs dark:text-gray-300 dark:hover:text-white"
            >
              {projectName}
            </Link>
            <span
              aria-hidden="true"
              className="text-gray-300 dark:text-gray-600"
            >
              /
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {t("title")}
            </span>
          </nav>

          <Link
            href={`/projects/${encodedProjectId}/overview`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <ChevronLeftIcon
              className="h-3.5 w-3.5 rtl:rotate-180"
              aria-hidden="true"
            />
            <span>{t("backToProject")}</span>
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <HandShakeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("moduleBadge")}</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
              {t("title")}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {handoversQuery.isFetching && !handoversQuery.isPending && (
              <UpdatingStatus>{t("refreshing")}</UpdatingStatus>
            )}
            {isOrgManager && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCoordError(null);
                  setCoordSuccess(null);
                  setIsCoordModalOpen(true);
                }}
              >
                {t("appointCoordinatorCta")}
              </Button>
            )}
            {canInitiateHandover && !isAccessDenied && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                startIcon={<PlusIcon className="h-3.5 w-3.5" />}
                onClick={() => setIsCreateOpen(true)}
              >
                {t("createCta")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Background Refresh Error */}
      {handoversQuery.isError && handoversQuery.data && (
        <BackgroundRefreshError
          retryLabel={t("retry")}
          onRetry={() => void handoversQuery.refetch()}
        >
          {t("loadErrorBody")}
        </BackgroundRefreshError>
      )}

      {/* Initial Loading Skeleton */}
      {handoversQuery.isPending && (
        <div role="status" aria-live="polite" className="space-y-5">
          <span className="sr-only">{t("loadingList")}</span>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
        </div>
      )}

      {/* Permission Denied State */}
      {!handoversQuery.isPending && handoversQuery.isError && isAccessDenied && (
        <section
          role="alert"
          className="rounded-2xl border border-warning-200 bg-warning-50/70 p-6 sm:p-8 dark:border-warning-500/30 dark:bg-warning-500/10"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300">
              <LockIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("permissionDeniedTitle")}
              </h2>
              <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                {t("permissionDeniedBody")}
              </p>
              <div className="flex flex-wrap gap-2.5 pt-2">
                {isOrgManager && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCoordModalOpen(true)}
                  >
                    {t("appointCoordinatorCta")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handoversQuery.refetch()}
                >
                  {t("retry")}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Server Error State */}
      {!handoversQuery.isPending &&
        handoversQuery.isError &&
        !isAccessDenied &&
        !handoversQuery.data && (
          <section
            role="alert"
            className="rounded-2xl border border-error-200 bg-error-50/70 p-6 sm:p-8 dark:border-error-500/30 dark:bg-error-500/10"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300">
                <AlertIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t("loadErrorTitle")}
                </h2>
                <p className="text-sm leading-6 text-gray-700 [overflow-wrap:anywhere] dark:text-gray-300">
                  {extractHandoverErrorMessage(
                    handoversQuery.error,
                    t("loadErrorBody"),
                  )}
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handoversQuery.refetch()}
                  >
                    {t("retry")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* Loaded Content */}
      {handoversQuery.data && (
        <>
          {/* 4-Card B2B KPI Strip */}
          <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("metrics.total")}
                </dt>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <HandShakeIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <dd className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">
                {metrics.total}
              </dd>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("metrics.totalHint")}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("metrics.open")}
                </dt>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-300">
                  <UserCircleIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <dd className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">
                {metrics.open}
              </dd>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.unassignedSuccessor > 0
                  ? `${metrics.unassignedSuccessor} ${t("metrics.unassignedSuccessor").toLowerCase()}`
                  : t("metrics.openHint")}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("metrics.overdue")}
                </dt>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    metrics.overdue > 0
                      ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  <TimeIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <dd
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  metrics.overdue > 0
                    ? "text-error-600 dark:text-error-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {metrics.overdue}
              </dd>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("metrics.overdueHint")}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("metrics.completed")}
                </dt>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
                  <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <dd className="mt-2 text-2xl font-semibold text-success-700 tabular-nums dark:text-success-400">
                {metrics.completed}
              </dd>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("metrics.completedHint")}
              </p>
            </div>
          </dl>

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:flex-row sm:flex-wrap sm:items-center dark:border-gray-800 dark:bg-gray-900">
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <SearchIcon
                aria-hidden="true"
                className="inset-s-3.5 pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                aria-label={t("filters.searchLabel")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-gray-50/50 py-2 ps-10 pe-3.5 text-sm text-gray-900 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label={t("filters.statusLabel")}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as HandoverStatus | "ALL")
                }
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="ALL">{t("filters.statusAll")}</option>
                <option value="OPEN">{t("filters.statusOpen")}</option>
                <option value="COMPLETED">
                  {t("filters.statusCompleted")}
                </option>
                <option value="CANCELLED">
                  {t("filters.statusCancelled")}
                </option>
              </select>

              {members.length > 0 && (
                <select
                  aria-label={t("filters.departingLabel")}
                  value={departingFilter}
                  onChange={(e) => setDepartingFilter(e.target.value)}
                  className="max-w-[220px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">{t("filters.allMembers")}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {formatMemberOptionLabel(m)}
                    </option>
                  ))}
                </select>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setDepartingFilter("");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <CloseLineIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("filters.clearFilters")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Empty State / Filter Zero Matches / List */}
          {allItems.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <HandShakeIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
                {t("list.emptyTitle")}
              </h2>
              <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                {t("list.emptyBody")}
              </p>
              {canInitiateHandover && (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    startIcon={<PlusIcon className="h-3.5 w-3.5" />}
                    onClick={() => setIsCreateOpen(true)}
                  >
                    {t("createCta")}
                  </Button>
                </div>
              )}
            </section>
          ) : filteredItems.length === 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("list.noMatchesTitle")}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">
                {t("list.noMatchesBody")}
              </p>
            </section>
          ) : (
            <>
              {/* Desktop Structured Table (>= 1024px) */}
              <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs lg:block dark:border-gray-800 dark:bg-gray-900">
                <table className="w-full border-collapse text-start">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/70 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                      <th className="px-5 py-3.5 text-start">
                        {t("list.colHandover")}
                      </th>
                      <th className="px-4 py-3.5 text-start">
                        {t("list.colParticipants")}
                      </th>
                      <th className="px-4 py-3.5 text-start whitespace-nowrap">
                        {t("list.colRevision")}
                      </th>
                      <th className="px-4 py-3.5 text-start whitespace-nowrap">
                        {t("list.colTargetDate")}
                      </th>
                      <th className="px-4 py-3.5 text-start whitespace-nowrap">
                        {t("list.colStatus")}
                      </th>
                      <th className="px-5 py-3.5 text-end whitespace-nowrap">
                        {t("list.colAction")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm dark:divide-gray-800">
                    {filteredItems.map((item) => {
                      const detailHref = `/projects/${encodedProjectId}/handover/${encodeURIComponent(item.id)}`;
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                        >
                          <td className="max-w-sm px-5 py-4 align-top">
                            <Link
                              href={detailHref}
                              className="font-semibold break-words text-gray-900 transition-colors hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                            >
                              {item.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                              <span>v{item.version}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {t("status.epochBadge", {
                                  epoch: String(item.assignmentVersion),
                                })}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-xs leading-5 text-gray-600 dark:text-gray-300">
                            <div className="break-words">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                {t("list.departingPrefix")}{" "}
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {resolveMemberName(
                                  item.departingUserId,
                                  membersById,
                                  "—",
                                )}
                              </span>
                            </div>
                            <div className="break-words">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                {t("list.coordinatorPrefix")}{" "}
                              </span>
                              <span>
                                {resolveMemberName(
                                  item.assignedLeaderId,
                                  membersById,
                                  "—",
                                )}
                              </span>
                            </div>
                            <div className="break-words">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                {t("list.successorPrefix")}{" "}
                              </span>
                              <span
                                className={
                                  item.successorUserId
                                    ? "font-medium text-gray-900 dark:text-white"
                                    : "text-warning-700 italic dark:text-warning-300"
                                }
                              >
                                {resolveMemberName(
                                  item.successorUserId,
                                  membersById,
                                  t("status.unassignedSuccessor"),
                                )}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-xs whitespace-nowrap tabular-nums">
                            {item.publishedRevisionId ? (
                              <Badge color="info" size="sm">
                                Published · Draft v{item.draftVersion}
                              </Badge>
                            ) : (
                              <Badge color="warning" size="sm">
                                {t("status.unpublishedDraft", {
                                  version: String(item.draftVersion),
                                })}
                              </Badge>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top text-xs whitespace-nowrap text-gray-700 tabular-nums dark:text-gray-300">
                            <div>{formatUtcDate(item.targetCompletionDate)}</div>
                            {item.overdue && item.status === "OPEN" && (
                              <div className="mt-1">
                                <Badge color="error" size="sm">
                                  {t("status.overdueBadge")}
                                </Badge>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top whitespace-nowrap">
                            <Badge
                              color={statusBadgeColor(item.status)}
                              size="sm"
                            >
                              {t(`status.${item.status}`)}
                            </Badge>
                          </td>

                          <td className="px-5 py-4 text-end align-top whitespace-nowrap">
                            <Link
                              href={detailHref}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-gray-700 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
                            >
                              <span>{t("list.openAction")}</span>
                              <ArrowRightIcon
                                className="h-3.5 w-3.5 rtl:rotate-180"
                                aria-hidden="true"
                              />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile & Tablet Cards (< 1024px) */}
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:hidden">
                {filteredItems.map((item) => {
                  const detailHref = `/projects/${encodedProjectId}/handover/${encodeURIComponent(item.id)}`;
                  return (
                    <article
                      key={item.id}
                      className="flex min-w-0 flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              color={statusBadgeColor(item.status)}
                              size="sm"
                            >
                              {t(`status.${item.status}`)}
                            </Badge>
                            {item.overdue && item.status === "OPEN" && (
                              <Badge color="error" size="sm">
                                {t("status.overdueBadge")}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                            {formatUtcDate(item.targetCompletionDate)}
                          </span>
                        </div>

                        <h3 className="mt-2.5 text-base font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                          <Link
                            href={detailHref}
                            className="hover:text-brand-600"
                          >
                            {item.title}
                          </Link>
                        </h3>

                        <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          <p className="[overflow-wrap:anywhere]">
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                              {t("list.departingPrefix")}{" "}
                            </span>
                            {resolveMemberName(
                              item.departingUserId,
                              membersById,
                              "—",
                            )}
                          </p>
                          <p className="[overflow-wrap:anywhere]">
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                              {t("list.successorPrefix")}{" "}
                            </span>
                            {resolveMemberName(
                              item.successorUserId,
                              membersById,
                              t("status.unassignedSuccessor"),
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                          v{item.version} · Draft v{item.draftVersion}
                        </span>
                        <Link
                          href={detailHref}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
                        >
                          <span>{t("list.openAction")}</span>
                          <ArrowRightIcon
                            className="h-3.5 w-3.5 rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Create Handover Modal */}
      <CreateHandoverModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        organizationId={organizationId}
        projectId={projectId}
        currentUserId={currentUser.data?.id}
        members={members}
        isMembersLoading={membersQuery.isPending}
        onCreated={(handoverId) => {
          setIsCreateOpen(false);
          router.push(
            `/projects/${encodedProjectId}/handover/${encodeURIComponent(handoverId)}`,
          );
        }}
      />

      {/* Organization Manager Safe Coordinator Appointment Modal */}
      <Modal
        isOpen={isCoordModalOpen}
        onClose={() => setIsCoordModalOpen(false)}
        backdropClassName="bg-gray-950/45 backdrop-blur-xs dark:bg-gray-950/70"
        className="max-w-lg border border-gray-200/90 p-6 shadow-theme-xl ring-1 ring-gray-950/5 sm:p-8 dark:border-gray-800 dark:ring-white/10"
      >
        <div className="pe-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("detail.coordinatorModalTitle")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t("detail.coordinatorModalDesc")}
          </p>
        </div>

        <form onSubmit={handleAppointCoordinator} className="mt-5 space-y-4">
          {coordError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {coordError}
            </div>
          )}
          {coordSuccess && (
            <div
              role="status"
              className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
            >
              {coordSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="coord-handover-id"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("detail.coordinatorIdLabel")}
              </label>
              <input
                id="coord-handover-id"
                type="text"
                value={coordHandoverId}
                onChange={(e) => setCoordHandoverId(e.target.value)}
                placeholder={t("detail.coordinatorIdPlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="coord-handover-ver"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("detail.expectedVersionLabel")}
              </label>
              <input
                id="coord-handover-ver"
                type="number"
                min={1}
                value={coordVersion}
                onChange={(e) => setCoordVersion(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="coord-leader-select"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("createModal.coordinatorLabel")}
            </label>
            {activeMembers.length > 0 ? (
              <select
                id="coord-leader-select"
                value={coordLeaderId}
                onChange={(e) => setCoordLeaderId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">
                  {t("createModal.selectCoordinatorPlaceholder")}
                </option>
                {activeMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {formatMemberOptionLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="coord-leader-select"
                type="text"
                value={coordLeaderId}
                onChange={(e) => setCoordLeaderId(e.target.value)}
                placeholder="24-char Leader user ID"
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
          </div>

          <div>
            <label
              htmlFor="coord-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("detail.coordinatorReasonLabel")}
            </label>
            <textarea
              id="coord-reason"
              rows={3}
              value={coordReason}
              onChange={(e) => setCoordReason(e.target.value)}
              placeholder={t("detail.coordinatorReasonPlaceholder")}
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCoordModalOpen(false)}
            >
              {t("createModal.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={coordPending}
            >
              {t("detail.saveCoordinator")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
