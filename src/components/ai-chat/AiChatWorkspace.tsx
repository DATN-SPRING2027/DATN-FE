"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  BranchIcon,
  CheckLineIcon,
  CloseLineIcon,
  ChevronDownIcon,
  ComposeChatIcon,
  LockIcon,
  MindMapIcon,
  PlatformProjectsIcon,
  ShootingStarIcon,
  SidebarPanelIcon,
} from "@/icons";
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  streamAiChatAsk,
  streamAiChatRegenerate,
} from "@/lib/queries/ai-chat/ai-chat-stream";
import type {
  AiChatMessage,
  AiChatMessagePage,
  AiChatRetrievalStep,
  AiChatSessionCitation,
  AiChatThread,
} from "@/lib/queries/ai-chat/ai-chat.types";
import {
  aiChatKeys,
  useAiChatMessagesInfiniteQuery,
  useAiChatThreadsQuery,
  useBranchAiChatThreadMutation,
  useCreateAiChatThreadMutation,
  useDeleteAiChatThreadMutation,
  useUpdateAiChatThreadMutation,
} from "@/lib/queries/ai-chat/useAiChat";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import AiChatComposer, { AI_CHAT_MAX_QUERY_LENGTH } from "./AiChatComposer";
import AiChatProjectMenu from "./AiChatProjectMenu";
import AiChatMessageList, {
  type DisplayAiChatMessage,
  type InspectedEvidence,
} from "./AiChatMessageList";
import AiChatSidebar from "./AiChatSidebar";
import AiChatMindMapPanel from "./AiChatMindMapPanel";
import { aiMindMapKeys } from "@/lib/queries/ai-chat/useAiMindMap";
import { isPersistedMessageId } from "./answer-action-utils";
import AiChatEvidenceSheet from "./AiChatEvidenceSheet";
import AiChatSaveTaskNoteDialog from "./AiChatSaveTaskNoteDialog";
import { resolveSessionCitationPreview } from "./citation-utils";

function isProjectOrAuthAccessError(error: unknown): error is ApiError {
  if (!isAccessOrResourceUnavailableError(error)) return false;
  if (error.status === 404 && error.code === "AI_CHAT_RESOURCE_NOT_FOUND") {
    return false;
  }
  return true;
}

function revalidateCurrentUserSession(queryClient: QueryClient): void {
  void queryClient
    .invalidateQueries({
      queryKey: authKeys.currentUser(),
      exact: true,
    })
    .catch(() => undefined);
}

export function upsertRetrievalStep(
  steps: readonly AiChatRetrievalStep[],
  incoming: AiChatRetrievalStep,
): AiChatRetrievalStep[] {
  if (!incoming.id) {
    return [...steps, incoming];
  }
  const index = steps.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return [...steps, incoming];
  }
  const next = [...steps];
  const previous = next[index]!;
  next[index] = {
    ...previous,
    ...incoming,
    label: incoming.label || previous.label,
  };
  return next;
}

export function settleRunningSteps(
  steps: readonly AiChatRetrievalStep[],
  terminalStatus: "completed" | "failed",
): AiChatRetrievalStep[] {
  if (!steps.some((step) => step.status === "running")) {
    return [...steps];
  }
  return steps.map((step) =>
    step.status === "running" ? { ...step, status: terminalStatus } : step,
  );
}

function deriveThreadTitle(query: string): string {
  const collapsed = query.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 72) return collapsed;
  return `${collapsed.slice(0, 69).trimEnd()}…`;
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function readPinnedThreadsFromStorage(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writePinnedThreadsToStorage(
  storageKey: string,
  ids: readonly string[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors.
  }
}

function WorkspaceLoadingSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-gpt-canvas"
    >
      <div className="hidden w-60 shrink-0 border-e border-gray-200/80 bg-gray-50/95 p-3 md:block dark:border-white/10 dark:bg-gpt-sidebar">
        <div className="h-9 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-8 animate-pulse rounded-lg bg-gray-200/70 dark:bg-white/6"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-gray-100 dark:bg-gpt-sidebar" />
        <div className="h-13 w-full max-w-2xl animate-pulse rounded-3xl bg-gray-100 dark:bg-gpt-composer" />
      </div>
    </div>
  );
}

function AiChatWorkspaceContent() {
  const t = useTranslations("AiChat");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentUserQuery = useCurrentUserQuery();
  const userId = currentUserQuery.data?.id ?? "";
  const organizationId = currentUserQuery.data?.organizationId ?? "";

  const activeProjectsQuery = useActiveOrganizationProjects(
    organizationId,
    Boolean(organizationId),
  );
  const projects = activeProjectsQuery.projects;

  const urlProjectId = searchParams.get("projectId");
  const [manualProjectId, setManualProjectId] = useState<string | null>(null);

  const selectedProject: Project | null = useMemo(() => {
    if (projects.length === 0) return null;
    if (manualProjectId) {
      const manualMatch = projects.find((p) => p.id === manualProjectId);
      if (manualMatch) return manualMatch;
    }
    if (urlProjectId) {
      const urlMatch = projects.find((p) => p.id === urlProjectId);
      if (urlMatch) return urlMatch;
    }
    return projects[0] ?? null;
  }, [projects, manualProjectId, urlProjectId]);

  const projectId = selectedProject?.id ?? "";
  const pinnedStorageKey = `continuum.aiChat.pinned.${organizationId}.${projectId}`;

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isComposerProjectMenuOpen, setIsComposerProjectMenuOpen] =
    useState(false);
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [pinnedIdsByScope, setPinnedIdsByScope] = useState<
    Record<string, readonly string[]>
  >({});

  const [composerValue, setComposerValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [permissionBanner, setPermissionBanner] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const [localTurnsByThread, setLocalTurnsByThread] = useState<
    Record<string, readonly DisplayAiChatMessage[]>
  >({});
  const [activityTimingsByMessageId, setActivityTimingsByMessageId] = useState<
    Record<
      string,
      Pick<DisplayAiChatMessage, "activityStartedAt" | "activityFinishedAt">
    >
  >({});
  const [answerStatusByMessageId, setAnswerStatusByMessageId] = useState<
    Record<string, "answered" | "no_answer">
  >({});
  const [retrievalStepsByMessageId, setRetrievalStepsByMessageId] = useState<
    Record<string, readonly AiChatRetrievalStep[]>
  >({});
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(
    null,
  );
  const [inspectedEvidence, setInspectedEvidence] =
    useState<InspectedEvidence | null>(null);
  const [branchingMessageId, setBranchingMessageId] = useState<string | null>(
    null,
  );
  const [localBranchedThreadsByScope, setLocalBranchedThreadsByScope] =
    useState<Record<string, Record<string, AiChatThread>>>({});
  const [branchNotice, setBranchNotice] = useState<{
    branchId: string;
    parentThreadId: string | null;
    parentTitle: string | null;
  } | null>(null);
  const [taskNoteSaveTarget, setTaskNoteSaveTarget] = useState<{
    projectId: string;
    threadId: string;
    message: AiChatMessage;
    questionText: string;
  } | null>(null);
  const [taskNoteSavedNotice, setTaskNoteSavedNotice] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const branchNavEpochRef = useRef(0);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const engineMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  const pinnedThreadIds = useMemo(() => {
    if (!organizationId || !projectId) return new Set<string>();
    const override = pinnedIdsByScope[pinnedStorageKey];
    const ids = override ?? readPinnedThreadsFromStorage(pinnedStorageKey);
    return new Set(ids);
  }, [organizationId, pinnedIdsByScope, pinnedStorageKey, projectId]);

  const handleTogglePinThread = useCallback(
    (threadId: string) => {
      if (!organizationId || !projectId) return;
      setPinnedIdsByScope((prev) => {
        const current =
          prev[pinnedStorageKey] ??
          readPinnedThreadsFromStorage(pinnedStorageKey);
        const exists = current.includes(threadId);
        const next = exists
          ? current.filter((id) => id !== threadId)
          : [threadId, ...current];
        writePinnedThreadsToStorage(pinnedStorageKey, next);
        return { ...prev, [pinnedStorageKey]: next };
      });
    },
    [organizationId, pinnedStorageKey, projectId],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isProjectMenuOpen && !isEngineMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isProjectMenuOpen &&
        projectMenuRef.current &&
        !projectMenuRef.current.contains(target)
      ) {
        setIsProjectMenuOpen(false);
      }
      if (
        isEngineMenuOpen &&
        engineMenuRef.current &&
        !engineMenuRef.current.contains(target)
      ) {
        setIsEngineMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProjectMenuOpen(false);
        setIsEngineMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isEngineMenuOpen, isProjectMenuOpen]);

  useEffect(() => {
    if (!inspectedEvidence && !isMobileSidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (inspectedEvidence) {
          setInspectedEvidence(null);
        } else if (isMobileSidebarOpen) {
          setIsMobileSidebarOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [inspectedEvidence, isMobileSidebarOpen]);

  const threadsQuery = useAiChatThreadsQuery(organizationId, projectId, {
    enabled: Boolean(organizationId && projectId),
  });
  const createThreadMutation = useCreateAiChatThreadMutation(
    organizationId,
    projectId,
  );
  const updateThreadMutation = useUpdateAiChatThreadMutation(
    organizationId,
    projectId,
  );
  const deleteThreadMutation = useDeleteAiChatThreadMutation(
    organizationId,
    projectId,
  );
  const branchThreadMutation = useBranchAiChatThreadMutation(
    organizationId,
    projectId,
  );

  useEffect(() => {
    if (!branchNotice) return;
    const timer = window.setTimeout(() => {
      setBranchNotice((prev) =>
        prev?.branchId === branchNotice.branchId ? null : prev,
      );
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [branchNotice]);

  const currentScopeBranchedThreads = useMemo(
    () => localBranchedThreadsByScope[pinnedStorageKey] ?? {},
    [localBranchedThreadsByScope, pinnedStorageKey],
  );

  const effectiveThreads: readonly AiChatThread[] = useMemo(() => {
    const serverList = threadsQuery.data ?? [];
    const serverIds = new Set(serverList.map((item) => item.id));
    const localOnly = Object.values(currentScopeBranchedThreads).filter(
      (item) => !serverIds.has(item.id),
    );
    return localOnly.length > 0 ? [...localOnly, ...serverList] : serverList;
  }, [currentScopeBranchedThreads, threadsQuery.data]);

  const activeThread: AiChatThread | null = useMemo(() => {
    if (!activeThreadId) return null;
    return (
      effectiveThreads.find((item) => item.id === activeThreadId) ??
      currentScopeBranchedThreads[activeThreadId] ??
      null
    );
  }, [activeThreadId, currentScopeBranchedThreads, effectiveThreads]);

  const messagesQuery = useAiChatMessagesInfiniteQuery(
    organizationId,
    projectId,
    activeThreadId,
    {
      enabled: Boolean(organizationId && projectId && activeThreadId),
    },
  );

  const serverMessages: readonly DisplayAiChatMessage[] = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    if (pages.length === 0) return [];
    const seen = new Set<string>();
    const ordered: DisplayAiChatMessage[] = [];
    for (const page of [...pages].reverse()) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          const rememberedAnswerStatus = answerStatusByMessageId[item.id];
          const rememberedSteps = retrievalStepsByMessageId[item.id];
          ordered.push({
            ...item,
            ...(item.retrievalSteps.length === 0 &&
            rememberedSteps &&
            rememberedSteps.length > 0
              ? { retrievalSteps: rememberedSteps }
              : {}),
            ...(rememberedAnswerStatus
              ? { answerStatus: rememberedAnswerStatus }
              : {}),
            ...activityTimingsByMessageId[item.id],
          });
        }
      }
    }
    return ordered;
  }, [
    activityTimingsByMessageId,
    answerStatusByMessageId,
    messagesQuery.data,
    retrievalStepsByMessageId,
  ]);

  const displayedMessages: readonly DisplayAiChatMessage[] = useMemo(() => {
    if (!activeThreadId) return [];
    const localTurns = localTurnsByThread[activeThreadId] ?? [];
    if (localTurns.length === 0) return serverMessages;
    const localById = new Map(localTurns.map((msg) => [msg.id, msg]));
    const serverIds = new Set(serverMessages.map((msg) => msg.id));
    const enrichedServer = serverMessages.map((msg) => {
      const localMatch = localById.get(msg.id);
      if (!localMatch) return msg;
      return {
        ...msg,
        retrievalSteps:
          msg.retrievalSteps.length > 0
            ? msg.retrievalSteps
            : localMatch.retrievalSteps,
        answerStatus: msg.answerStatus ?? localMatch.answerStatus,
        errorCode: msg.errorCode ?? localMatch.errorCode,
        errorMessage: localMatch.errorMessage ?? msg.errorMessage,
        retryQuery: localMatch.retryQuery ?? msg.retryQuery,
      };
    });
    const unsyncedLocal = localTurns.filter((msg) => !serverIds.has(msg.id));
    return [...enrichedServer, ...unsyncedLocal];
  }, [activeThreadId, localTurnsByThread, serverMessages]);

  const displayedMessagesById = useMemo(
    () => new Map(displayedMessages.map((msg) => [msg.id, msg])),
    [displayedMessages],
  );

  const queryAccessError = useMemo(() => {
    if (isProjectOrAuthAccessError(threadsQuery.error)) {
      return threadsQuery.error;
    }
    if (isProjectOrAuthAccessError(messagesQuery.error)) {
      return messagesQuery.error;
    }
    return null;
  }, [threadsQuery.error, messagesQuery.error]);

  useEffect(() => {
    if (!queryAccessError) return;
    queryClient.removeQueries?.({ queryKey: aiMindMapKeys.all });
  }, [queryAccessError, queryClient]);

  const handleSelectProject = useCallback(
    (project: Project) => {
      branchNavEpochRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setManualProjectId(project.id);
      setActiveThreadId(null);
      setBranchNotice(null);
      setBranchingMessageId(null);
      setRetrievalStepsByMessageId({});
      setValidationError(null);
      setPermissionBanner(null);
      setInspectedEvidence(null);
      setIsProjectMenuOpen(false);
      setIsComposerProjectMenuOpen(false);
      setIsEngineMenuOpen(false);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("projectId", project.id);
      router.replace(`${pathname}?${nextParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const handleStartNewChat = useCallback(() => {
    branchNavEpochRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setActiveThreadId(null);
    setBranchNotice(null);
    setBranchingMessageId(null);
    setValidationError(null);
    setPermissionBanner(null);
    setHighlightedTurnId(null);
    setIsEngineMenuOpen(false);
    setIsProjectMenuOpen(false);
    setIsComposerProjectMenuOpen(false);
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    branchNavEpochRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setActiveThreadId(threadId);
    setBranchingMessageId(null);
    setValidationError(null);
    setPermissionBanner(null);
    setHighlightedTurnId(null);
  }, []);

  const handleRenameThread = useCallback(
    async (threadId: string, title: string) => {
      const updated = await updateThreadMutation.mutateAsync({
        threadId,
        title,
      });
      const resolvedTitle = updated?.title ?? title;
      setLocalBranchedThreadsByScope((prev) => {
        const scoped = prev[pinnedStorageKey];
        if (!scoped) return prev;
        const nextScoped: Record<string, AiChatThread> = {};
        for (const [id, item] of Object.entries(scoped)) {
          if (id === threadId) {
            nextScoped[id] = { ...item, title: resolvedTitle };
          } else if (item.parentThreadId === threadId) {
            nextScoped[id] = { ...item, parentThreadTitle: resolvedTitle };
          } else {
            nextScoped[id] = item;
          }
        }
        return { ...prev, [pinnedStorageKey]: nextScoped };
      });
      setBranchNotice((prev) =>
        prev?.parentThreadId === threadId
          ? { ...prev, parentTitle: resolvedTitle }
          : prev,
      );
    },
    [pinnedStorageKey, updateThreadMutation],
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      await deleteThreadMutation.mutateAsync({ threadId });
      setLocalTurnsByThread((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      setLocalBranchedThreadsByScope((prev) => {
        const scoped = prev[pinnedStorageKey];
        if (!scoped) return prev;
        const nextScoped: Record<string, AiChatThread> = {};
        for (const [id, item] of Object.entries(scoped)) {
          if (id === threadId) continue;
          nextScoped[id] =
            item.parentThreadId === threadId
              ? { ...item, parentThreadId: null, parentThreadTitle: null }
              : item;
        }
        return { ...prev, [pinnedStorageKey]: nextScoped };
      });
      setBranchNotice((prev) =>
        prev?.branchId === threadId
          ? null
          : prev?.parentThreadId === threadId
            ? { ...prev, parentThreadId: null, parentTitle: null }
            : prev,
      );
      if (organizationId && projectId) {
        setPinnedIdsByScope((prev) => {
          const current =
            prev[pinnedStorageKey] ??
            readPinnedThreadsFromStorage(pinnedStorageKey);
          if (!current.includes(threadId)) return prev;
          const next = current.filter((id) => id !== threadId);
          writePinnedThreadsToStorage(pinnedStorageKey, next);
          return { ...prev, [pinnedStorageKey]: next };
        });
      }
      if (activeThreadId === threadId) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
        setActiveThreadId(null);
      }
    },
    [
      activeThreadId,
      deleteThreadMutation,
      organizationId,
      pinnedStorageKey,
      projectId,
    ],
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const updateLocalTurn = useCallback(
    (
      threadId: string,
      turnId: string,
      updater: (turn: DisplayAiChatMessage) => DisplayAiChatMessage,
    ) => {
      setLocalTurnsByThread((prev) => {
        const list = prev[threadId] ?? [];
        return {
          ...prev,
          [threadId]: list.map((item) =>
            item.id === turnId ? updater(item) : item,
          ),
        };
      });
    },
    [],
  );

  const reconcileAfterInterruptedStream = useCallback(
    async (
      projectId: string,
      threadId: string,
      userMessageId: string,
      assistantMessageId: string,
    ) => {
      const messagesKey = aiChatKeys.messages(
        organizationId,
        projectId,
        threadId,
      );
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: aiChatKeys.threads(organizationId, projectId),
        }),
        queryClient.invalidateQueries({ queryKey: messagesKey }),
      ]);

      if (typeof queryClient.getQueryData !== "function") return;
      const refreshed = queryClient.getQueryData<{
        pages?: readonly AiChatMessagePage[];
      }>(messagesKey);
      const messages = (refreshed?.pages ?? []).flatMap((page) => page.items);
      const persistedIds = new Set(messages.map((message) => message.id));
      const persistedAssistantReply = messages.some(
        (message) =>
          message.role === "assistant" &&
          message.replyToMessageId === userMessageId,
      );

      setLocalTurnsByThread((prev) => {
        const existing = prev[threadId];
        if (!existing?.length) return prev;
        const filtered = existing.filter((turn) => {
          if (
            turn.role === "user" &&
            turn.id === userMessageId &&
            persistedIds.has(userMessageId)
          ) {
            return false;
          }
          if (
            turn.role === "assistant" &&
            turn.id === assistantMessageId &&
            persistedAssistantReply
          ) {
            return false;
          }
          return true;
        });
        return filtered.length === existing.length
          ? prev
          : { ...prev, [threadId]: filtered };
      });
    },
    [organizationId, queryClient],
  );

  const sendQuestion = useCallback(
    async (rawQuery: string) => {
      if (!selectedProject || isStreaming || createThreadMutation.isPending) {
        return;
      }
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        setValidationError(t("queryEmptyError"));
        return;
      }
      if (rawQuery.length > AI_CHAT_MAX_QUERY_LENGTH) {
        setValidationError(
          t("queryTooLongError", { max: AI_CHAT_MAX_QUERY_LENGTH }),
        );
        return;
      }

      const requestProjectId = selectedProject.id;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setValidationError(null);
      setPermissionBanner(null);
      setComposerValue("");

      try {
        let targetThreadId = activeThreadId;
        if (!targetThreadId) {
          try {
            const created = await createThreadMutation.mutateAsync({
              title: deriveThreadTitle(trimmed),
            });
            if (
              controller.signal.aborted ||
              abortControllerRef.current !== controller
            ) {
              return;
            }
            targetThreadId = created.id;
            setActiveThreadId(created.id);
          } catch (error) {
            if (
              controller.signal.aborted ||
              abortControllerRef.current !== controller ||
              isAbortError(error)
            ) {
              return;
            }
            setComposerValue(rawQuery);
            if (isProjectOrAuthAccessError(error)) {
              if (error.status === 401) {
                revalidateCurrentUserSession(queryClient);
              }
              setPermissionBanner(
                error.status === 401
                  ? t("sessionExpiredBody")
                  : t("permissionDeniedBody"),
              );
            } else {
              setValidationError(
                error instanceof Error
                  ? error.message
                  : t("streamFailedDefault"),
              );
            }
            return;
          }
        }

        const nowIso = new Date().toISOString();
        const tempUserTurnId = `local-user-${Date.now()}`;
        const tempAssistantTurnId = `local-assistant-${Date.now()}`;

        const optimisticUserTurn: DisplayAiChatMessage = {
          id: tempUserTurnId,
          role: "user",
          content: trimmed,
          status: "ok",
          citations: [],
          sessionCitations: [],
          retrievalSteps: [],
          createdAt: nowIso,
        };
        const optimisticAssistantTurn: DisplayAiChatMessage = {
          id: tempAssistantTurnId,
          role: "assistant",
          content: "",
          status: "ok",
          citations: [],
          sessionCitations: [],
          retrievalSteps: [],
          createdAt: nowIso,
          replyToMessageId: tempUserTurnId,
          isStreaming: true,
          activityStartedAt: Date.parse(nowIso),
          retryQuery: trimmed,
        };

        const currentServerIds = new Set(serverMessages.map((msg) => msg.id));
        setLocalTurnsByThread((prev) => {
          const retained = (prev[targetThreadId] ?? []).filter(
            (turn) =>
              turn.isStreaming ||
              turn.status !== "ok" ||
              !currentServerIds.has(turn.id),
          );
          return {
            ...prev,
            [targetThreadId]: [
              ...retained,
              optimisticUserTurn,
              optimisticAssistantTurn,
            ],
          };
        });

        let activeUserTurnId = tempUserTurnId;
        let activeAssistantTurnId = tempAssistantTurnId;
        let collectedSteps: AiChatRetrievalStep[] = [];

        try {
          await streamAiChatAsk({
            projectId: requestProjectId,
            threadId: targetThreadId,
            query: trimmed,
            signal: controller.signal,
            onEvent: (event) => {
              if (event.event === "started") {
                const realUserMessageId = event.data.userMessageId;
                if (realUserMessageId) {
                  updateLocalTurn(targetThreadId, activeUserTurnId, (turn) => ({
                    ...turn,
                    id: realUserMessageId,
                  }));
                  activeUserTurnId = realUserMessageId;
                  updateLocalTurn(
                    targetThreadId,
                    activeAssistantTurnId,
                    (turn) => ({
                      ...turn,
                      replyToMessageId: realUserMessageId,
                    }),
                  );
                }
                return;
              }

              if (event.event === "step") {
                collectedSteps = upsertRetrievalStep(
                  collectedSteps,
                  event.data,
                );
                const snapshot = collectedSteps;
                updateLocalTurn(
                  targetThreadId,
                  activeAssistantTurnId,
                  (turn) => ({
                    ...turn,
                    retrievalSteps: snapshot,
                  }),
                );
                return;
              }

              if (event.event === "delta") {
                updateLocalTurn(
                  targetThreadId,
                  activeAssistantTurnId,
                  (turn) => ({
                    ...turn,
                    content: `${turn.content}${event.data.text}`,
                  }),
                );
                return;
              }

              if (event.event === "completed") {
                const finalId = event.data.messageId || activeAssistantTurnId;
                const finishedAt = Date.now();
                const resolvedSteps =
                  event.data.retrievalSteps.length > 0
                    ? event.data.retrievalSteps
                    : settleRunningSteps(collectedSteps, "completed");
                setActivityTimingsByMessageId((prev) => ({
                  ...prev,
                  [finalId]: {
                    activityStartedAt: Date.parse(nowIso),
                    activityFinishedAt: finishedAt,
                  },
                }));
                setAnswerStatusByMessageId((prev) => ({
                  ...prev,
                  [finalId]: event.data.answerStatus,
                }));
                if (resolvedSteps.length > 0) {
                  setRetrievalStepsByMessageId((prev) => ({
                    ...prev,
                    [finalId]: resolvedSteps,
                  }));
                }
                updateLocalTurn(
                  targetThreadId,
                  activeAssistantTurnId,
                  (turn) => ({
                    ...turn,
                    id: finalId,
                    content: event.data.content || turn.content,
                    status: "ok",
                    isStreaming: false,
                    activityFinishedAt: finishedAt,
                    answerStatus: event.data.answerStatus,
                    ...(event.data.replyToMessageId
                      ? { replyToMessageId: event.data.replyToMessageId }
                      : {}),
                    citations: event.data.citations,
                    sessionCitations: event.data.sessionCitations,
                    retrievalSteps:
                      resolvedSteps.length > 0
                        ? resolvedSteps
                        : settleRunningSteps(turn.retrievalSteps, "completed"),
                  }),
                );
                activeAssistantTurnId = finalId;
                return;
              }

              if (event.event === "failed") {
                const failedId = event.data.messageId || activeAssistantTurnId;
                updateLocalTurn(
                  targetThreadId,
                  activeAssistantTurnId,
                  (turn) => ({
                    ...turn,
                    id: failedId,
                    status: "failed",
                    isStreaming: false,
                    activityFinishedAt: Date.now(),
                    retrievalSteps: settleRunningSteps(
                      turn.retrievalSteps,
                      "failed",
                    ),
                    errorCode: event.data.code,
                    errorMessage:
                      event.data.message || t("streamFailedDefault"),
                  }),
                );
                activeAssistantTurnId = failedId;
              }
            },
          });

          const messagesKey = aiChatKeys.messages(
            organizationId,
            requestProjectId,
            targetThreadId,
          );
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: aiChatKeys.threads(organizationId, requestProjectId),
            }),
            queryClient.invalidateQueries({
              queryKey: messagesKey,
            }),
          ]);

          if (typeof queryClient.getQueryData === "function") {
            const refreshed = queryClient.getQueryData<{
              pages?: readonly AiChatMessagePage[];
            }>(messagesKey);
            const refreshedIds = new Set<string>();
            for (const page of refreshed?.pages ?? []) {
              for (const item of page.items) {
                refreshedIds.add(item.id);
              }
            }
            if (refreshedIds.size > 0) {
              setLocalTurnsByThread((prev) => {
                const existing = prev[targetThreadId];
                if (!existing || existing.length === 0) return prev;
                const filtered = existing.filter(
                  (turn) =>
                    turn.isStreaming ||
                    turn.status !== "ok" ||
                    !refreshedIds.has(turn.id),
                );
                if (filtered.length === existing.length) return prev;
                return { ...prev, [targetThreadId]: filtered };
              });
            }
          }
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) {
            updateLocalTurn(targetThreadId, activeAssistantTurnId, (turn) => ({
              ...turn,
              status: "cancelled",
              isStreaming: false,
              activityFinishedAt: Date.now(),
            }));
          } else if (isProjectOrAuthAccessError(error)) {
            if (error.status === 401) {
              revalidateCurrentUserSession(queryClient);
            }
            setPermissionBanner(
              error.status === 401
                ? t("sessionExpiredBody")
                : t("permissionDeniedBody"),
            );
            updateLocalTurn(targetThreadId, activeAssistantTurnId, (turn) => ({
              ...turn,
              status: "failed",
              isStreaming: false,
              activityFinishedAt: Date.now(),
              retrievalSteps: settleRunningSteps(turn.retrievalSteps, "failed"),
              errorCode: error.code,
              errorMessage:
                error instanceof ApiError
                  ? error.message
                  : t("permissionDeniedBody"),
            }));
          } else {
            if (error instanceof ApiError && error.status >= 500) {
              void reconcileAfterInterruptedStream(
                requestProjectId,
                targetThreadId,
                activeUserTurnId,
                activeAssistantTurnId,
              );
            }
            updateLocalTurn(targetThreadId, activeAssistantTurnId, (turn) => ({
              ...turn,
              status: "failed",
              isStreaming: false,
              activityFinishedAt: Date.now(),
              retrievalSteps: settleRunningSteps(turn.retrievalSteps, "failed"),
              errorCode: error instanceof ApiError ? error.code : undefined,
              errorMessage:
                error instanceof Error
                  ? error.message
                  : t("streamFailedDefault"),
            }));
          }
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [
      activeThreadId,
      createThreadMutation,
      isStreaming,
      organizationId,
      queryClient,
      reconcileAfterInterruptedStream,
      selectedProject,
      serverMessages,
      t,
      updateLocalTurn,
    ],
  );

  const regenerateAnswer = useCallback(
    async (
      targetMessage: DisplayAiChatMessage,
      questionMessage?: DisplayAiChatMessage,
    ) => {
      if (
        !selectedProject ||
        !activeThreadId ||
        isStreaming ||
        !isPersistedMessageId(targetMessage.id)
      ) {
        return;
      }

      const requestProjectId = selectedProject.id;
      const targetThreadId = activeThreadId;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setValidationError(null);
      setPermissionBanner(null);

      const nowIso = new Date().toISOString();
      const tempRegenId = `local-assistant-regen-${Date.now()}`;
      const optimisticRegenTurn: DisplayAiChatMessage = {
        id: tempRegenId,
        role: "assistant",
        content: "",
        status: "ok",
        citations: [],
        sessionCitations: [],
        retrievalSteps: [],
        createdAt: nowIso,
        ...((targetMessage.replyToMessageId ?? questionMessage?.id)
          ? {
              replyToMessageId:
                targetMessage.replyToMessageId ?? questionMessage?.id,
            }
          : {}),
        regeneratedFromMessageId: targetMessage.id,
        isStreaming: true,
        activityStartedAt: Date.parse(nowIso),
      };

      const currentServerIds = new Set(serverMessages.map((msg) => msg.id));
      setLocalTurnsByThread((prev) => {
        const retained = (prev[targetThreadId] ?? []).filter(
          (turn) =>
            turn.isStreaming ||
            turn.status !== "ok" ||
            !currentServerIds.has(turn.id),
        );
        return {
          ...prev,
          [targetThreadId]: [...retained, optimisticRegenTurn],
        };
      });

      let activeRegenTurnId = tempRegenId;
      let collectedSteps: AiChatRetrievalStep[] = [];

      try {
        await streamAiChatRegenerate({
          projectId: requestProjectId,
          threadId: targetThreadId,
          messageId: targetMessage.id,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === "started") {
              if (event.data.userMessageId) {
                updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                  ...turn,
                  replyToMessageId: event.data.userMessageId,
                }));
              }
              return;
            }

            if (event.event === "step") {
              collectedSteps = upsertRetrievalStep(collectedSteps, event.data);
              const snapshot = collectedSteps;
              updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                ...turn,
                retrievalSteps: snapshot,
              }));
              return;
            }

            if (event.event === "delta") {
              updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                ...turn,
                content: `${turn.content}${event.data.text}`,
              }));
              return;
            }

            if (event.event === "completed") {
              const finalId = event.data.messageId || activeRegenTurnId;
              const finishedAt = Date.now();
              const resolvedSteps =
                event.data.retrievalSteps.length > 0
                  ? event.data.retrievalSteps
                  : settleRunningSteps(collectedSteps, "completed");
              setActivityTimingsByMessageId((prev) => ({
                ...prev,
                [finalId]: {
                  activityStartedAt: Date.parse(nowIso),
                  activityFinishedAt: finishedAt,
                },
              }));
              setAnswerStatusByMessageId((prev) => ({
                ...prev,
                [finalId]: event.data.answerStatus,
              }));
              if (resolvedSteps.length > 0) {
                setRetrievalStepsByMessageId((prev) => ({
                  ...prev,
                  [finalId]: resolvedSteps,
                }));
              }
              updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                ...turn,
                id: finalId,
                content: event.data.content || turn.content,
                status: "ok",
                isStreaming: false,
                activityFinishedAt: finishedAt,
                answerStatus: event.data.answerStatus,
                citations: event.data.citations,
                sessionCitations: event.data.sessionCitations,
                retrievalSteps:
                  resolvedSteps.length > 0
                    ? resolvedSteps
                    : settleRunningSteps(turn.retrievalSteps, "completed"),
                ...(event.data.replyToMessageId
                  ? { replyToMessageId: event.data.replyToMessageId }
                  : {}),
                ...(event.data.regeneratedFromMessageId
                  ? {
                      regeneratedFromMessageId:
                        event.data.regeneratedFromMessageId,
                    }
                  : {}),
              }));
              activeRegenTurnId = finalId;
              return;
            }

            if (event.event === "failed") {
              const failedId = event.data.messageId || activeRegenTurnId;
              updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                ...turn,
                id: failedId,
                status: "failed",
                isStreaming: false,
                activityFinishedAt: Date.now(),
                retrievalSteps: settleRunningSteps(
                  turn.retrievalSteps,
                  "failed",
                ),
                errorMessage: event.data.message || t("streamFailedDefault"),
                ...(event.data.replyToMessageId
                  ? { replyToMessageId: event.data.replyToMessageId }
                  : {}),
                ...(event.data.regeneratedFromMessageId
                  ? {
                      regeneratedFromMessageId:
                        event.data.regeneratedFromMessageId,
                    }
                  : {}),
              }));
              activeRegenTurnId = failedId;
            }
          },
        });

        const messagesKey = aiChatKeys.messages(
          organizationId,
          requestProjectId,
          targetThreadId,
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: aiChatKeys.threads(organizationId, requestProjectId),
          }),
          queryClient.invalidateQueries({
            queryKey: messagesKey,
          }),
        ]);

        if (typeof queryClient.getQueryData === "function") {
          const refreshed = queryClient.getQueryData<{
            pages?: readonly AiChatMessagePage[];
          }>(messagesKey);
          const refreshedIds = new Set<string>();
          for (const page of refreshed?.pages ?? []) {
            for (const item of page.items) {
              refreshedIds.add(item.id);
            }
          }
          if (refreshedIds.size > 0) {
            setLocalTurnsByThread((prev) => {
              const existing = prev[targetThreadId];
              if (!existing || existing.length === 0) return prev;
              const filtered = existing.filter(
                (turn) =>
                  turn.isStreaming ||
                  turn.status !== "ok" ||
                  !refreshedIds.has(turn.id),
              );
              if (filtered.length === existing.length) return prev;
              return { ...prev, [targetThreadId]: filtered };
            });
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setLocalTurnsByThread((prev) => ({
            ...prev,
            [targetThreadId]: (prev[targetThreadId] ?? []).filter(
              (turn) => turn.id !== activeRegenTurnId,
            ),
          }));
          setValidationError(t("regenerateConflictError"));
        } else if (isAbortError(error) || controller.signal.aborted) {
          updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
            ...turn,
            status: "cancelled",
            isStreaming: false,
            activityFinishedAt: Date.now(),
          }));
        } else if (isProjectOrAuthAccessError(error)) {
          if (error.status === 401) {
            revalidateCurrentUserSession(queryClient);
          }
          setPermissionBanner(
            error.status === 401
              ? t("sessionExpiredBody")
              : t("permissionDeniedBody"),
          );
          updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
            ...turn,
            status: "failed",
            isStreaming: false,
            activityFinishedAt: Date.now(),
            retrievalSteps: settleRunningSteps(turn.retrievalSteps, "failed"),
            errorCode: error.code,
            errorMessage:
              error instanceof ApiError
                ? error.message
                : t("permissionDeniedBody"),
          }));
        } else {
          const replyToMessageId =
            targetMessage.replyToMessageId ?? questionMessage?.id;
          if (
            error instanceof ApiError &&
            error.status >= 500 &&
            replyToMessageId
          ) {
            void reconcileAfterInterruptedStream(
              requestProjectId,
              targetThreadId,
              replyToMessageId,
              activeRegenTurnId,
            );
          }
          updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
            ...turn,
            status: "failed",
            isStreaming: false,
            activityFinishedAt: Date.now(),
            retrievalSteps: settleRunningSteps(turn.retrievalSteps, "failed"),
            errorCode: error instanceof ApiError ? error.code : undefined,
            errorMessage:
              error instanceof Error ? error.message : t("streamFailedDefault"),
          }));
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [
      activeThreadId,
      isStreaming,
      organizationId,
      queryClient,
      reconcileAfterInterruptedStream,
      selectedProject,
      serverMessages,
      t,
      updateLocalTurn,
    ],
  );

  const handleBranchFromMessage = useCallback(
    async (targetMessage: DisplayAiChatMessage) => {
      if (
        !selectedProject ||
        !activeThreadId ||
        isStreaming ||
        branchThreadMutation.isPending ||
        !isPersistedMessageId(targetMessage.id)
      ) {
        return;
      }

      const requestEpoch = branchNavEpochRef.current;
      const requestScopeKey = pinnedStorageKey;
      setBranchingMessageId(targetMessage.id);
      setValidationError(null);
      setPermissionBanner(null);

      try {
        const createdBranch = await branchThreadMutation.mutateAsync({
          threadId: activeThreadId,
          messageId: targetMessage.id,
        });
        setLocalBranchedThreadsByScope((prev) => ({
          ...prev,
          [requestScopeKey]: {
            ...(prev[requestScopeKey] ?? {}),
            [createdBranch.id]: createdBranch,
          },
        }));
        if (branchNavEpochRef.current !== requestEpoch) {
          return;
        }
        setActiveThreadId(createdBranch.id);
        setHighlightedTurnId(null);
        setIsMobileSidebarOpen(false);
        setBranchNotice({
          branchId: createdBranch.id,
          parentThreadId: createdBranch.parentThreadId ?? null,
          parentTitle: createdBranch.parentThreadTitle ?? null,
        });
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            composerTextareaRef.current?.focus();
          });
        }
      } catch (error) {
        if (branchNavEpochRef.current !== requestEpoch) {
          return;
        }
        if (isProjectOrAuthAccessError(error)) {
          if (error.status === 401) {
            revalidateCurrentUserSession(queryClient);
          }
          setPermissionBanner(
            error.status === 401
              ? t("sessionExpiredBody")
              : t("permissionDeniedBody"),
          );
        } else {
          setValidationError(
            error instanceof ApiError ? error.message : t("branchErrorDefault"),
          );
        }
      } finally {
        setBranchingMessageId((prev) =>
          prev === targetMessage.id ? null : prev,
        );
      }
    },
    [
      activeThreadId,
      branchThreadMutation,
      isStreaming,
      pinnedStorageKey,
      queryClient,
      selectedProject,
      t,
    ],
  );

  const handleJumpToTurn = useCallback(
    (turnId: string, fallback: AiChatSessionCitation) => {
      const targetEl =
        typeof document !== "undefined"
          ? document.getElementById(`ai-chat-turn-${turnId}`)
          : null;
      if (targetEl) {
        const container = targetEl.closest<HTMLElement>(
          "[data-ai-chat-scroll-region]",
        );
        if (container) {
          container.scrollTo({
            top:
              container.scrollTop +
              targetEl.getBoundingClientRect().top -
              container.getBoundingClientRect().top -
              (container.clientHeight - targetEl.clientHeight) / 2,
            behavior: "smooth",
          });
        }
        setHighlightedTurnId(turnId);
        window.setTimeout(() => {
          setHighlightedTurnId((prev) => (prev === turnId ? null : prev));
        }, 2600);
      } else {
        setInspectedEvidence({ kind: "session", sessionCitation: fallback });
      }
    },
    [],
  );

  // 1. Initial workspace loading
  if (
    currentUserQuery.isLoading ||
    (Boolean(organizationId) && activeProjectsQuery.isLoading)
  ) {
    return <WorkspaceLoadingSkeleton label={t("loadingWorkspace")} />;
  }

  // 2. Projects query failed
  if (activeProjectsQuery.isError && projects.length === 0) {
    return (
      <div
        data-testid="ai-chat-workspace"
        className="flex h-full min-h-0 flex-1 items-center justify-center bg-white p-6 dark:bg-gpt-canvas"
      >
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-error-200 bg-error-50 p-6 text-center dark:border-error-800/60 dark:bg-error-500/10"
        >
          <div className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-full bg-error-100 text-error-600 dark:bg-error-500/20 dark:text-error-300">
            <AlertIcon aria-hidden="true" className="size-5" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("projectsLoadErrorTitle")}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            {t("projectsLoadErrorBody")}
          </p>
          <button
            type="button"
            onClick={() => void activeProjectsQuery.refetch?.()}
            className="mt-4 inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            {t("retryAction")}
          </button>
        </div>
      </div>
    );
  }

  // 3. Zero active projects guided empty state
  if (!selectedProject) {
    return (
      <div
        data-testid="ai-chat-workspace"
        className="flex h-full min-h-0 flex-1 items-center justify-center bg-white p-6 dark:bg-gpt-canvas"
      >
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-gray-50/80 p-8 text-center dark:border-white/10 dark:bg-gpt-sidebar">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
            <PlatformProjectsIcon aria-hidden="true" className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("emptyProjectsTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t("emptyProjectsDescription")}
          </p>
          <Link
            href="/projects"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
          >
            <span>{t("openProjectsCta")}</span>
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const accessBannerMessage =
    permissionBanner ??
    (queryAccessError
      ? queryAccessError.status === 401
        ? t("sessionExpiredBody")
        : t("permissionDeniedBody")
      : null);

  const isHeroStage = activeThreadId === null && displayedMessages.length === 0;

  const quickPromptChips = [
    { label: t("chatChip1Label"), prompt: t("chatChip1Prompt") },
    { label: t("chatChip2Label"), prompt: t("chatChip2Prompt") },
    { label: t("chatChip3Label"), prompt: t("chatChip3Prompt") },
  ];

  return (
    <div
      data-testid="ai-chat-workspace"
      className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-white text-gray-900 dark:bg-gpt-canvas dark:text-gray-100"
    >
      <AiChatSidebar
        projectId={selectedProject.id}
        projectCode={selectedProject.code}
        projectName={selectedProject.name}
        threads={effectiveThreads}
        pinnedThreadIds={pinnedThreadIds}
        activeThreadId={activeThreadId}
        isLoading={threadsQuery.isLoading}
        isError={threadsQuery.isError && !queryAccessError}
        isDesktopOpen={isDesktopSidebarOpen}
        isMobileOpen={isMobileSidebarOpen}
        isCreatingThread={createThreadMutation.isPending}
        onStartNewChat={handleStartNewChat}
        onSelectThread={handleSelectThread}
        onTogglePinThread={handleTogglePinThread}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onRetryThreads={() => void threadsQuery.refetch()}
        onCollapseDesktop={() => setIsDesktopSidebarOpen(false)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Right Main ChatGPT Canvas */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Floating Minimal ChatGPT Top Header Bar */}
        <header
          className={cn(
            "relative flex h-13 shrink-0 items-center justify-between gap-2 px-3 sm:px-4",
            isEngineMenuOpen || isProjectMenuOpen ? "z-30" : "z-20",
          )}
        >
          {/* Top-Left: Sidebar Toggle + Engine Popover ("Continuum SAG v") */}
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label={t("openSidebar")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:hidden dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <SidebarPanelIcon aria-hidden="true" className="size-4" />
            </button>

            {!isDesktopSidebarOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setIsDesktopSidebarOpen(true)}
                  aria-label={t("openSidebar")}
                  className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:inline-flex dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <SidebarPanelIcon aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  aria-label={t("newChat")}
                  className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:inline-flex dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ComposeChatIcon aria-hidden="true" className="size-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleStartNewChat}
              aria-label={t("newChat")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:hidden dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ComposeChatIcon aria-hidden="true" className="size-4" />
            </button>

            <div ref={engineMenuRef} className="relative min-w-0">
              <button
                type="button"
                aria-label={t("engineSelectorAriaLabel")}
                aria-expanded={isEngineMenuOpen}
                onClick={() => {
                  setIsProjectMenuOpen(false);
                  setIsComposerProjectMenuOpen(false);
                  setIsEngineMenuOpen((prev) => !prev);
                }}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 sm:px-2.5 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <span className="truncate">{t("engineTitle")}</span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 opacity-70 transition-transform duration-200",
                    isEngineMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {isEngineMenuOpen && (
                <div
                  role="dialog"
                  aria-label={t("engineSelectorAriaLabel")}
                  className="continuum-popover-enter absolute start-0 top-11 z-40 w-72 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover"
                >
                  <div className="px-2 py-1 text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                    {t("engineMenuHeading")}
                  </div>

                  <div className="mt-1 space-y-1">
                    <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/70 p-2.5 dark:bg-brand-500/15">
                      <ShootingStarIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-900 dark:text-white">
                          <span>{t("engineHybridTitle")}</span>
                          <CheckLineIcon
                            aria-hidden="true"
                            className="size-3.5 text-brand-600 dark:text-brand-300"
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {t("engineHybridDesc")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-xl p-2.5">
                      <LockIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-success-500 dark:text-success-400"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-900 dark:text-white">
                          {t("engineIsolationTitle")}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {t("engineIsolationDesc", {
                            project: selectedProject.name,
                            code: selectedProject.code,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-1.5 border-t border-gray-100 pt-1.5 dark:border-white/10">
                    <Link
                      href={`/projects/${encodeURIComponent(
                        selectedProject.id,
                      )}/documents`}
                      onClick={() => setIsEngineMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-brand-600 transition-colors hover:bg-gray-100 dark:text-brand-300 dark:hover:bg-white/10"
                    >
                      <span>{t("manageDocumentsCta")}</span>
                      <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top-Right: Studio Mind Map Toggle + Strict Single-Project Scope Pill */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="ai-chat-mind-map-trigger"
              aria-label={t("mindMapButtonAria")}
              aria-pressed={isMindMapOpen}
              disabled={Boolean(queryAccessError)}
              onClick={() => {
                setIsEngineMenuOpen(false);
                setIsProjectMenuOpen(false);
                setIsComposerProjectMenuOpen(false);
                setIsMindMapOpen((prev) => {
                  const next = !prev;
                  if (
                    next &&
                    typeof window !== "undefined" &&
                    window.innerWidth < 1536
                  ) {
                    setIsDesktopSidebarOpen(false);
                  }
                  return next;
                });
              }}
              className={cn(
                "group/mm inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-theme-xs active:translate-y-0 active:scale-96 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3",
                isMindMapOpen
                  ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200 dark:hover:bg-brand-500/30"
                  : "border-gray-200/80 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10",
              )}
            >
              <MindMapIcon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-200 group-hover/mm:scale-110",
                  isMindMapOpen
                    ? "text-brand-600 dark:text-brand-300"
                    : "text-brand-500 dark:text-brand-400",
                )}
              />
              <span className="hidden xsm:inline">{t("mindMapButton")}</span>
            </button>
            <div
              ref={projectMenuRef}
              className="relative flex shrink-0 items-center"
            >
              <button
                type="button"
                aria-label={t("projectScopeAriaLabel")}
                aria-haspopup="listbox"
                aria-expanded={isProjectMenuOpen}
                onClick={() => {
                  setIsEngineMenuOpen(false);
                  setIsComposerProjectMenuOpen(false);
                  setIsProjectMenuOpen((prev) => !prev);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:px-3 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-success-500" />
                <span className="max-w-24 truncate sm:max-w-36 2xl:max-w-48">
                  {selectedProject.name}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 opacity-70 transition-transform duration-200",
                    isProjectMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {isProjectMenuOpen && (
                <AiChatProjectMenu
                  projects={projects}
                  selectedProjectId={selectedProject.id}
                  placement="bottom"
                  testId="ai-chat-header-project-menu"
                  onSelectProject={handleSelectProject}
                />
              )}
            </div>
          </div>
        </header>

        {/* Branched in New Chat Confirmation Notice */}
        {branchNotice && (
          <div className="shrink-0 px-3 pt-2.5 sm:px-6">
            <div
              role="status"
              aria-live="polite"
              data-testid="ai-chat-branch-toast"
              className="mx-auto flex max-w-3xl items-center gap-2.5 rounded-2xl border border-gray-200/90 bg-gray-50/90 px-3.5 py-2 shadow-theme-xs dark:border-white/12 dark:bg-gpt-popover"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
                <BranchIcon aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                  {t("branchCreatedToast")}
                </p>
                {branchNotice.parentTitle && (
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {t("branchCreatedToastFrom", {
                      title: branchNotice.parentTitle,
                    })}
                  </p>
                )}
              </div>
              {branchNotice.parentThreadId && (
                <button
                  type="button"
                  onClick={() => {
                    const parentId = branchNotice.parentThreadId;
                    setBranchNotice(null);
                    if (parentId) {
                      handleSelectThread(parentId);
                    }
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
                >
                  {t("branchBackToOriginalAction")}
                </button>
              )}
              <button
                type="button"
                aria-label={t("branchToastDismissAria")}
                onClick={() => setBranchNotice(null)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <CloseLineIcon aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {taskNoteSavedNotice && (
          <div className="shrink-0 px-3 pt-2.5 sm:px-6">
            <div
              role="status"
              aria-live="polite"
              className="mx-auto flex max-w-3xl items-center gap-2.5 rounded-2xl border border-success-200 bg-success-50 px-3.5 py-2 text-success-800 shadow-theme-xs dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-200"
            >
              <span className="min-w-0 flex-1 text-xs font-semibold">
                {t("taskNoteSavedToast")}
              </span>
              <button
                type="button"
                aria-label={t("taskNoteDismissNotice")}
                onClick={() => setTaskNoteSavedNotice(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-success-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success-600"
              >
                <CloseLineIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Permission Denied / Session Revoked Banner */}
        {accessBannerMessage && (
          <div
            role="alert"
            className="shrink-0 border-y border-warning-200 bg-warning-50 px-4 py-2.5 text-xs text-warning-800 sm:px-6 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-200"
          >
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LockIcon aria-hidden="true" className="size-4 shrink-0" />
                <div>
                  <span className="font-semibold">
                    {t("permissionDeniedTitle")}:{" "}
                  </span>
                  <span>{accessBannerMessage}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPermissionBanner(null);
                  void threadsQuery.refetch();
                  if (activeThreadId) {
                    void messagesQuery.refetch();
                  }
                }}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-warning-800 ring-1 ring-warning-300 hover:bg-warning-100 dark:bg-gpt-composer dark:text-warning-200 dark:ring-warning-500/40"
              >
                {t("retryAction")}
              </button>
            </div>
          </div>
        )}

        {isHeroStage ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
            <h1 className="continuum-stagger-1 mb-7 text-center text-2xl font-medium tracking-tight text-gray-900 sm:text-3xl dark:text-white">
              {t("heroHeading")}
            </h1>
            <div className="continuum-stagger-2 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={Boolean(queryAccessError)}
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.innerWidth < 1536
                  ) {
                    setIsDesktopSidebarOpen(false);
                  }
                  setIsMindMapOpen(true);
                }}
                className="group/chip inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-medium text-brand-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-100 hover:shadow-theme-xs active:translate-y-0 active:scale-96 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/35 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
              >
                <MindMapIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{t("mindMapHeroChip")}</span>
              </button>
              {quickPromptChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={isStreaming || Boolean(queryAccessError)}
                  onClick={() => void sendQuestion(chip.prompt)}
                  className="rounded-full border border-gray-200/80 bg-gray-50/70 px-3.5 py-1.5 text-xs text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 hover:shadow-theme-xs active:translate-y-0 active:scale-96 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/4 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AiChatMessageList
            organizationId={organizationId}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            threadId={activeThreadId}
            activeThread={activeThread}
            branchingMessageId={branchingMessageId}
            isThreadStreaming={isStreaming}
            mode="chat"
            messages={displayedMessages}
            isLoadingMessages={
              Boolean(activeThreadId) && messagesQuery.isLoading
            }
            isMessagesError={
              Boolean(activeThreadId) &&
              messagesQuery.isError &&
              !queryAccessError
            }
            hasOlderMessages={Boolean(messagesQuery.hasNextPage)}
            isLoadingOlder={messagesQuery.isFetchingNextPage}
            highlightedTurnId={highlightedTurnId}
            onLoadOlder={() => void messagesQuery.fetchNextPage()}
            onRetryMessages={() => void messagesQuery.refetch()}
            onRetryTurn={(queryText) => void sendQuestion(queryText)}
            onRegenerateMessage={(msg, qMsg) =>
              void regenerateAnswer(msg, qMsg)
            }
            onBranchFromMessage={(msg) => void handleBranchFromMessage(msg)}
            onSaveAnswerToTaskNote={(message, questionText, threadId) =>
              setTaskNoteSaveTarget({
                projectId: selectedProject.id,
                threadId,
                message,
                questionText,
              })
            }
            onSelectParentThread={(parentId) => {
              setBranchNotice(null);
              handleSelectThread(parentId);
            }}
            onInspectEvidence={(evidence) => setInspectedEvidence(evidence)}
            onJumpToTurn={handleJumpToTurn}
          />
        )}

        <AiChatComposer
          variant="docked"
          mode="chat"
          value={composerValue}
          inputRef={composerTextareaRef}
          projectId={selectedProject.id}
          projectCode={selectedProject.code}
          projectName={selectedProject.name}
          projects={projects}
          isStreaming={isStreaming}
          disabled={Boolean(queryAccessError)}
          validationError={validationError}
          isProjectMenuOpen={isComposerProjectMenuOpen}
          onProjectMenuOpenChange={(nextOpen) => {
            if (nextOpen) {
              setIsProjectMenuOpen(false);
              setIsEngineMenuOpen(false);
            }
            setIsComposerProjectMenuOpen(nextOpen);
          }}
          onSelectProject={handleSelectProject}
          onChange={(next) => {
            setComposerValue(next);
            if (validationError) setValidationError(null);
          }}
          onSubmit={() => void sendQuestion(composerValue)}
          onStopStreaming={handleStopStreaming}
        />
      </div>

      {isMindMapOpen && !queryAccessError && userId && organizationId && (
        <AiChatMindMapPanel
          key={`${userId}:${organizationId}:${selectedProject.id}`}
          isOpen={isMindMapOpen}
          userId={userId}
          organizationId={organizationId}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          isChatBusy={isStreaming}
          onClose={() => setIsMindMapOpen(false)}
          onInspectEvidence={(evidence) => setInspectedEvidence(evidence)}
          onAskBranch={(prompt) => {
            if (typeof window !== "undefined" && window.innerWidth < 1280) {
              setIsMindMapOpen(false);
            }
            if (isStreaming) {
              setComposerValue(prompt);
              return;
            }
            void sendQuestion(prompt);
          }}
        />
      )}

      {/* Animated Source Evidence Sheet */}
      <AiChatEvidenceSheet
        evidence={inspectedEvidence}
        projectId={selectedProject.id}
        sessionPreviewText={
          inspectedEvidence?.kind === "session"
            ? resolveSessionCitationPreview(
                inspectedEvidence.sessionCitation,
                displayedMessagesById,
              )
            : undefined
        }
        onClose={() => setInspectedEvidence(null)}
      />
      {taskNoteSaveTarget && (
        <AiChatSaveTaskNoteDialog
          key={`${taskNoteSaveTarget.projectId}:${taskNoteSaveTarget.threadId}:${taskNoteSaveTarget.message.id}`}
          projectId={taskNoteSaveTarget.projectId}
          threadId={taskNoteSaveTarget.threadId}
          message={taskNoteSaveTarget.message}
          questionText={taskNoteSaveTarget.questionText}
          onClose={() => setTaskNoteSaveTarget(null)}
          onSaved={() => {
            setTaskNoteSaveTarget(null);
            setTaskNoteSavedNotice(true);
          }}
        />
      )}
    </div>
  );
}

export default function AiChatWorkspace() {
  const t = useTranslations("AiChat");
  return (
    <Suspense
      fallback={<WorkspaceLoadingSkeleton label={t("loadingWorkspace")} />}
    >
      <AiChatWorkspaceContent />
    </Suspense>
  );
}
