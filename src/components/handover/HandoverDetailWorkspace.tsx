"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import {
  useProjectMembersQuery,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import {
  useCancelHandoverMutation,
  useCompleteHandoverMutation,
  useHandoverDetailQuery,
  useSetHandoverCoordinatorMutation,
  useSetHandoverSuccessorMutation,
  useUpdateHandoverMetadataMutation,
} from "@/lib/queries/handovers/useHandovers";
import { formatHandoverEtag } from "@/lib/queries/handovers/handover.service";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  HandShakeIcon,
  LockIcon,
  PencilIcon,
  TimeIcon,
  UserCircleIcon,
} from "@/icons";
import HandoverDraftEditor from "./HandoverDraftEditor";
import HandoverPublishedView from "./HandoverPublishedView";
import HandoverTaskTransfersPanel from "./HandoverTaskTransfersPanel";
import HandoverQaPanel from "./HandoverQaPanel";
import HandoverFollowUpsPanel from "./HandoverFollowUpsPanel";
import {
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatUtcDate,
  resolveMemberName,
  statusBadgeColor,
} from "./handover-ui.utils";

type DetailTab = "published" | "draft" | "tasks" | "qa" | "followups";

export default function HandoverDetailWorkspace({
  projectId,
  handoverId,
}: {
  projectId: string;
  handoverId: string;
}) {
  const t = useTranslations("handover");
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId ?? "";
  const currentUserId = currentUser.data?.id ?? "";
  const isOrgManager = Boolean(currentUser.data?.roles?.includes("ADMIN"));

  const projectQuery = useProjectQuery(organizationId, projectId);
  const membersQuery = useProjectMembersQuery(organizationId, projectId, {
    page: 1,
    pageSize: 100,
    status: "ACTIVE",
  });
  const detailQuery = useHandoverDetailQuery(projectId, handoverId);

  const updateMetaMutation = useUpdateHandoverMetadataMutation(
    projectId,
    handoverId,
  );
  const setSuccessorMutation = useSetHandoverSuccessorMutation(
    projectId,
    handoverId,
  );
  const setCoordinatorMutation = useSetHandoverCoordinatorMutation(
    projectId,
    handoverId,
  );
  const completeMutation = useCompleteHandoverMutation(projectId, handoverId);
  const cancelMutation = useCancelHandoverMutation(projectId, handoverId);

  const [activeTab, setActiveTab] = useState<DetailTab | null>(null);

  // Lifecycle Modals
  const [modalMode, setModalMode] = useState<
    "metadata" | "successor" | "coordinator" | "complete" | "cancel" | null
  >(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [nextSuccessorId, setNextSuccessorId] = useState("");
  const [successorReason, setSuccessorReason] = useState("");
  const [nextCoordinatorId, setNextCoordinatorId] = useState("");
  const [coordinatorReason, setCoordinatorReason] = useState("");
  const [fallbackVersion, setFallbackVersion] = useState("1");
  const [completeNote, setCompleteNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [safeReceiptBanner, setSafeReceiptBanner] = useState<string | null>(
    null,
  );

  const members = useMemo(
    () => membersQuery.data?.data ?? [],
    [membersQuery.data],
  );
  const membersById = useMemo(() => {
    const map = new Map<string, ProjectMembership>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  const encodedProjectId = encodeURIComponent(projectId);
  const listHref = `/projects/${encodedProjectId}/handover`;
  const projectName =
    projectQuery.data?.name ??
    t("projectFallback", { id: projectId.slice(0, 8) });

  const isAccessDenied =
    detailQuery.error instanceof ApiError &&
    [401, 403, 404].includes(detailQuery.error.status);

  const detailResource = detailQuery.data;
  const handover = detailResource?.detail.handover;
  const publishedRevision = detailResource?.detail.publishedRevision ?? null;
  const capabilities = useMemo(
    () => detailResource?.detail.capabilities ?? [],
    [detailResource?.detail.capabilities],
  );
  const etag = detailResource?.etag ?? "";

  const canManage =
    capabilities.includes("MANAGE") && handover?.status === "OPEN";

  const resolvedTab: DetailTab = useMemo(() => {
    if (activeTab) return activeTab;
    if (!publishedRevision && capabilities.includes("MANAGE")) {
      return "draft";
    }
    return "published";
  }, [activeTab, publishedRevision, capabilities]);

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <nav
          aria-label={t("breadcrumb")}
          className="flex min-w-0 flex-wrap items-center gap-1.5"
        >
          <Link
            href="/projects"
            className="font-medium hover:text-gray-900 dark:hover:text-gray-200"
          >
            {t("projectsBreadcrumb")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/projects/${encodedProjectId}/overview`}
            className="max-w-[180px] truncate font-medium hover:text-gray-900 dark:hover:text-gray-200"
          >
            {projectName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={listHref}
            className="font-medium hover:text-gray-900 dark:hover:text-gray-200"
          >
            {t("title")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="max-w-[220px] truncate font-semibold text-gray-900 dark:text-white">
            {handover?.title ?? handoverId.slice(0, 8)}
          </span>
        </nav>

        <Link
          href={listHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <ChevronLeftIcon
            className="h-3.5 w-3.5 rtl:rotate-180"
            aria-hidden="true"
          />
          <span>{t("backToList")}</span>
        </Link>
      </div>

      {safeReceiptBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          <span>{safeReceiptBanner}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {detailQuery.isPending && (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">{t("loadingDetail")}</span>
          <div className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
          <div className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
        </div>
      )}

      {/* Permission Denied / Org Manager Safe Coordinator Recovery */}
      {!detailQuery.isPending && detailQuery.isError && isAccessDenied && (
        <section
          role="alert"
          className="rounded-2xl border border-warning-200 bg-warning-50/70 p-6 sm:p-8 dark:border-warning-500/30 dark:bg-warning-500/10"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300">
              <LockIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("permissionDeniedTitle")}
              </h1>
              <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                {t("permissionDeniedBody")}
              </p>
              {isOrgManager && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setModalError(null);
                      setModalMode("coordinator");
                    }}
                  >
                    {t("appointCoordinatorCta")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Server Error */}
      {!detailQuery.isPending &&
        detailQuery.isError &&
        !isAccessDenied &&
        !detailResource && (
          <section
            role="alert"
            className="rounded-2xl border border-error-200 bg-error-50/70 p-6 dark:border-error-500/30 dark:bg-error-500/10"
          >
            <div className="flex items-start gap-3">
              <AlertIcon className="mt-0.5 h-5 w-5 text-error-600" />
              <div className="space-y-2">
                <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t("loadErrorTitle")}
                </h1>
                <p className="text-sm text-gray-700 [overflow-wrap:anywhere] dark:text-gray-300">
                  {extractHandoverErrorMessage(
                    detailQuery.error,
                    t("loadErrorBody"),
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void detailQuery.refetch()}
                >
                  {t("retry")}
                </Button>
              </div>
            </div>
          </section>
        )}

      {/* Main Loaded Workspace */}
      {detailResource && handover && (
        <>
          {detailQuery.isError && (
            <BackgroundRefreshError
              retryLabel={t("retry")}
              onRetry={() => void detailQuery.refetch()}
            >
              {t("loadErrorBody")}
            </BackgroundRefreshError>
          )}

          {/* Hero Governance Card */}
          <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={statusBadgeColor(handover.status)} size="sm">
                    {t(`status.${handover.status}`)}
                  </Badge>
                  {handover.overdue && handover.status === "OPEN" && (
                    <Badge color="error" size="sm">
                      {t("status.overdueBadge")}
                    </Badge>
                  )}
                  <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {t("detail.versionMeta", {
                      version: String(handover.version),
                      draftVersion: String(handover.draftVersion),
                      epoch: String(handover.assignmentVersion),
                    })}
                  </span>
                  {detailQuery.isFetching && !detailQuery.isPending && (
                    <UpdatingStatus>{t("refreshing")}</UpdatingStatus>
                  )}
                </div>

                <h1 className="text-xl font-semibold tracking-tight text-gray-900 [overflow-wrap:anywhere] sm:text-2xl dark:text-white">
                  {handover.title}
                </h1>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 me-1">
                    {t("detail.capabilitiesLabel")}:
                  </span>
                  {capabilities.map((cap) => (
                    <Badge key={cap} color="light" size="sm">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Lifecycle Action Buttons */}
              {(canManage || isOrgManager) && handover.status === "OPEN" && (
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        startIcon={<PencilIcon className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setEditTitle(handover.title);
                          setEditDate(
                            handover.targetCompletionDate.slice(0, 10),
                          );
                          setModalError(null);
                          setModalMode("metadata");
                        }}
                      >
                        {t("detail.editMetadataCta")}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNextSuccessorId(handover.successorUserId ?? "");
                          setSuccessorReason("");
                          setModalError(null);
                          setModalMode("successor");
                        }}
                      >
                        {t("detail.assignSuccessorCta")}
                      </Button>
                    </>
                  )}

                  {(canManage || isOrgManager) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNextCoordinatorId(handover.assignedLeaderId);
                        setCoordinatorReason("");
                        setModalError(null);
                        setModalMode("coordinator");
                      }}
                    >
                      {t("detail.changeCoordinatorCta")}
                    </Button>
                  )}

                  {canManage && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={!detailResource.detail.canComplete}
                        onClick={() => {
                          setCompleteNote(
                            "Verified all required knowledge items and readiness gates.",
                          );
                          setModalError(null);
                          setModalMode("complete");
                        }}
                      >
                        {t("detail.completeCta")}
                      </Button>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setCancelReason("");
                          setModalError(null);
                          setModalMode("cancel");
                        }}
                      >
                        {t("detail.cancelCta")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 4-Card Transition Summary Strip */}
            <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
              <div className="rounded-xl bg-gray-50/70 p-3.5 dark:bg-gray-800/50">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("list.departingPrefix").replace(/:$/, "")} /{" "}
                  {t("list.coordinatorPrefix").replace(/:$/, "")}
                </dt>
                <dd className="mt-1 text-xs font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                  A:{" "}
                  {resolveMemberName(
                    handover.departingUserId,
                    membersById,
                    "—",
                  )}
                  <br />
                  D:{" "}
                  {resolveMemberName(
                    handover.assignedLeaderId,
                    membersById,
                    "—",
                  )}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50/70 p-3.5 dark:bg-gray-800/50">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <UserCircleIcon className="h-3.5 w-3.5" />
                  <span>{t("list.successorPrefix").replace(/:$/, "")}</span>
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                  {resolveMemberName(
                    handover.successorUserId,
                    membersById,
                    t("status.unassignedSuccessor"),
                  )}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50/70 p-3.5 dark:bg-gray-800/50">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <TimeIcon className="h-3.5 w-3.5" />
                  <span>{t("list.colTargetDate")}</span>
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                  {formatUtcDate(handover.targetCompletionDate)}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50/70 p-3.5 dark:bg-gray-800/50">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <HandShakeIcon className="h-3.5 w-3.5" />
                  <span>{t("detail.completionGateMetric")}</span>
                </dt>
                <dd
                  className={`mt-1 text-sm font-semibold tabular-nums ${
                    handover.status === "COMPLETED" ||
                    detailResource.detail.canComplete
                      ? "text-success-700 dark:text-success-400"
                      : handover.status === "CANCELLED"
                        ? "text-gray-600 dark:text-gray-400"
                        : "text-warning-700 dark:text-warning-300"
                  }`}
                >
                  {handover.status === "COMPLETED"
                    ? t("detail.gateCompleted")
                    : handover.status === "CANCELLED"
                      ? t("detail.gateCancelled")
                      : detailResource.detail.canComplete
                        ? t("detail.gateReady")
                        : detailResource.detail.requiredPendingCount > 0
                          ? t("detail.gateBlocked", {
                              count: String(
                                detailResource.detail.requiredPendingCount,
                              ),
                            })
                          : t("detail.gateBlockedGeneric")}
                </dd>
              </div>
            </dl>
          </header>

          {/* Workspace Section Tabs */}
          <nav
            aria-label={t("detail.tabsAriaLabel")}
            className="flex max-w-full gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
          >
            {(
              [
                { id: "published" as const, label: t("detail.tabPublished") },
                ...(capabilities.includes("MANAGE") &&
                handover.status === "OPEN"
                  ? [{ id: "draft" as const, label: t("detail.tabDraft") }]
                  : []),
                { id: "tasks" as const, label: t("detail.tabTasks") },
                { id: "qa" as const, label: t("detail.tabQa") },
                { id: "followups" as const, label: t("detail.tabFollowUps") },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  resolvedTab === tab.id
                    ? "border-brand-500 text-brand-700 dark:text-brand-300"
                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab Panels */}
          {resolvedTab === "published" && (
            <HandoverPublishedView
              projectId={projectId}
              handover={handover}
              publishedRevision={publishedRevision}
              etag={etag}
              capabilities={capabilities}
              currentUserId={currentUserId}
              members={members}
            />
          )}

          {resolvedTab === "draft" && capabilities.includes("MANAGE") && (
            <HandoverDraftEditor
              projectId={projectId}
              handoverId={handover.id}
              handoverEtag={etag}
              isOpenStatus={handover.status === "OPEN"}
              publishedRevision={publishedRevision}
              currentUserId={currentUserId}
              members={members}
              onRevisionPublished={() => setActiveTab("published")}
            />
          )}

          {resolvedTab === "tasks" && (
            <HandoverTaskTransfersPanel
              projectId={projectId}
              handover={handover}
              etag={etag}
              capabilities={capabilities}
            />
          )}

          {resolvedTab === "qa" && (
            <HandoverQaPanel projectId={projectId} handover={handover} />
          )}

          {resolvedTab === "followups" && (
            <HandoverFollowUpsPanel
              projectId={projectId}
              handoverId={handover.id}
              capabilities={capabilities}
              currentUserId={currentUserId}
              membersById={membersById}
            />
          )}
        </>
      )}

      {/* Lifecycle Modals */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        className="max-w-lg p-6 sm:p-8"
      >
        {modalMode === "metadata" && handover && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              const parsedDate = new Date(`${editDate}T00:00:00.000Z`);
              if (
                editTitle.trim().length < 3 ||
                Number.isNaN(parsedDate.getTime())
              ) {
                setModalError(t("createModal.validationTitle"));
                return;
              }
              try {
                await updateMetaMutation.mutateAsync({
                  etag,
                  input: {
                    title: editTitle.trim(),
                    targetCompletionDate: parsedDate.toISOString(),
                  },
                });
                setModalMode(null);
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(err, "Update failed."),
                );
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("detail.metadataModalTitle")}
            </h2>
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("createModal.titleLabel")}
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("createModal.targetDateLabel")}
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={updateMetaMutation.isPending}
              >
                {t("detail.saveMetadata")}
              </Button>
            </div>
          </form>
        )}

        {modalMode === "successor" && handover && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              if (!successorReason.trim()) {
                setModalError("Enter a reason for the successor change.");
                return;
              }
              try {
                await setSuccessorMutation.mutateAsync({
                  etag,
                  input: {
                    successorUserId: nextSuccessorId.trim() || null,
                    reason: successorReason.trim(),
                  },
                });
                setModalMode(null);
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(err, "Successor update failed."),
                );
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("detail.successorModalTitle")}
            </h2>
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("detail.successorModalDesc")}
            </p>
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("createModal.successorLabel")}
              </label>
              {members.length > 0 ? (
                <select
                  value={nextSuccessorId}
                  onChange={(e) => setNextSuccessorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{t("createModal.noSuccessorYet")}</option>
                  {members
                    .filter(
                      (m) =>
                        m.userId !== handover.departingUserId &&
                        m.userId !== handover.assignedLeaderId,
                    )
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {formatMemberOptionLabel(m)}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={nextSuccessorId}
                  onChange={(e) => setNextSuccessorId(e.target.value)}
                  placeholder={t("createModal.noSuccessorYet")}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("detail.successorReasonLabel")} *
              </label>
              <textarea
                rows={3}
                value={successorReason}
                onChange={(e) => setSuccessorReason(e.target.value)}
                placeholder={t("detail.successorReasonPlaceholder")}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={setSuccessorMutation.isPending}
              >
                {t("detail.saveSuccessor")}
              </Button>
            </div>
          </form>
        )}

        {modalMode === "coordinator" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              if (!nextCoordinatorId.trim() || !coordinatorReason.trim()) {
                setModalError("Select Coordinator (D) and provide a reason.");
                return;
              }
              const targetEtag =
                etag ||
                formatHandoverEtag(
                  handoverId,
                  Math.max(1, Number(fallbackVersion) || 1),
                );
              try {
                const res = await setCoordinatorMutation.mutateAsync({
                  etag: targetEtag,
                  input: {
                    assignedLeaderId: nextCoordinatorId.trim(),
                    reason: coordinatorReason.trim(),
                  },
                });
                setSafeReceiptBanner(
                  t("detail.coordinatorSafeReceiptSuccess", {
                    version: String(res.data.version),
                    status: res.data.status,
                  }),
                );
                setFallbackVersion(String(res.data.version));
                setModalMode(null);
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(
                    err,
                    "Coordinator update failed.",
                  ),
                );
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("detail.coordinatorModalTitle")}
            </h2>
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("detail.coordinatorModalDesc")}
            </p>
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            {!etag && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t("detail.expectedVersionLabel")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={fallbackVersion}
                  onChange={(e) => setFallbackVersion(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("createModal.coordinatorLabel")} *
              </label>
              {members.length > 0 ? (
                <select
                  value={nextCoordinatorId}
                  onChange={(e) => setNextCoordinatorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">
                    {t("createModal.selectCoordinatorPlaceholder")}
                  </option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {formatMemberOptionLabel(m)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={nextCoordinatorId}
                  onChange={(e) => setNextCoordinatorId(e.target.value)}
                  placeholder="24-char Leader user ID"
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("detail.coordinatorReasonLabel")} *
              </label>
              <textarea
                rows={3}
                value={coordinatorReason}
                onChange={(e) => setCoordinatorReason(e.target.value)}
                placeholder={t("detail.coordinatorReasonPlaceholder")}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={setCoordinatorMutation.isPending}
              >
                {t("detail.saveCoordinator")}
              </Button>
            </div>
          </form>
        )}

        {modalMode === "complete" && handover && publishedRevision && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              if (!completeNote.trim()) {
                setModalError("Enter a final completion review note.");
                return;
              }
              try {
                await completeMutation.mutateAsync({
                  etag,
                  input: {
                    revisionId: publishedRevision.id,
                    assignmentVersion: handover.assignmentVersion,
                    reviewNote: completeNote.trim(),
                  },
                });
                setModalMode(null);
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(err, "Completion blocked."),
                );
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("detail.completeModalTitle")}
            </h2>
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("detail.completeModalDesc")}
            </p>
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("detail.completeNoteLabel")} *
              </label>
              <textarea
                rows={3}
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder={t("detail.completeNotePlaceholder")}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={completeMutation.isPending}
              >
                {t("detail.confirmComplete")}
              </Button>
            </div>
          </form>
        )}

        {modalMode === "cancel" && handover && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setModalError(null);
              if (!cancelReason.trim()) {
                setModalError("Enter a cancellation reason.");
                return;
              }
              try {
                await cancelMutation.mutateAsync({
                  etag,
                  input: { reason: cancelReason.trim() },
                });
                setModalMode(null);
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(err, "Cancellation failed."),
                );
              }
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("detail.cancelModalTitle")}
            </h2>
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("detail.cancelModalDesc")}
            </p>
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t("detail.cancelReasonLabel")} *
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("detail.cancelReasonPlaceholder")}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                isLoading={cancelMutation.isPending}
              >
                {t("detail.confirmCancel")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

