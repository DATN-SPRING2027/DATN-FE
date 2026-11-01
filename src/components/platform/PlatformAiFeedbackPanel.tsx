"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseLineIcon,
  FilterIcon,
  LockIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@/icons";
import { usePlatformOrganizationsQuery } from "@/lib/queries/platform/usePlatformConsole";
import {
  usePlatformAiFeedbackQuery,
  usePlatformProjectsQuery,
  type PlatformAiFeedbackRating,
  type PlatformAiFeedbackReasonCategory,
  type PlatformAiFeedbackRow,
} from "@/lib/queries/platform/usePlatformOperations";
import { cn } from "@/utils";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  box,
  cell,
  formatPlatformDate,
  input,
  isReadAccessLost,
} from "./PlatformOperationsUi";

export interface PlatformAiFeedbackPanelProps {
  permissions: readonly string[];
}

function toUtcStartIso(dateStr: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return undefined;
  return `${dateStr}T00:00:00.000Z`;
}

function toUtcExclusiveNextDayIso(dateStr: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return undefined;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

export default function PlatformAiFeedbackPanel({
  permissions,
}: PlatformAiFeedbackPanelProps) {
  const t = useTranslations("platformConsole.aiFeedback");
  const tRoot = useTranslations("platformConsole");

  const canReadAi = permissions.includes("platform.ai.operations.read");
  const canReadOrgs = permissions.includes(
    "platform.organizations.organization.read",
  );
  const canReadProjects = permissions.includes(
    "platform.projects.project.read",
  );

  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rating, setRating] = useState<PlatformAiFeedbackRating | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(20);
  const [cursorStack, setCursorStack] = useState<readonly string[]>([]);
  const [inspectedRow, setInspectedRow] =
    useState<PlatformAiFeedbackRow | null>(null);

  const activeCursor =
    cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

  const fromIso = toUtcStartIso(fromDate);
  const toIso = toUtcExclusiveNextDayIso(toDate);
  const hasInvalidDateRange =
    Boolean(fromIso && toIso) && Date.parse(fromIso!) >= Date.parse(toIso!);

  const organizationsQuery = usePlatformOrganizationsQuery(
    canReadAi && canReadOrgs,
  );
  const projectsQuery = usePlatformProjectsQuery(
    { page: 1, pageSize: 100 },
    canReadAi && canReadProjects,
  );

  const organizations = useMemo(
    () => organizationsQuery.data?.data ?? [],
    [organizationsQuery.data],
  );
  const allProjects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data],
  );

  const orgNameById = useMemo(
    () => new Map(organizations.map((org) => [org.id, org.name])),
    [organizations],
  );
  const projectById = useMemo(
    () => new Map(allProjects.map((proj) => [proj.id, proj])),
    [allProjects],
  );

  const filteredProjects = useMemo(
    () =>
      organizationId
        ? allProjects.filter((proj) => proj.organization.id === organizationId)
        : allProjects,
    [allProjects, organizationId],
  );

  const feedbackQuery = usePlatformAiFeedbackQuery(
    {
      organizationId: organizationId || undefined,
      projectId: projectId || undefined,
      rating: rating || undefined,
      from: hasInvalidDateRange ? undefined : fromIso,
      to: hasInvalidDateRange ? undefined : toIso,
      cursor: activeCursor,
      limit,
    },
    canReadAi && !hasInvalidDateRange,
  );

  useEffect(() => {
    if (!inspectedRow) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInspectedRow(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [inspectedRow]);

  if (!canReadAi) {
    return null;
  }

  const resetPagination = () => setCursorStack([]);

  const hasActiveFilters = Boolean(
    organizationId || projectId || rating || fromDate || toDate || limit !== 20,
  );

  const handleResetFilters = () => {
    setOrganizationId("");
    setProjectId("");
    setRating("");
    setFromDate("");
    setToDate("");
    setLimit(20);
    setCursorStack([]);
  };

  const categoryLabel = (
    category?: PlatformAiFeedbackReasonCategory,
  ): string => {
    if (!category) return "—";
    switch (category) {
      case "INACCURATE":
        return t("categoryINACCURATE");
      case "OUTDATED":
        return t("categoryOUTDATED");
      case "IRRELEVANT_CITATION":
        return t("categoryIRRELEVANT_CITATION");
      case "INCOMPLETE":
        return t("categoryINCOMPLETE");
      case "OTHER":
        return t("categoryOTHER");
    }
  };

  const totals = feedbackQuery.data?.totals ?? { likes: 0, dislikes: 0 };
  const totalVotes = totals.likes + totals.dislikes;
  const approvalPercent =
    totalVotes > 0 ? Math.round((totals.likes / totalVotes) * 100) : null;
  const items = feedbackQuery.data?.items ?? [];
  const nextCursor = feedbackQuery.data?.nextCursor ?? null;

  return (
    <section
      aria-labelledby="platform-ai-feedback-heading"
      className={`${box} mt-6 p-5`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="max-w-2xl">
          <h2
            id="platform-ai-feedback-heading"
            className="text-sm font-semibold text-gray-900 dark:text-white"
          >
            {t("sectionTitle")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {t("sectionSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void feedbackQuery.refetch()}
          disabled={feedbackQuery.isFetching}
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {feedbackQuery.isFetching ? tRoot("refreshing") : tRoot("refresh")}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/60">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {t("kpiTotal")}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
            {totalVotes}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("kpiTotalHint")}
          </p>
        </div>

        <div className="rounded-2xl border border-success-500/25 bg-success-50/50 p-4 dark:border-success-500/20 dark:bg-success-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wider text-success-700 uppercase dark:text-success-300">
              {t("kpiLikes")}
            </p>
            <ThumbUpIcon
              aria-hidden="true"
              className="size-4 text-success-600 dark:text-success-300"
            />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-success-700 tabular-nums dark:text-success-300">
            {totals.likes}
          </p>
          <p className="mt-1 text-xs text-success-700/80 dark:text-success-300/80">
            {t("kpiLikesHint")}
          </p>
        </div>

        <div className="rounded-2xl border border-error-500/25 bg-error-50/50 p-4 dark:border-error-500/20 dark:bg-error-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wider text-error-700 uppercase dark:text-error-300">
              {t("kpiDislikes")}
            </p>
            <ThumbDownIcon
              aria-hidden="true"
              className="size-4 text-error-600 dark:text-error-300"
            />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-error-700 tabular-nums dark:text-error-300">
            {totals.dislikes}
          </p>
          <p className="mt-1 text-xs text-error-700/80 dark:text-error-300/80">
            {t("kpiDislikesHint")}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/60">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {t("kpiApproval")}
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-bold tabular-nums",
              approvalPercent === null
                ? "text-gray-400 dark:text-gray-500"
                : approvalPercent >= 75
                  ? "text-success-600 dark:text-success-400"
                  : approvalPercent >= 50
                    ? "text-warning-600 dark:text-warning-400"
                    : "text-error-600 dark:text-error-400",
            )}
          >
            {approvalPercent === null ? "—" : `${approvalPercent}%`}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {approvalPercent === null ? t("kpiApprovalEmpty") : t("kpiTotalHint")}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/40">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label
              htmlFor="ai-fb-filter-org"
              className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
            >
              {t("filterOrganization")}
            </label>
            {organizations.length > 0 ? (
              <select
                id="ai-fb-filter-org"
                aria-label={t("filterOrganization")}
                value={organizationId}
                onChange={(ev) => {
                  setOrganizationId(ev.target.value);
                  setProjectId("");
                  resetPagination();
                }}
                className={`${input} w-full`}
              >
                <option value="">{t("allOrganizations")}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="ai-fb-filter-org"
                type="text"
                aria-label={t("filterOrganization")}
                value={organizationId}
                onChange={(ev) => {
                  setOrganizationId(ev.target.value.trim());
                  resetPagination();
                }}
                placeholder={t("allOrganizations")}
                className={`${input} w-full`}
              />
            )}
          </div>

          <div>
            <label
              htmlFor="ai-fb-filter-project"
              className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
            >
              {t("filterProject")}
            </label>
            {filteredProjects.length > 0 ? (
              <select
                id="ai-fb-filter-project"
                aria-label={t("filterProject")}
                value={projectId}
                onChange={(ev) => {
                  setProjectId(ev.target.value);
                  resetPagination();
                }}
                className={`${input} w-full`}
              >
                <option value="">{t("allProjects")}</option>
                {filteredProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} ({proj.code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="ai-fb-filter-project"
                type="text"
                aria-label={t("filterProject")}
                value={projectId}
                onChange={(ev) => {
                  setProjectId(ev.target.value.trim());
                  resetPagination();
                }}
                placeholder={t("allProjects")}
                className={`${input} w-full`}
              />
            )}
          </div>

          <div>
            <label
              htmlFor="ai-fb-filter-rating"
              className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
            >
              {t("filterRating")}
            </label>
            <select
              id="ai-fb-filter-rating"
              aria-label={t("filterRating")}
              value={rating}
              onChange={(ev) => {
                setRating(ev.target.value as PlatformAiFeedbackRating | "");
                resetPagination();
              }}
              className={`${input} w-full`}
            >
              <option value="">{t("allRatings")}</option>
              <option value="LIKE">{t("ratingLike")}</option>
              <option value="DISLIKE">{t("ratingDislike")}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ai-fb-filter-from"
              className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
            >
              {t("filterFrom")}
            </label>
            <input
              id="ai-fb-filter-from"
              type="date"
              aria-label={t("filterFrom")}
              value={fromDate}
              onChange={(ev) => {
                setFromDate(ev.target.value);
                resetPagination();
              }}
              className={`${input} w-full tabular-nums`}
            />
          </div>

          <div>
            <label
              htmlFor="ai-fb-filter-to"
              className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
            >
              {t("filterTo")}
            </label>
            <input
              id="ai-fb-filter-to"
              type="date"
              aria-label={t("filterTo")}
              value={toDate}
              onChange={(ev) => {
                setToDate(ev.target.value);
                resetPagination();
              }}
              className={`${input} w-full tabular-nums`}
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="ai-fb-filter-limit"
                className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300"
              >
                {t("filterLimit")}
              </label>
              <select
                id="ai-fb-filter-limit"
                aria-label={t("filterLimit")}
                value={limit}
                onChange={(ev) => {
                  setLimit(Number(ev.target.value));
                  resetPagination();
                }}
                className={`${input} w-full tabular-nums`}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <FilterIcon aria-hidden="true" className="size-3.5" />
                <span>{t("resetFilters")}</span>
              </button>
            )}
          </div>
        </div>

        {hasInvalidDateRange && (
          <p
            role="alert"
            className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-error-600 dark:text-error-300"
          >
            <AlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{t("dateRangeError")}</span>
          </p>
        )}
      </div>

      {/* Refresh / Loading / Error / Empty / Table */}
      {feedbackQuery.data !== undefined &&
        !isReadAccessLost(feedbackQuery.error) &&
        (feedbackQuery.isFetching || feedbackQuery.isRefetchError) && (
          <div className="mt-4">
            <QueryRefreshStatus
              hasData
              isFetching={feedbackQuery.isFetching}
              isRefetchError={feedbackQuery.isRefetchError}
              onRetry={() => void feedbackQuery.refetch()}
            />
          </div>
        )}

      <div className="mt-4">
        {feedbackQuery.isPending && !feedbackQuery.data ? (
          <Loading columns={5} />
        ) : feedbackQuery.isError &&
          (!feedbackQuery.data || isReadAccessLost(feedbackQuery.error)) ? (
          <ErrorState retry={() => void feedbackQuery.refetch()} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {hasActiveFilters ? t("noMatchesTitle") : t("emptyTitle")}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {hasActiveFilters
                ? t("noMatchesDescription")
                : t("emptyDescription")}
            </p>
          </div>
        ) : (
          <>
            <DirectoryTable
              headers={[
                t("colRating"),
                t("colCategory"),
                t("colScope"),
                t("colTurn"),
                t("colUpdated"),
                t("colAction"),
              ]}
            >
              {items.map((row) => {
                const orgLabel =
                  orgNameById.get(row.organizationId) ?? row.organizationId;
                const proj = projectById.get(row.projectId);
                const projLabel = proj
                  ? `${proj.name} (${proj.code})`
                  : row.projectId;
                const isLike = row.rating === "LIKE";

                return (
                  <tr key={row.id}>
                    <td className={cell}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          isLike
                            ? "bg-success-500/15 text-success-700 dark:text-success-300"
                            : "bg-error-500/15 text-error-700 dark:text-error-300",
                        )}
                      >
                        {isLike ? (
                          <ThumbUpIcon aria-hidden="true" className="size-3" />
                        ) : (
                          <ThumbDownIcon
                            aria-hidden="true"
                            className="size-3"
                          />
                        )}
                        <span>
                          {isLike ? t("ratingLike") : t("ratingDislike")}
                        </span>
                      </span>
                    </td>

                    <td className={`${cell} max-w-xs`}>
                      {isLike ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {categoryLabel(row.reasonCategory)}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                            {row.reasonText ?? t("noReasonNote")}
                          </p>
                        </div>
                      )}
                    </td>

                    <td className={cell}>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {orgLabel}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {projLabel}
                      </div>
                    </td>

                    <td className={`${cell} font-mono text-[11px] tabular-nums`}>
                      <div className="truncate max-w-40" title={row.id}>
                        F: {row.id.slice(0, 12)}…
                      </div>
                      <div
                        className="mt-0.5 truncate max-w-40 text-gray-400"
                        title={row.messageId}
                      >
                        M: {row.messageId.slice(0, 12)}…
                      </div>
                    </td>

                    <td className={`${cell} whitespace-nowrap tabular-nums`}>
                      {formatPlatformDate(row.updatedAt)}
                    </td>

                    <td className={cell}>
                      <button
                        type="button"
                        onClick={() => setInspectedRow(row)}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {t("viewReasonAction")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </DirectoryTable>

            {/* Cursor Pagination */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3.5 text-xs dark:border-gray-800">
              <span className="font-medium text-gray-500 tabular-nums dark:text-gray-400">
                {t("cursorPageLabel", { page: cursorStack.length + 1 })}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={cursorStack.length === 0 || feedbackQuery.isFetching}
                  onClick={() =>
                    setCursorStack((prev) => prev.slice(0, prev.length - 1))
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
                  <span>{tRoot("pagination.previous")}</span>
                </button>
                <button
                  type="button"
                  disabled={!nextCursor || feedbackQuery.isFetching}
                  onClick={() => {
                    if (nextCursor) {
                      setCursorStack((prev) => [...prev, nextCursor]);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span>{tRoot("pagination.next")}</span>
                  <ChevronRightIcon aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Feedback Reason Detail Modal */}
      {inspectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeDialog")}
            onClick={() => setInspectedRow(null)}
            className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("detailDialogTitle")}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3.5 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("detailDialogTitle")}
              </h3>
              <button
                type="button"
                aria-label={t("closeDialog")}
                onClick={() => setInspectedRow(null)}
                className="inline-flex size-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <CloseLineIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <TextField
                label={t("fieldRating")}
                value={
                  inspectedRow.rating === "LIKE"
                    ? t("ratingLike")
                    : t("ratingDislike")
                }
              />
              <TextField
                label={t("fieldCategory")}
                value={categoryLabel(inspectedRow.reasonCategory)}
              />
              <TextField
                label={t("fieldOrganization")}
                value={
                  orgNameById.get(inspectedRow.organizationId) ??
                  inspectedRow.organizationId
                }
              />
              <TextField
                label={t("fieldProject")}
                value={
                  projectById.get(inspectedRow.projectId)?.name ??
                  inspectedRow.projectId
                }
              />
              <TextField
                label={t("fieldFeedbackId")}
                value={inspectedRow.id}
              />
              <TextField
                label={t("fieldMessageId")}
                value={inspectedRow.messageId}
              />
              <TextField
                label={t("fieldCreatedAt")}
                value={formatPlatformDate(inspectedRow.createdAt)}
              />
              <TextField
                label={t("fieldUpdatedAt")}
                value={formatPlatformDate(inspectedRow.updatedAt)}
              />
            </dl>

            {inspectedRow.rating === "DISLIKE" && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                  {t("fieldReasonText")}
                </p>
                <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                  {inspectedRow.reasonText ?? t("noReasonNote")}
                </div>
              </div>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:bg-gray-950 dark:text-gray-400">
              <LockIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("privacyNotice")}</span>
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedRow(null)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                {t("closeDialog")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
