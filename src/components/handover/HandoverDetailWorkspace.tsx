"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import {
  useAddProjectMember,
  useProjectMemberCandidatesQuery,
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
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  BookOpenIcon,
  CalenderIcon,
  ChatIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  CloseLineIcon,
  DocsIcon,
  GroupIcon,
  HandShakeIcon,
  HorizontaLDots,
  LockIcon,
  PencilIcon,
  TaskIcon,
  UserCircleIcon,
} from "@/icons";
import HandoverDialogShell from "./HandoverDialogShell";
import HandoverDatePicker from "./HandoverDatePicker";
import HandoverMemberSelect, {
  type HandoverMemberOption,
} from "./HandoverMemberSelect";
import HandoverDraftEditor from "./HandoverDraftEditor";
import HandoverPublishedView from "./HandoverPublishedView";
import HandoverTaskTransfersPanel from "./HandoverTaskTransfersPanel";
import HandoverQaPanel from "./HandoverQaPanel";
import HandoverFollowUpsPanel from "./HandoverFollowUpsPanel";
import {
  buildOrganizationSuccessorOptions,
  ensureProjectMemberBeforeHandover,
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatUtcDate,
  resolveMemberName,
  statusBadgeColor,
} from "./handover-ui.utils";

type DetailTab = "published" | "draft" | "tasks" | "qa" | "followups";

function computeInitials(name: string): string {
  const clean = name.trim();
  if (!clean || clean === "—") return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function computeUtcDaysRemaining(isoString: string): number | null {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return null;
  const targetMs = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
  const now = new Date();
  const todayMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));
}

function ParticipantAvatar({
  member,
  fallbackName,
  tone,
}: {
  member?: ProjectMembership;
  fallbackName: string;
  tone: "departing" | "coordinator" | "successor";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const avatarUrl = member?.user?.avatarUrl ?? null;
  const validUrl = avatarUrl && avatarUrl !== failedUrl ? avatarUrl : null;

  if (validUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={validUrl}
        alt=""
        onError={() => setFailedUrl(validUrl)}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
      />
    );
  }

  const toneClass =
    member?.status === "INACTIVE"
      ? "bg-warning-50 text-warning-700 ring-warning-200/90 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30"
      : tone === "coordinator"
        ? "bg-brand-50 text-brand-700 ring-brand-200/90 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
        : tone === "successor"
          ? "bg-success-50 text-success-700 ring-success-200/90 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30"
          : "bg-gray-100 text-gray-700 ring-gray-200/90 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-tight ring-1 ${toneClass}`}
    >
      {computeInitials(fallbackName)}
    </span>
  );
}

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

  const [activeTab, setActiveTab] = useState<DetailTab | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && moreMenuRef.current?.contains(target)) return;
      setMoreMenuOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreMenuOpen]);

  const projectQuery = useProjectQuery(organizationId, projectId);
  const membersQuery = useProjectMembersQuery(
    organizationId,
    projectId,
    {
      page: 1,
      pageSize: 100,
    },
    { allPages: true },
  );
  const candidatesQuery = useProjectMemberCandidatesQuery(
    organizationId,
    projectId,
    undefined,
    { enabled: modalMode === "successor" },
  );
  const addProjectMemberMutation = useAddProjectMember(
    organizationId,
    projectId,
  );
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
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  const coordinatorSelectOptions = useMemo<readonly HandoverMemberOption[]>(
    () =>
      activeMembers
        .map((m) => ({
          userId: m.userId,
          fullName: formatMemberOptionLabel(m),
          email: m.user?.email?.trim() || undefined,
          avatarUrl: m.user?.avatarUrl ?? null,
          status: m.status,
          roleCode: (m as { role?: string }).role,
          isCurrentUser: Boolean(currentUserId && m.userId === currentUserId),
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [activeMembers, currentUserId],
  );

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

  const {
    options: successorOptions,
    activeProjectUserIds: successorActiveProjectIds,
  } = useMemo(
    () =>
      buildOrganizationSuccessorOptions({
        activeProjectMembers: activeMembers,
        orgCandidates: candidatesQuery.data,
        departingUserId: handover?.departingUserId ?? "",
        currentUserId,
      }),
    [
      activeMembers,
      candidatesQuery.data,
      currentUserId,
      handover?.departingUserId,
    ],
  );

  const selectedNextSuccessor = useMemo(
    () => successorOptions.find((opt) => opt.userId === nextSuccessorId) ?? null,
    [nextSuccessorId, successorOptions],
  );

  const isSavingSuccessor =
    addProjectMemberMutation.isPending || setSuccessorMutation.isPending;

  const resolvedTab: DetailTab = useMemo(() => {
    if (activeTab) return activeTab;
    if (!publishedRevision && capabilities.includes("MANAGE")) {
      return "draft";
    }
    return "published";
  }, [activeTab, publishedRevision, capabilities]);

  const viewerRolePill = useMemo(() => {
    if (!handover) return null;
    if (currentUserId && currentUserId === handover.assignedLeaderId) {
      return {
        label: t("detail.roleYouCoordinator"),
        color: "primary" as const,
      };
    }
    if (currentUserId && currentUserId === handover.successorUserId) {
      return {
        label: t("detail.roleYouSuccessor"),
        color: "success" as const,
      };
    }
    if (currentUserId && currentUserId === handover.departingUserId) {
      return {
        label: t("detail.roleYouDeparting"),
        color: "info" as const,
      };
    }
    if (capabilities.includes("MANAGE")) {
      return {
        label: t("detail.roleManagerAccess"),
        color: "primary" as const,
      };
    }
    if (isOrgManager) {
      return {
        label: t("detail.roleOrgAdminAccess"),
        color: "warning" as const,
      };
    }
    return {
      label: t("detail.roleReadOnly"),
      color: "light" as const,
    };
  }, [capabilities, currentUserId, handover, isOrgManager, t]);

  const openMetadataModal = () => {
    if (!handover) return;
    setEditTitle(handover.title);
    setEditDate(handover.targetCompletionDate.slice(0, 10));
    setModalError(null);
    setMoreMenuOpen(false);
    setModalMode("metadata");
  };

  const openSuccessorModal = () => {
    if (!handover) return;
    setNextSuccessorId(handover.successorUserId ?? "");
    setSuccessorReason("");
    setModalError(null);
    setMoreMenuOpen(false);
    setModalMode("successor");
  };

  const openCoordinatorModal = () => {
    setNextCoordinatorId(handover?.assignedLeaderId ?? "");
    setCoordinatorReason("");
    setModalError(null);
    setMoreMenuOpen(false);
    setModalMode("coordinator");
  };

  const openCompleteModal = () => {
    setCompleteNote(
      "Verified all required knowledge items and readiness gates.",
    );
    setModalError(null);
    setMoreMenuOpen(false);
    setModalMode("complete");
  };

  const openCancelModal = () => {
    setCancelReason("");
    setModalError(null);
    setMoreMenuOpen(false);
    setModalMode("cancel");
  };

  const modalTitle =
    modalMode === "metadata"
      ? t("detail.metadataModalTitle")
      : modalMode === "successor"
        ? t("detail.successorModalTitle")
        : modalMode === "coordinator"
          ? t("detail.coordinatorModalTitle")
          : modalMode === "complete"
            ? t("detail.completeModalTitle")
            : modalMode === "cancel"
              ? t("detail.cancelModalTitle")
              : "";

  const modalDesc =
    modalMode === "successor"
      ? t("detail.successorModalDesc")
      : modalMode === "coordinator"
        ? t("detail.coordinatorModalDesc")
        : modalMode === "complete"
          ? t("detail.completeModalDesc")
          : modalMode === "cancel"
            ? t("detail.cancelModalDesc")
            : undefined;

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5">
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
          <span className="max-w-[240px] truncate font-semibold text-gray-900 dark:text-white">
            {handover?.title ?? handoverId.slice(0, 8)}
          </span>
        </nav>

        <Link
          href={listHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <ChevronLeftIcon
            className="size-3.5 rtl:rotate-180"
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
          <CheckCircleIcon className="size-4 shrink-0" />
          <span>{safeReceiptBanner}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {detailQuery.isPending && (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">{t("loadingDetail")}</span>
          <div className="h-44 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
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
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300">
              <LockIcon className="size-5" aria-hidden="true" />
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
                    onClick={openCoordinatorModal}
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
              <AlertIcon className="mt-0.5 size-5 text-error-600" />
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
      {detailResource && handover && (() => {
        const departingMember = membersById.get(handover.departingUserId);
        const coordinatorMember = membersById.get(handover.assignedLeaderId);
        const successorMember = handover.successorUserId
          ? membersById.get(handover.successorUserId)
          : undefined;

        const departingName = resolveMemberName(
          handover.departingUserId,
          membersById,
          "—",
        );
        const coordinatorName = resolveMemberName(
          handover.assignedLeaderId,
          membersById,
          "—",
        );
        const successorName = resolveMemberName(
          handover.successorUserId,
          membersById,
          t("status.unassignedSuccessor"),
        );

        const daysRemaining = computeUtcDaysRemaining(
          handover.targetCompletionDate,
        );
        const dueBadgeText =
          handover.status !== "OPEN" || daysRemaining === null
            ? null
            : daysRemaining < 0
              ? t("detail.dueOverdueDays", {
                  days: String(Math.abs(daysRemaining)),
                })
              : daysRemaining === 0
                ? t("detail.dueToday")
                : t("detail.dueInDays", { days: String(daysRemaining) });

        const step1Done =
          Boolean(publishedRevision) || handover.status === "COMPLETED";
        const step2Done =
          handover.status === "COMPLETED" || detailResource.detail.canComplete;
        const step3Done = handover.status === "COMPLETED";

        const readinessStatusLabel =
          handover.status === "COMPLETED"
            ? t("detail.gateCompleted")
            : handover.status === "CANCELLED"
              ? t("detail.gateCancelled")
              : detailResource.detail.canComplete
                ? t("detail.gateStepReady")
                : !publishedRevision
                  ? t("detail.gateStepPublish")
                  : detailResource.detail.requiredPendingCount > 0
                    ? t("detail.gateStepVerify", {
                        count: String(
                          detailResource.detail.requiredPendingCount,
                        ),
                      })
                    : t("detail.gateStepAccept");

        return (
          <>
            {detailQuery.isError && (
              <BackgroundRefreshError
                retryLabel={t("retry")}
                onRetry={() => void detailQuery.refetch()}
              >
                {t("loadErrorBody")}
              </BackgroundRefreshError>
            )}

            {/* Executive Hero Governance Card */}
            <header className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Title & Clean Status Strip */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={statusBadgeColor(handover.status)} size="sm">
                      {t(`status.${handover.status}`)}
                    </Badge>
                    {handover.overdue && handover.status === "OPEN" && (
                      <Badge color="error" size="sm">
                        {t("status.overdueBadge")}
                      </Badge>
                    )}
                    <Badge
                      color={publishedRevision ? "success" : "light"}
                      size="sm"
                    >
                      {publishedRevision
                        ? t("status.publishedRev", {
                            number: String(publishedRevision.number),
                          })
                        : t("status.unpublishedDraft", {
                            version: String(handover.draftVersion),
                          })}
                    </Badge>
                    {viewerRolePill && (
                      <Badge color={viewerRolePill.color} size="sm">
                        {viewerRolePill.label}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400 tabular-nums dark:text-gray-500">
                      {t("detail.compactVersionMeta", {
                        version: String(handover.version),
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
                </div>

                {/* Single-Line Executive Action Toolbar */}
                {(canManage || isOrgManager) && handover.status === "OPEN" && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canManage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 !px-3 !py-2 !text-xs"
                        startIcon={<PencilIcon className="size-3.5" />}
                        onClick={openMetadataModal}
                      >
                        {t("detail.editMetadataCta")}
                      </Button>
                    )}

                    {canManage && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="min-h-9 !px-3.5 !py-2 !text-xs"
                        startIcon={<CheckCircleIcon className="size-3.5" />}
                        disabled={!detailResource.detail.canComplete}
                        onClick={openCompleteModal}
                      >
                        {t("detail.completeCta")}
                      </Button>
                    )}

                    {!canManage && isOrgManager && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 !px-3 !py-2 !text-xs"
                        onClick={openCoordinatorModal}
                      >
                        {t("detail.changeCoordinatorCta")}
                      </Button>
                    )}

                    {/* Overflow Governance Menu (keeps destructive Cancel tucked safely away) */}
                    {canManage && (
                      <div ref={moreMenuRef} className="relative">
                        <button
                          type="button"
                          aria-label={t("detail.moreActionsAria")}
                          aria-haspopup="menu"
                          aria-expanded={moreMenuOpen}
                          onClick={() => setMoreMenuOpen((prev) => !prev)}
                          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg bg-white text-gray-600 shadow-theme-xs ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:outline-none dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                        >
                          <HorizontaLDots
                            className="size-4.5"
                            aria-hidden="true"
                          />
                        </button>

                        {moreMenuOpen && (
                          <div
                            role="menu"
                            aria-label={t("detail.moreActionsAria")}
                            className="absolute end-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-xl ring-1 ring-gray-950/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={openSuccessorModal}
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                              <UserCircleIcon
                                className="size-4 shrink-0 text-gray-400"
                                aria-hidden="true"
                              />
                              <span>{t("detail.assignSuccessorCta")}</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={openCoordinatorModal}
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                              <GroupIcon
                                className="size-4 shrink-0 text-gray-400"
                                aria-hidden="true"
                              />
                              <span>{t("detail.changeCoordinatorCta")}</span>
                            </button>

                            <div
                              role="separator"
                              className="my-1 border-t border-gray-100 dark:border-gray-800"
                            />

                            <button
                              type="button"
                              role="menuitem"
                              onClick={openCancelModal}
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-medium text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                            >
                              <CloseLineIcon
                                className="size-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{t("detail.cancelCta")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Unified 4-Card Transition Roles & Readiness Strip */}
              <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2 xl:grid-cols-4 dark:border-gray-800">
                {/* Card 1: Departing (A) */}
                <div className="flex flex-col justify-between rounded-xl border border-gray-200/75 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-gray-200/80 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        A
                      </span>
                      <span>{t("detail.cardDepartingLabel")}</span>
                    </dt>
                    {departingMember?.status === "INACTIVE" && (
                      <Badge color="warning" size="sm">
                        {t("createModal.departedBadge")}
                      </Badge>
                    )}
                  </div>

                  <dd className="mt-2.5 flex items-center gap-2.5">
                    <ParticipantAvatar
                      member={departingMember}
                      fallbackName={departingName}
                      tone="departing"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {departingName}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {departingMember?.user?.email?.trim() ||
                          (departingMember?.status === "INACTIVE"
                            ? t("detail.memberDepartedSub")
                            : t("detail.memberActiveSub"))}
                      </p>
                    </div>
                  </dd>
                </div>

                {/* Card 2: Coordinator (D) */}
                <div className="flex flex-col justify-between rounded-xl border border-gray-200/75 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30">
                        D
                      </span>
                      <span>{t("detail.cardCoordinatorLabel")}</span>
                    </dt>

                    {(canManage ||
                      (isOrgManager && handover.status === "OPEN")) && (
                      <button
                        type="button"
                        aria-label={t("detail.changeCoordinatorCta")}
                        onClick={openCoordinatorModal}
                        className="cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:text-brand-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
                      >
                        {t("detail.cardChangeShort")}
                      </button>
                    )}
                  </div>

                  <dd className="mt-2.5 flex items-center gap-2.5">
                    <ParticipantAvatar
                      member={coordinatorMember}
                      fallbackName={coordinatorName}
                      tone="coordinator"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {coordinatorName}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {coordinatorMember?.user?.email?.trim() ||
                          t("createModal.verifiedLeaderHint")}
                      </p>
                    </div>
                  </dd>
                </div>

                {/* Card 3: Successor (B) */}
                <div className="flex flex-col justify-between rounded-xl border border-gray-200/75 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <span
                        className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${
                          handover.successorUserId
                            ? "bg-success-50 text-success-700 ring-success-200/80 dark:bg-success-500/20 dark:text-success-300 dark:ring-success-500/30"
                            : "bg-gray-100 text-gray-500 ring-dashed ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600"
                        }`}
                      >
                        B
                      </span>
                      <span>{t("detail.cardSuccessorLabel")}</span>
                    </dt>

                    {canManage && (
                      <button
                        type="button"
                        aria-label={t("detail.assignSuccessorCta")}
                        onClick={openSuccessorModal}
                        className="cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:text-brand-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
                      >
                        {handover.successorUserId
                          ? t("detail.cardChangeShort")
                          : t("detail.cardAssignShort")}
                      </button>
                    )}
                  </div>

                  <dd className="mt-2.5 flex items-center gap-2.5">
                    {handover.successorUserId ? (
                      <>
                        <ParticipantAvatar
                          member={successorMember}
                          fallbackName={successorName}
                          tone="successor"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {successorName}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {successorMember?.user?.email?.trim() ||
                              t("detail.memberActiveSub")}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                        >
                          <UserCircleIcon className="size-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-600 dark:text-gray-300">
                            {t("status.unassignedSuccessor")}
                          </p>
                          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                            {t("detail.successorUnassignedSub")}
                          </p>
                        </div>
                      </>
                    )}
                  </dd>
                </div>

                {/* Card 4: Target Date & Readiness Progress */}
                <div className="flex flex-col justify-between rounded-xl border border-gray-200/75 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <CalenderIcon
                        className="size-3.5 shrink-0 text-gray-400"
                        aria-hidden="true"
                      />
                      <span className="truncate">{t("detail.cardReadinessLabel")}</span>
                    </dt>

                    {dueBadgeText && (
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        <Badge
                          color={
                            daysRemaining !== null && daysRemaining < 0
                              ? "error"
                              : daysRemaining !== null && daysRemaining <= 3
                                ? "warning"
                                : "light"
                          }
                          size="sm"
                        >
                          {dueBadgeText}
                        </Badge>
                      </span>
                    )}
                  </div>

                  <dd className="mt-2.5 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                        {formatUtcDate(handover.targetCompletionDate)}
                      </span>
                    </div>

                    {handover.status !== "CANCELLED" && (
                      <div
                        aria-hidden="true"
                        className="grid grid-cols-3 gap-1"
                      >
                        <span
                          className={`h-1.5 rounded-full transition-colors ${
                            step1Done
                              ? "bg-brand-500"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                        <span
                          className={`h-1.5 rounded-full transition-colors ${
                            step2Done
                              ? "bg-brand-500"
                              : step1Done
                                ? "bg-warning-400"
                                : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                        <span
                          className={`h-1.5 rounded-full transition-colors ${
                            step3Done
                              ? "bg-success-500"
                              : detailResource.detail.canComplete
                                ? "bg-success-400"
                                : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      </div>
                    )}

                    <p
                      className={`truncate text-xs font-medium tabular-nums ${
                        handover.status === "COMPLETED" ||
                        detailResource.detail.canComplete
                          ? "text-success-700 dark:text-success-400"
                          : handover.status === "CANCELLED"
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-warning-700 dark:text-warning-300"
                      }`}
                    >
                      {readinessStatusLabel}
                    </p>
                  </dd>
                </div>
              </dl>
            </header>

            {/* Workspace Section Tabs */}
            <nav
              aria-label={t("detail.tabsAriaLabel")}
              className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200/80 bg-white p-1 shadow-theme-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-gray-800 dark:bg-gray-900"
            >
              {(
                [
                  {
                    id: "published" as const,
                    label: t("detail.tabPublished"),
                    icon: BookOpenIcon,
                  },
                  ...(capabilities.includes("MANAGE") &&
                  handover.status === "OPEN"
                    ? [
                        {
                          id: "draft" as const,
                          label: t("detail.tabDraft"),
                          icon: DocsIcon,
                        },
                      ]
                    : []),
                  {
                    id: "tasks" as const,
                    label: t("detail.tabTasks"),
                    icon: TaskIcon,
                  },
                  {
                    id: "qa" as const,
                    label: t("detail.tabQa"),
                    icon: ChatIcon,
                  },
                  {
                    id: "followups" as const,
                    label: t("detail.tabFollowUps"),
                    icon: HandShakeIcon,
                  },
                ] as const
              ).map((tab) => {
                const TabIcon = tab.icon;
                const isSelected = resolvedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:gap-2 lg:px-3.5 lg:text-sm ${
                      isSelected
                        ? "bg-brand-50 text-brand-700 shadow-theme-xs ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    }`}
                  >
                    <TabIcon
                      className={`size-4 shrink-0 ${
                        isSelected
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
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
        );
      })()}

      {/* Lifecycle Governance Modals */}
      <HandoverDialogShell
        isOpen={modalMode !== null}
        onClose={() => {
          if (isSavingSuccessor) return;
          setModalMode(null);
        }}
        title={modalTitle}
        description={modalDesc}
        closeLabel={t("createModal.closeDialog")}
        size="md"
        destructive={modalMode === "cancel"}
        disableClose={isSavingSuccessor}
        icon={
          modalMode === "cancel" ? (
            <AlertIcon className="size-5" />
          ) : modalMode === "successor" ? (
            <UserCircleIcon className="size-5" />
          ) : modalMode === "coordinator" ? (
            <GroupIcon className="size-5" />
          ) : (
            <HandShakeIcon className="size-5" />
          )
        }
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
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label
                htmlFor="handover-edit-title"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("createModal.titleLabel")}
              </label>
              <input
                id="handover-edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="handover-edit-target-date"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("createModal.targetDateLabel")}
              </label>
              <HandoverDatePicker
                id="handover-edit-target-date"
                value={editDate}
                onChange={setEditDate}
                placeholder={t("createModal.targetDatePlaceholder")}
                dialogLabel={t("createModal.calendarDialogLabel")}
                todayLabel={t("createModal.calendarToday")}
                prevMonthLabel={t("createModal.calendarPrevMonth")}
                nextMonthLabel={t("createModal.calendarNextMonth")}
                utcNoteLabel={t("createModal.calendarUtcNote")}
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
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
              const cleanSuccessor = nextSuccessorId.trim() || null;
              if (
                cleanSuccessor &&
                cleanSuccessor === handover.departingUserId
              ) {
                setModalError(t("createModal.validationSamePerson"));
                return;
              }

              try {
                await ensureProjectMemberBeforeHandover({
                  successorUserId: cleanSuccessor,
                  activeProjectUserIds: successorActiveProjectIds,
                  addProjectMember: (uid) =>
                    addProjectMemberMutation.mutateAsync(uid),
                });
              } catch (err) {
                setModalError(
                  extractHandoverErrorMessage(
                    err,
                    t("createModal.autoAddMemberFailed"),
                  ),
                );
                return;
              }

              try {
                await setSuccessorMutation.mutateAsync({
                  etag,
                  input: {
                    successorUserId: cleanSuccessor,
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
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="handover-detail-successor"
                  className="block text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {t("createModal.successorLabel")}
                </label>
                <Badge color="light" size="sm">
                  {t("createModal.optionalBadge")}
                </Badge>
              </div>
              {successorOptions.length > 0 ||
              activeMembers.length > 0 ||
              candidatesQuery.isPending ? (
                <HandoverMemberSelect
                  id="handover-detail-successor"
                  value={nextSuccessorId}
                  onChange={setNextSuccessorId}
                  options={successorOptions}
                  placeholder={t("createModal.noSuccessorYet")}
                  allowEmpty
                  emptyOptionLabel={t("createModal.noSuccessorYet")}
                  emptyOptionHint={t("createModal.successorRoleHint")}
                  alwaysShowSearch={successorOptions.length >= 2}
                  searchPlaceholder={t(
                    "createModal.searchOrgMembersPlaceholder",
                  )}
                  noMatchesLabel={t("createModal.noMatchingOrgMembers")}
                  activeBadgeLabel={t("createModal.activeBadge")}
                  departedBadgeLabel={t("createModal.departedBadge")}
                  youBadgeLabel={t("createModal.youBadge")}
                  inProjectBadgeLabel={t("createModal.inProjectBadge")}
                  orgCandidateBadgeLabel={t("createModal.orgCandidateBadge")}
                  projectGroupLabel={t("createModal.projectGroupHeading")}
                  orgCandidateGroupLabel={t(
                    "createModal.orgCandidateGroupHeading",
                  )}
                />
              ) : (
                <input
                  id="handover-detail-successor"
                  type="text"
                  value={nextSuccessorId}
                  onChange={(e) => setNextSuccessorId(e.target.value)}
                  placeholder={t("createModal.noSuccessorYet")}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
              {selectedNextSuccessor?.membershipScope === "ORG_CANDIDATE" && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-light-50/70 px-3 py-2 text-xs text-blue-light-700 ring-1 ring-blue-light-200/70 dark:bg-blue-light-500/10 dark:text-blue-light-300 dark:ring-blue-light-500/25">
                  <CheckCircleIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{t("createModal.autoAddProjectNotice")}</span>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="handover-successor-reason"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("detail.successorReasonLabel")} *
              </label>
              <textarea
                id="handover-successor-reason"
                rows={3}
                value={successorReason}
                onChange={(e) => setSuccessorReason(e.target.value)}
                placeholder={t("detail.successorReasonPlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingSuccessor}
                onClick={() => setModalMode(null)}
              >
                {t("createModal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingSuccessor}
              >
                {addProjectMemberMutation.isPending
                  ? t("detail.savingSuccessorAutoAdd")
                  : t("detail.saveSuccessor")}
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
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                  {t("detail.expectedVersionLabel")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={fallbackVersion}
                  onChange={(e) => setFallbackVersion(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="handover-detail-coordinator"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("createModal.coordinatorLabel")} *
              </label>
              {coordinatorSelectOptions.length > 0 ? (
                <HandoverMemberSelect
                  id="handover-detail-coordinator"
                  value={nextCoordinatorId}
                  onChange={setNextCoordinatorId}
                  options={coordinatorSelectOptions}
                  placeholder={t("createModal.selectCoordinatorPlaceholder")}
                  searchPlaceholder={t("createModal.searchMembersPlaceholder")}
                  noMatchesLabel={t("createModal.noMatchingMembers")}
                  activeBadgeLabel={t("createModal.activeBadge")}
                  departedBadgeLabel={t("createModal.departedBadge")}
                  youBadgeLabel={t("createModal.youBadge")}
                />
              ) : (
                <input
                  id="handover-detail-coordinator"
                  type="text"
                  value={nextCoordinatorId}
                  onChange={(e) => setNextCoordinatorId(e.target.value)}
                  placeholder={t("detail.manualLeaderIdPlaceholder")}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
            <div>
              <label
                htmlFor="handover-coordinator-reason"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("detail.coordinatorReasonLabel")} *
              </label>
              <textarea
                id="handover-coordinator-reason"
                rows={3}
                value={coordinatorReason}
                onChange={(e) => setCoordinatorReason(e.target.value)}
                placeholder={t("detail.coordinatorReasonPlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
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
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label
                htmlFor="handover-complete-note"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("detail.completeNoteLabel")} *
              </label>
              <textarea
                id="handover-complete-note"
                rows={3}
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder={t("detail.completeNotePlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
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
            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-error-50 p-3 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-300"
              >
                {modalError}
              </div>
            )}
            <div>
              <label
                htmlFor="handover-cancel-reason"
                className="block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("detail.cancelReasonLabel")} *
              </label>
              <textarea
                id="handover-cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("detail.cancelReasonPlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-error-500 focus:ring-3 focus:ring-error-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
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
      </HandoverDialogShell>
    </div>
  );
}
