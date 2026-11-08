"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link } from "@/i18n/navigation";
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { formatProjectSectionTitle } from "@/lib/page-titles";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import {
  useAddProjectMember,
  useProjectMemberCandidatesQuery,
  useProjectMembersQuery,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import { useProjectLeadersQuery } from "@/lib/queries/projects/useProjectLeaders";
import {
  useCancelHandoverMutation,
  useCompleteHandoverMutation,
  useHandoverDetailQuery,
  useSetHandoverCoordinatorMutation,
  useSetHandoverSuccessorMutation,
  useUpdateHandoverMetadataMutation,
} from "@/lib/queries/handovers/useHandovers";
import {
  autoBundleHandover,
  formatHandoverEtag,
  generateIdempotencyKey,
  previewDepartingMember,
  quickAcceptHandover,
  quickTransferHandoverTasks,
} from "@/lib/queries/handovers/handover.service";
import type { DepartingMemberPreviewDto } from "@/lib/queries/handovers/handover.types";
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
  ChevronDownIcon,
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
import HandoverParticipantWorkspace from "./HandoverParticipantWorkspace";
import HandoverTaskTransfersPanel from "./HandoverTaskTransfersPanel";
import HandoverQaPanel from "./HandoverQaPanel";
import HandoverFollowUpsPanel from "./HandoverFollowUpsPanel";
import {
  buildOrganizationSuccessorOptions,
  buildSourceWorkspaceHref,
  ensureProjectMemberBeforeHandover,
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatUtcDate,
  resolveMemberName,
  statusBadgeColor,
} from "./handover-ui.utils";

type DetailTab = "published" | "draft" | "tasks" | "qa" | "followups";
type ScopeFilter = "ALL" | "TASKS" | "TASK_NOTE" | "PROJECT_DOCUMENT" | "WORK_REPORT";

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
  preferParticipant = false,
}: {
  projectId: string;
  handoverId: string;
  preferParticipant?: boolean;
}) {
  const t = useTranslations("handover");
  const t5 = useTranslations("handover.fiveStep");
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId ?? "";
  const currentUserId = currentUser.data?.id ?? "";
  const isOrgManager = Boolean(currentUser.data?.roles?.includes("ADMIN"));

  const [activeTab, setActiveTab] = useState<DetailTab | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 5-Step Quick Action States
  const [previewData, setPreviewData] =
    useState<DepartingMemberPreviewDto | null>(null);
  const [isAutoBundling, setIsAutoBundling] = useState(false);
  const [isQuickTransferring, setIsQuickTransferring] = useState(false);
  const [isQuickAccepting, setIsQuickAccepting] = useState(false);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [quickActionSuccess, setQuickActionSuccess] = useState<string | null>(
    null,
  );
  const [isInlineAiOpen, setIsInlineAiOpen] = useState(false);
  const [showAllScopeItems, setShowAllScopeItems] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<
    Record<string, boolean>
  >({});
  const [showPublishedAuditChecklist, setShowPublishedAuditChecklist] =
    useState(false);

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
  const leadersQuery = useProjectLeadersQuery(organizationId, projectId);
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
    for (const leader of leadersQuery.data ?? []) {
      if (!map.has(leader.userId)) {
        map.set(leader.userId, {
          id: `leader-${leader.userId}`,
          organizationId,
          projectId,
          userId: leader.userId,
          status: leader.status,
          joinedAt: "",
          user: {
            id: leader.userId,
            fullName: leader.fullName,
            email: leader.email,
            avatarUrl: leader.avatarUrl,
          },
        });
      }
    }
    return map;
  }, [leadersQuery.data, members, organizationId, projectId]);

  const verifiedLeadersMap = useMemo(() => {
    const map = new Map<string, HandoverMemberOption>();
    for (const leader of leadersQuery.data ?? []) {
      if (leader.status !== "ACTIVE") continue;
      map.set(leader.userId, {
        userId: leader.userId,
        fullName:
          leader.fullName.trim() ||
          leader.email.trim() ||
          `User ${leader.userId.slice(0, 6)}`,
        email: leader.email.trim() || undefined,
        avatarUrl: leader.avatarUrl,
        status: "ACTIVE",
        roleCode: "TEAM_LEADER",
        isCurrentUser: Boolean(
          currentUserId && leader.userId === currentUserId,
        ),
      });
    }
    for (const member of activeMembers) {
      const rawRole =
        (member as { role?: unknown; roleCode?: unknown }).role ??
        (member as { roleCode?: unknown }).roleCode;
      const role = typeof rawRole === "string" ? rawRole.toUpperCase() : "";
      if (
        (role === "TEAM_LEADER" || role === "LEADER") &&
        !map.has(member.userId)
      ) {
        map.set(member.userId, {
          userId: member.userId,
          fullName: formatMemberOptionLabel(member),
          email: member.user?.email?.trim() || undefined,
          avatarUrl: member.user?.avatarUrl ?? null,
          status: member.status,
          roleCode: "TEAM_LEADER",
          isCurrentUser: Boolean(
            currentUserId && member.userId === currentUserId,
          ),
        });
      }
    }
    return map;
  }, [activeMembers, currentUserId, leadersQuery.data]);

  const coordinatorSelectOptions = useMemo<readonly HandoverMemberOption[]>(
    () =>
      Array.from(verifiedLeadersMap.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      ),
    [verifiedLeadersMap],
  );

  const encodedProjectId = encodeURIComponent(projectId);
  const listHref = `/projects/${encodedProjectId}/handover`;
  const projectName =
    projectQuery.data?.name ??
    t("projectFallback", { id: projectId.slice(0, 8) });

  const isAccessDenied =
    detailQuery.error instanceof ApiError &&
    [401, 403, 404].includes(detailQuery.error.status);

  const tPage = useTranslations("pageTitles");
  const detailResource = detailQuery.data;
  const handover = detailResource?.detail.handover;
  const projectAccessLost =
    isAccessOrResourceUnavailableError(currentUser.error) ||
    isAccessOrResourceUnavailableError(projectQuery.error);
  useDocumentTitle(
    formatProjectSectionTitle(
      !projectAccessLost ? projectQuery.data?.name : null,
      !isAccessDenied && handover?.title
        ? handover.title
        : tPage("projectHandoverDetail"),
    ),
  );
  const publishedRevision = detailResource?.detail.publishedRevision ?? null;
  const capabilities = useMemo(
    () => detailResource?.detail.capabilities ?? [],
    [detailResource?.detail.capabilities],
  );
  const etag = detailResource?.etag ?? "";

  const canManage =
    capabilities.includes("MANAGE") && handover?.status === "OPEN";
  const canTransfer =
    (capabilities.includes("TRANSFER") || capabilities.includes("MANAGE")) &&
    handover?.status === "OPEN";
  const canReceive =
    capabilities.includes("RECEIVE") && handover?.status === "OPEN";
  const participantView = detailResource?.detail.participantView;
  const useParticipantView = Boolean(participantView && (!canManage || preferParticipant));

  // Fetch auto-aggregated departing member scope (Tasks, Task Notes, Documents, Work Reports, Related Projects)
  useEffect(() => {
    const depId = handover?.departingUserId?.trim() ?? "";
    if (!canManage || useParticipantView || !/^[a-f0-9]{24}$/i.test(depId) || !/^[a-f0-9]{24}$/i.test(projectId)) {
      return;
    }
    const controller = new AbortController();
    previewDepartingMember(projectId, depId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setPreviewData(res);
        }
      })
      .catch(() => {
        // Non-blocking in test/restricted environments
      });
    return () => controller.abort();
  }, [canManage, useParticipantView, handover?.departingUserId, handover?.version, projectId]);

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

  const isCoordinatorRecoveryOnly = useMemo(() => {
    if (!isOrgManager || !handover) return false;
    if (capabilities.some((cap) => cap !== "READ")) {
      return false;
    }
    if (
      currentUserId &&
      ((activeMembers.some((member) => member.userId === currentUserId) &&
        (currentUserId === handover.departingUserId ||
          currentUserId === handover.successorUserId)) ||
        verifiedLeadersMap.has(currentUserId))
    ) {
      return false;
    }
    return true;
  }, [
    activeMembers,
    capabilities,
    currentUserId,
    handover,
    isOrgManager,
    verifiedLeadersMap,
  ]);

  const resolvedTab: DetailTab = useMemo(() => {
    if (isCoordinatorRecoveryOnly) return "published";
    if (activeTab) return activeTab;
    if (!publishedRevision && capabilities.includes("MANAGE")) {
      return "draft";
    }
    return "published";
  }, [activeTab, publishedRevision, capabilities, isCoordinatorRecoveryOnly]);

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

  const pendingQuickCommands = useRef(new Map<string, { etag: string; key: string }>());
  async function runQuickCommand<T>(
    operation: string,
    command: (targetEtag: string, key: string) => Promise<T>,
  ): Promise<T> {
    const intent = pendingQuickCommands.current.get(operation) ?? {
      etag: etag || formatHandoverEtag(handover!.id, handover!.version),
      key: generateIdempotencyKey(),
    };
    pendingQuickCommands.current.set(operation, intent);
    try {
      const result = await command(intent.etag, intent.key);
      pendingQuickCommands.current.delete(operation);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        pendingQuickCommands.current.delete(operation);
      }
      throw error;
    }
  }

  const handleAutoBundleNow = async () => {
    if (!handover) return;
    setQuickActionError(null);
    setQuickActionSuccess(null);
    setIsAutoBundling(true);
    try {
      await runQuickCommand("bundle", (targetEtag, key) =>
        autoBundleHandover(projectId, handover.id, targetEtag, {}, key),
      );
      setQuickActionSuccess(t5("autoBundleSuccessBanner"));
      setActiveTab("published");
      await detailQuery.refetch?.();
    } catch (err) {
      setQuickActionError(
        extractHandoverErrorMessage(err, "Could not auto-bundle handover."),
      );
    } finally {
      setIsAutoBundling(false);
    }
  };

  const handleQuickTransferNow = async ( successorDisplayName: string ) => {
    if (!handover) return;
    setQuickActionError(null);
    setQuickActionSuccess(null);
    setIsQuickTransferring(true);
    try {
      const res = await runQuickCommand("transfer", (targetEtag, key) =>
        quickTransferHandoverTasks(projectId, handover.id, targetEtag, {}, key),
      );
      const committedCount = res.data.tasks.filter(
        (task) => task.state === "CONFIRMED",
      ).length;
      const alreadyAssigned = res.data.tasks.filter((task) => task.disposition === "ALREADY_ASSIGNED").length;
      if (res.data.state === "CONFIRMED") {
        setQuickActionSuccess(
          res.data.tasks.length === 0
            ? t5("noPinnedTasks")
            : t5("quickTransferVerified", {
                count: committedCount - alreadyAssigned,
                already: alreadyAssigned,
                successor: successorDisplayName,
              }),
        );
      } else {
        setQuickActionError(t5("quickTransferIncomplete", {
          count: res.data.tasks.length - committedCount,
        }));
      }
      await detailQuery.refetch?.();
    } catch (err) {
      setQuickActionError(
        extractHandoverErrorMessage(err, "Could not transfer unfinished tasks."),
      );
    } finally {
      setIsQuickTransferring(false);
    }
  };

  const handleQuickAcceptNow = async () => {
    if (!handover) return;
    setQuickActionError(null);
    setQuickActionSuccess(null);
    setIsQuickAccepting(true);
    try {
      await runQuickCommand("accept", (targetEtag, key) =>
        quickAcceptHandover(projectId, handover.id, targetEtag, {}, key),
      );
      setQuickActionSuccess(t5("quickAcceptSuccessBanner"));
      await detailQuery.refetch?.();
    } catch (err) {
      setQuickActionError(
        extractHandoverErrorMessage(err, "Could not confirm handover receipt."),
      );
    } finally {
      setIsQuickAccepting(false);
    }
  };

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
    const currentLeaderId = handover?.assignedLeaderId ?? "";
    const preselectedLeaderId =
      currentLeaderId &&
      (coordinatorSelectOptions.length === 0 ||
        coordinatorSelectOptions.some((opt) => opt.userId === currentLeaderId))
        ? currentLeaderId
        : "";
    setNextCoordinatorId(preselectedLeaderId);
    if (handover?.version) {
      setFallbackVersion(String(handover.version));
    }
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
      {useParticipantView && participantView && handover && !isAccessDenied && (
        <>
          {detailQuery.isError && (
            <BackgroundRefreshError retryLabel={t("retry")} onRetry={() => void detailQuery.refetch()}>
              {t("participant.refreshError")}
            </BackgroundRefreshError>
          )}
          <HandoverParticipantWorkspace projectId={projectId} handover={handover}
            view={participantView} published={Boolean(publishedRevision)} canManage={canManage}
            busy={isQuickAccepting} actionError={quickActionError} onAccept={() => void handleQuickAcceptNow()}>
            <HandoverPublishedView projectId={projectId} handover={handover} publishedRevision={publishedRevision}
              etag={etag} capabilities={capabilities.filter((capability) => capability === "READ" || capability === "RECEIVE")}
              currentUserId={currentUserId} members={members} hidePackageAcceptance />
          </HandoverParticipantWorkspace>
        </>
      )}
      {!useParticipantView && detailResource &&
        handover &&
        (() => {
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
            handover.status === "COMPLETED" ||
            detailResource.detail.canComplete;
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

          const previewTasks = previewData?.tasks ?? [];
          const transferScope = detailResource.detail.taskTransfer;
          const transferCount = transferScope?.selectedCount ?? previewTasks.length;
          const transferComplete = Boolean(transferScope && transferCount > 0 && transferScope.verifiedCount === transferCount);
          const previewSources = previewData?.sources ?? [];
          const sourceTitleMap: Record<string, string> = {};
          for (const s of previewSources) {
            sourceTitleMap[`${s.kind}:${s.id}`] = s.title;
            sourceTitleMap[s.id] = s.title;
          }
          const previewNotes = previewSources.filter(
            (s) => s.kind === "TASK_NOTE",
          );
          const previewDocs = previewSources.filter(
            (s) => s.kind === "PROJECT_DOCUMENT",
          );
          const previewReports = previewSources.filter(
            (s) => s.kind === "WORK_REPORT",
          );

          const allReadableItemsUnderstood =
            Boolean(publishedRevision) &&
            publishedRevision!.items.every(
              (item) =>
                item.access === "UNAVAILABLE" ||
                item.acknowledgement === "UNDERSTOOD",
            ) &&
            detailResource.detail.canComplete;

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
                      <Badge
                        color={statusBadgeColor(handover.status)}
                        size="sm"
                      >
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
                  {(canManage || isOrgManager) &&
                    handover.status === "OPEN" && (
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
                                  <span>
                                    {t("detail.changeCoordinatorCta")}
                                  </span>
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
                        <span className="truncate">
                          {t("detail.cardReadinessLabel")}
                        </span>
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

              {/* Compact 1-Line Action & Progressive Disclosure Bar */}
              {!isCoordinatorRecoveryOnly && handover.status === "OPEN" && (
                <section className="rounded-2xl border border-gray-200/90 bg-white px-4 py-3.5 shadow-theme-xs sm:px-5 dark:border-gray-800 dark:bg-gray-900">
                  {quickActionError && (
                    <div
                      role="alert"
                      className="mb-3 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                    >
                      <AlertIcon className="size-4 shrink-0" />
                      <span>{quickActionError}</span>
                    </div>
                  )}

                  {quickActionSuccess && (
                    <div
                      role="status"
                      className="mb-3 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-3.5 py-2 text-xs text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
                    >
                      <CheckCircleIcon className="size-4 shrink-0" />
                      <span>{quickActionSuccess}</span>
                    </div>
                  )}

                  {!publishedRevision && canManage ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t5("autoBundleCardTitle")}
                        </h2>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {t5("autoBundleCardDesc")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={isAutoBundling}
                        onClick={() => void handleAutoBundleNow()}
                      >
                        {isAutoBundling
                          ? t5("autoBundling")
                          : t5("autoBundleCta")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Compact Status Pills */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {!handover.successorUserId ? (
                          <Badge color="warning" size="sm">
                            {t5("managerCardDescNoSuccessor")}
                          </Badge>
                        ) : transferComplete && transferCount > 0 ? (
                          <Badge color="success" size="sm">
                            {t5("quickTransferDoneBadge")} ({transferCount})
                          </Badge>
                        ) : (transferScope || previewData !== null) &&
                          transferCount === 0 ? (
                          <Badge color="light" size="sm">
                            {t5("noPinnedTasks")}
                          </Badge>
                        ) : (
                          <Badge color="warning" size="sm">
                            {t5("managerCardDescReady", {
                              count: String(transferCount),
                              successor: successorName,
                            })}
                          </Badge>
                        )}

                        {handover.successorUserId && (
                          <Badge
                            color={
                              allReadableItemsUnderstood ? "success" : "warning"
                            }
                            size="sm"
                          >
                            {allReadableItemsUnderstood
                              ? t5("quickAcceptDoneBadge")
                              : t5("waitingForSuccessorBadge", {
                                  successor: successorName,
                                })}
                          </Badge>
                        )}
                      </div>

                      {/* Right: On-Demand Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {canTransfer &&
                          Boolean(handover.successorUserId) &&
                          !transferComplete &&
                          transferCount > 0 && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              isLoading={isQuickTransferring}
                              onClick={() =>
                                void handleQuickTransferNow(successorName)
                              }
                            >
                              {isQuickTransferring
                                ? t5("quickTransferring")
                                : t5("quickTransferCta", {
                                    count: String(transferCount),
                                    successor: successorName,
                                  })}
                            </Button>
                          )}

                        {canReceive &&
                          (participantView?.canQuickAccept ?? true) && (
                            <Button
                              type="button"
                              variant={
                                allReadableItemsUnderstood
                                  ? "outline"
                                  : "primary"
                              }
                              size="sm"
                              isLoading={isQuickAccepting}
                              onClick={() => void handleQuickAcceptNow()}
                            >
                              {isQuickAccepting
                                ? t5("quickAccepting")
                                : t5("quickAcceptCta")}
                            </Button>
                          )}

                        <Button
                          type="button"
                          variant={isInlineAiOpen ? "primary" : "outline"}
                          size="sm"
                          startIcon={<ChatIcon className="size-3.5" />}
                          onClick={() => {
                            setActiveTab("published");
                            setIsInlineAiOpen((prev) => !prev);
                          }}
                        >
                          {isInlineAiOpen
                            ? t5("toggleAiChatHide")
                            : t5("toggleAiChatShow")}
                        </Button>

                        {canManage && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={isAutoBundling}
                            onClick={() => void handleAutoBundleNow()}
                          >
                            {isAutoBundling
                              ? t5("autoBundling")
                              : t5("resyncBundleCta")}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

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
                    ...(!isCoordinatorRecoveryOnly
                      ? [
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
                        ]
                      : []),
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
              {resolvedTab === "published" &&
                (isCoordinatorRecoveryOnly ? (
                  <HandoverPublishedView
                    projectId={projectId}
                    handover={handover}
                    publishedRevision={publishedRevision}
                    etag={etag}
                    capabilities={capabilities}
                    currentUserId={currentUserId}
                    members={members}
                  />
                ) : (
                  (() => {
                    const hasPreviewScope = Boolean(
                      previewData &&
                        (previewTasks.length > 0 ||
                          previewSources.length > 0 ||
                          previewData.relatedProjects.length > 0),
                    );
                    const filteredTasks =
                      scopeFilter === "ALL" || scopeFilter === "TASKS"
                        ? previewTasks
                        : [];
                    const filteredSources = previewSources.filter(
                      (src) =>
                        scopeFilter === "ALL" || src.kind === scopeFilter,
                    );
                    const totalFilteredCount =
                      filteredTasks.length + filteredSources.length;
                    const visibleTaskLimit = showAllScopeItems
                      ? filteredTasks.length
                      : Math.min(filteredTasks.length, 6);
                    const remainingSlotForSources = showAllScopeItems
                      ? filteredSources.length
                      : Math.max(0, 6 - visibleTaskLimit);
                    const visibleTasks = filteredTasks.slice(
                      0,
                      visibleTaskLimit,
                    );
                    const visibleSources = filteredSources.slice(
                      0,
                      remainingSlotForSources,
                    );
                    const hiddenCount =
                      totalFilteredCount -
                      (visibleTasks.length + visibleSources.length);

                    return (
                      <div
                        className={
                          isInlineAiOpen
                            ? "grid grid-cols-1 gap-5 xl:grid-cols-12"
                            : "space-y-4"
                        }
                      >
                        <div
                          className={
                            isInlineAiOpen
                              ? "min-w-0 space-y-4 xl:col-span-7"
                              : "min-w-0 space-y-4"
                          }
                        >
                          {hasPreviewScope && previewData && (
                            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
                              {/* Filter Pills */}
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    {
                                      id: "ALL" as const,
                                      label: t5("filterAll", {
                                        count: String(
                                          previewTasks.length +
                                            previewSources.length,
                                        ),
                                      }),
                                    },
                                    {
                                      id: "TASKS" as const,
                                      label: t5("filterTasks", {
                                        count: String(previewTasks.length),
                                      }),
                                    },
                                    {
                                      id: "TASK_NOTE" as const,
                                      label: t5("filterTaskNotes", {
                                        count: String(previewNotes.length),
                                      }),
                                    },
                                    {
                                      id: "PROJECT_DOCUMENT" as const,
                                      label: t5("filterDocuments", {
                                        count: String(previewDocs.length),
                                      }),
                                    },
                                    {
                                      id: "WORK_REPORT" as const,
                                      label: t5("filterReports", {
                                        count: String(previewReports.length),
                                      }),
                                    },
                                  ] as const
                                ).map((pill) => (
                                  <button
                                    key={pill.id}
                                    type="button"
                                    onClick={() => {
                                      setScopeFilter(pill.id);
                                      setShowAllScopeItems(false);
                                    }}
                                    className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium tabular-nums transition-all ${
                                      scopeFilter === pill.id
                                        ? "bg-brand-600 text-white shadow-theme-xs"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    }`}
                                  >
                                    {pill.label}
                                  </button>
                                ))}
                              </div>

                              {/* Compact 1-Line Scope Items (Click to Expand Summary) */}
                              <div className="mt-3.5 divide-y divide-gray-100 rounded-xl border border-gray-200/80 bg-gray-50/40 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-800/30">
                                {visibleTasks.map((task) => (
                                  <div
                                    key={task.id ?? task.taskId ?? task.key}
                                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <TaskIcon className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                                      <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold text-gray-800 tabular-nums dark:text-gray-200">
                                        {task.key}
                                      </span>
                                      <span className="truncate font-medium text-gray-900 dark:text-white">
                                        {task.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Badge color="warning" size="sm">
                                        {task.status}
                                      </Badge>
                                      <Badge color="light" size="sm">
                                        {task.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}

                                {visibleSources.map((src) => {
                                  const rowKey = `${src.kind}:${src.id}`;
                                  const href = buildSourceWorkspaceHref(
                                    projectId,
                                    src.kind,
                                    src.id,
                                  );
                                  const hasDistinctSummary = Boolean(
                                    src.summary &&
                                      src.summary.trim() &&
                                      src.summary.trim() !== src.title.trim(),
                                  );
                                  const isSummaryOpen = Boolean(
                                    expandedSummaries[rowKey],
                                  );
                                  return (
                                    <div
                                      key={rowKey}
                                      className="px-4 py-3 text-sm"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                          <DocsIcon className="size-4 shrink-0 text-success-600 dark:text-success-400" />
                                          <span className="truncate font-medium text-gray-900 dark:text-white">
                                            {src.title}
                                          </span>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                                          <Badge color="info" size="sm">
                                            {src.kind === "PROJECT_DOCUMENT"
                                              ? "Document"
                                              : src.kind === "TASK_NOTE"
                                                ? "Task Note"
                                                : src.kind === "WORK_REPORT"
                                                  ? "Work Report"
                                                  : src.kind}{" "}
                                            · v{src.version}
                                          </Badge>
                                          {hasDistinctSummary && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedSummaries((prev) => ({
                                                  ...prev,
                                                  [rowKey]: !prev[rowKey],
                                                }))
                                              }
                                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                                            >
                                              <span>
                                                {isSummaryOpen
                                                  ? t5("toggleSummaryHide")
                                                  : t5("toggleSummaryShow")}
                                              </span>
                                              <ChevronDownIcon
                                                className={`size-3.5 transition-transform ${
                                                  isSummaryOpen
                                                    ? "rotate-180"
                                                    : ""
                                                }`}
                                              />
                                            </button>
                                          )}
                                          {href && (
                                            <Link
                                              href={href}
                                              className="text-xs font-semibold text-brand-600 hover:underline sm:text-sm dark:text-brand-400"
                                            >
                                              {t5("openInWorkspace")}
                                            </Link>
                                          )}
                                        </div>
                                      </div>
                                      {hasDistinctSummary && isSummaryOpen && (
                                        <p className="mt-2 rounded-lg bg-white/80 px-3.5 py-2.5 text-xs leading-5 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                                          {src.summary}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Show More / Show Less Toggle */}
                              {totalFilteredCount > 6 && (
                                <div className="mt-3.5 flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowAllScopeItems((prev) => !prev)
                                    }
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-theme-xs tabular-nums transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                  >
                                    <span>
                                      {showAllScopeItems
                                        ? t5("showLessScopeItems")
                                        : t5("showMoreScopeItems", {
                                            count: String(hiddenCount),
                                          })}
                                    </span>
                                    <ChevronDownIcon
                                      className={`size-4 text-gray-500 transition-transform ${
                                        showAllScopeItems ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>
                                </div>
                              )}
                            </section>
                          )}

                          {/* When Unified Scope is already displayed above, collapse the raw Published Revision Checklist behind an on-demand toggle button */}
                          {hasPreviewScope && publishedRevision ? (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                <span className="text-sm font-medium text-gray-700 tabular-nums dark:text-gray-300">
                                  {t("status.publishedRev", {
                                    number: String(publishedRevision.number),
                                  })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPublishedAuditChecklist(
                                      (prev) => !prev,
                                    )
                                  }
                                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400 dark:hover:bg-gray-700"
                                >
                                  <span>
                                    {showPublishedAuditChecklist
                                      ? t5("togglePublishedAuditHide")
                                      : t5("togglePublishedAuditShow", {
                                          number: String(
                                            publishedRevision.number,
                                          ),
                                        })}
                                  </span>
                                  <ChevronDownIcon
                                    className={`size-4 transition-transform ${
                                      showPublishedAuditChecklist
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </button>
                              </div>

                              {showPublishedAuditChecklist && (
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
                            </div>
                          ) : (
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
                        </div>

                        {/* On-Demand Right Column (5/12): Grounded AI Chat with Citations */}
                        {isInlineAiOpen && (
                          <div className="min-w-0 xl:col-span-5">
                            <div className="xl:sticky xl:top-6">
                              <HandoverQaPanel
                                projectId={projectId}
                                handover={handover}
                                sourceTitles={sourceTitleMap}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ))}

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
                <HandoverQaPanel
                  projectId={projectId}
                  handover={handover}
                  sourceTitles={sourceTitleMap}
                />
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
