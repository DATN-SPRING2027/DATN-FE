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
import { useQueryClient } from "@tanstack/react-query";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckLineIcon,
  ChevronDownIcon,
  CloseLineIcon,
  ComposeChatIcon,
  DocsIcon,
  LockIcon,
  MindMapIcon,
  PlatformProjectsIcon,
  SearchIcon,
  ShootingStarIcon,
  SidebarPanelIcon,
} from "@/icons";
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  streamAiChatAsk,
  streamAiChatRegenerate,
} from "@/lib/queries/ai-chat/ai-chat-stream";
import type {
  AiChatMessagePage,
  AiChatRetrievalStep,
  AiChatSessionCitation,
} from "@/lib/queries/ai-chat/ai-chat.types";
import {
  aiChatKeys,
  useAiChatMessagesInfiniteQuery,
  useAiChatThreadsQuery,
  useCreateAiChatThreadMutation,
  useDeleteAiChatThreadMutation,
  useUpdateAiChatThreadMutation,
} from "@/lib/queries/ai-chat/useAiChat";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import AiChatComposer, { AI_CHAT_MAX_QUERY_LENGTH } from "./AiChatComposer";
import AiChatMessageList, {
  type DisplayAiChatMessage,
  type InspectedEvidence,
} from "./AiChatMessageList";
import AiChatSidebar from "./AiChatSidebar";
import AiChatMindMapPanel from "./AiChatMindMapPanel";
import { aiMindMapKeys } from "@/lib/queries/ai-chat/useAiMindMap";
import { isPersistedMessageId } from "./answer-action-utils";
import {
  isContinuumDocumentId,
  resolveSessionCitationPreview,
} from "./citation-utils";

function isProjectOrAuthAccessError(error: unknown): error is ApiError {
  if (!isAccessOrResourceUnavailableError(error)) return false;
  if (error.status === 404 && error.code === "AI_CHAT_RESOURCE_NOT_FOUND") {
    return false;
  }
  return true;
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
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
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
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(
    null,
  );
  const [inspectedEvidence, setInspectedEvidence] =
    useState<InspectedEvidence | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
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
          ordered.push({
            ...item,
            ...(rememberedAnswerStatus
              ? { answerStatus: rememberedAnswerStatus }
              : {}),
            ...activityTimingsByMessageId[item.id],
          });
        }
      }
    }
    return ordered;
  }, [activityTimingsByMessageId, answerStatusByMessageId, messagesQuery.data]);

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
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setManualProjectId(project.id);
      setActiveThreadId(null);
      setValidationError(null);
      setPermissionBanner(null);
      setInspectedEvidence(null);
      setIsProjectMenuOpen(false);
      setIsEngineMenuOpen(false);
      setProjectFilter("");

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("projectId", project.id);
      router.replace(`${pathname}?${nextParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const handleStartNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setActiveThreadId(null);
    setValidationError(null);
    setPermissionBanner(null);
    setHighlightedTurnId(null);
    setIsEngineMenuOpen(false);
    setIsProjectMenuOpen(false);
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setActiveThreadId(threadId);
    setValidationError(null);
    setPermissionBanner(null);
    setHighlightedTurnId(null);
  }, []);

  const handleRenameThread = useCallback(
    async (threadId: string, title: string) => {
      await updateThreadMutation.mutateAsync({ threadId, title });
    },
    [updateThreadMutation],
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      await deleteThreadMutation.mutateAsync({ threadId });
      setLocalTurnsByThread((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
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
        const collectedSteps: AiChatRetrievalStep[] = [];

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
                collectedSteps.push(event.data);
                updateLocalTurn(
                  targetThreadId,
                  activeAssistantTurnId,
                  (turn) => ({
                    ...turn,
                    retrievalSteps: [...collectedSteps],
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
                      event.data.retrievalSteps.length > 0
                        ? event.data.retrievalSteps
                        : turn.retrievalSteps,
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
              errorMessage:
                error instanceof ApiError
                  ? error.message
                  : t("permissionDeniedBody"),
            }));
          } else {
            updateLocalTurn(targetThreadId, activeAssistantTurnId, (turn) => ({
              ...turn,
              status: "failed",
              isStreaming: false,
              activityFinishedAt: Date.now(),
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
        ...(targetMessage.replyToMessageId ?? questionMessage?.id
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
      const collectedSteps: AiChatRetrievalStep[] = [];

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
              collectedSteps.push(event.data);
              updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
                ...turn,
                retrievalSteps: [...collectedSteps],
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
                  event.data.retrievalSteps.length > 0
                    ? event.data.retrievalSteps
                    : turn.retrievalSteps,
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
            errorMessage:
              error instanceof ApiError
                ? error.message
                : t("permissionDeniedBody"),
          }));
        } else {
          updateLocalTurn(targetThreadId, activeRegenTurnId, (turn) => ({
            ...turn,
            status: "failed",
            isStreaming: false,
            activityFinishedAt: Date.now(),
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
      selectedProject,
      serverMessages,
      t,
      updateLocalTurn,
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

  const filteredProjects = projectFilter.trim()
    ? projects.filter(
        (proj) =>
          proj.name
            .toLowerCase()
            .includes(projectFilter.trim().toLowerCase()) ||
          proj.code.toLowerCase().includes(projectFilter.trim().toLowerCase()),
      )
    : projects;

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
        threads={threadsQuery.data ?? []}
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
        <header className="relative flex h-13 shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
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
                  setIsEngineMenuOpen((prev) => !prev);
                }}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 sm:px-2.5 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <span className="truncate">{t("engineTitle")}</span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-70"
                />
              </button>

              {isEngineMenuOpen && (
                <div
                  role="dialog"
                  aria-label={t("engineSelectorAriaLabel")}
                  className="absolute start-0 top-11 z-40 w-72 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover"
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
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3",
                isMindMapOpen
                  ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200 dark:hover:bg-brand-500/30"
                  : "border-gray-200/80 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10",
              )}
            >
              <MindMapIcon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0",
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
                setIsProjectMenuOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:px-3 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-success-500" />
              <span className="max-w-24 truncate sm:max-w-36 2xl:max-w-48">
                {selectedProject.name}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 opacity-70"
              />
            </button>

            {isProjectMenuOpen && (
              <div
                role="listbox"
                aria-label={t("projectMenuAriaLabel")}
                className="absolute end-0 top-10 z-40 w-68 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover"
              >
                {projects.length > 5 && (
                  <div className="relative mb-1.5 flex items-center p-1">
                    <SearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute start-3 size-3.5 text-gray-400"
                    />
                    <input
                      type="search"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      placeholder={t("projectSearchPlaceholder")}
                      className="h-8 w-full rounded-xl border border-gray-200 bg-gray-50 ps-8 pe-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gpt-composer dark:text-gray-100"
                    />
                  </div>
                )}

                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                      {t("projectSearchEmpty")}
                    </p>
                  ) : (
                    filteredProjects.map((proj) => {
                      const isSelected = proj.id === selectedProject.id;
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectProject(proj)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-xs transition-colors",
                            isSelected
                              ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">
                              {proj.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs opacity-65">
                              <span>{proj.code}</span>
                              <span>·</span>
                              <span>
                                {proj.visibility === "PRIVATE"
                                  ? t("visibilityPrivate")
                                  : t("visibilityPublic")}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckLineIcon
                              aria-hidden="true"
                              className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

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
            <h1 className="mb-7 text-center text-2xl font-medium tracking-tight text-gray-900 sm:text-3xl dark:text-white">
              {t("heroHeading")}
            </h1>
            <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
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
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/35 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
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
                  className="rounded-full border border-gray-200/80 bg-gray-50/70 px-3.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/4 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
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
            onInspectEvidence={(evidence) => setInspectedEvidence(evidence)}
            onJumpToTurn={handleJumpToTurn}
          />
        )}

        <AiChatComposer
          variant="docked"
          mode="chat"
          value={composerValue}
          projectId={selectedProject.id}
          projectCode={selectedProject.code}
          projectName={selectedProject.name}
          isStreaming={isStreaming}
          disabled={Boolean(queryAccessError)}
          validationError={validationError}
          onChange={(next) => {
            setComposerValue(next);
            if (validationError) setValidationError(null);
          }}
          onSubmit={() => void sendQuestion(composerValue)}
          onStopStreaming={handleStopStreaming}
          onOpenProjectMenu={() => setIsProjectMenuOpen(true)}
        />
      </div>

      {isMindMapOpen && userId && organizationId && (
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

      {/* Evidence Excerpt Inspector Modal */}
      {inspectedEvidence && (
        <div className="fixed inset-0 z-999999 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeDialog")}
            onClick={() => setInspectedEvidence(null)}
            className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("citationDialogAriaLabel")}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-white/10 dark:bg-gpt-popover"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                    inspectedEvidence.kind === "document"
                      ? "bg-brand-500/15 text-brand-600 dark:text-brand-300"
                      : "bg-warning-500/20 text-warning-800 dark:text-warning-300",
                  )}
                >
                  [
                  {inspectedEvidence.kind === "document"
                    ? inspectedEvidence.citation.number
                    : inspectedEvidence.sessionCitation.ref}
                  ]
                </span>
                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {inspectedEvidence.kind === "document"
                    ? (inspectedEvidence.citation.documentName ??
                      inspectedEvidence.citation.sourceName ??
                      inspectedEvidence.citation.documentId)
                    : inspectedEvidence.sessionCitation.source ===
                        "selected_group"
                      ? t("sessionSelectedGroup")
                      : t("sessionRecentContinuity")}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setInspectedEvidence(null)}
                aria-label={t("closeDialog")}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <CloseLineIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            {inspectedEvidence.kind === "document" ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-gray-500 tabular-nums dark:text-gray-400">
                  <DocsIcon aria-hidden="true" className="size-3.5" />
                  {inspectedEvidence.citation.versionNo !== undefined && (
                    <span>
                      {t("versionBadge", {
                        version: inspectedEvidence.citation.versionNo,
                      })}
                    </span>
                  )}
                  {inspectedEvidence.citation.pageFrom && (
                    <span>
                      {inspectedEvidence.citation.pageTo &&
                      inspectedEvidence.citation.pageTo !==
                        inspectedEvidence.citation.pageFrom
                        ? t("pageRangeLabel", {
                            from: inspectedEvidence.citation.pageFrom,
                            to: inspectedEvidence.citation.pageTo,
                          })
                        : t("pageSingleLabel", {
                            page: inspectedEvidence.citation.pageFrom,
                          })}
                    </span>
                  )}
                </div>

                {inspectedEvidence.citation.heading && (
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                      {t("excerptHeadingLabel")}
                    </p>
                    <p className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
                      {inspectedEvidence.citation.heading}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                    {t("excerptContentLabel")}
                  </p>
                  <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-200">
                    {inspectedEvidence.citation.snippet ??
                      t("excerptNoSnippet")}
                  </div>
                </div>

                {isContinuumDocumentId(
                  inspectedEvidence.citation.documentId,
                ) && (
                  <div className="flex justify-end pt-2">
                    <Link
                      href={`/projects/${encodeURIComponent(
                        selectedProject.id,
                      )}/documents/${encodeURIComponent(
                        inspectedEvidence.citation.documentId,
                      )}`}
                      onClick={() => setInspectedEvidence(null)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      <span>{t("openDocumentLink")}</span>
                      <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                    {t("excerptContentLabel")}
                  </p>
                  <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-warning-500/25 bg-warning-50/40 p-3.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 dark:bg-gpt-sidebar dark:text-gray-200">
                    {resolveSessionCitationPreview(
                      inspectedEvidence.sessionCitation,
                      displayedMessagesById,
                    )}
                  </div>
                </div>

                {inspectedEvidence.sessionCitation.turnIds.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                      {t("turnReferenceIdsLabel")}
                    </p>
                    <p className="font-mono mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {inspectedEvidence.sessionCitation.turnIds.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
