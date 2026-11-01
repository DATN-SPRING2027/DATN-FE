"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  ChatIcon,
  CheckCircleIcon,
  CloseLineIcon,
  DocsIcon,
  LockIcon,
  MaximizeIcon,
  MindMapIcon,
  MinimizeIcon,
  RefreshIcon,
  ShootingStarIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import type {
  AiChatCitation,
  AiChatMindMapNode,
} from "@/lib/queries/ai-chat/ai-chat.types";
import {
  AI_MIND_MAP_MAX_TOPIC_LENGTH,
  normalizeMindMapTopic,
  useAiMindMap,
} from "@/lib/queries/ai-chat/useAiMindMap";
import { cn } from "@/utils";
import type { InspectedEvidence } from "./AiChatMessageList";
import AiChatMindMapCanvas from "./AiChatMindMapCanvas";
import AiChatMindMapLoadingStudio from "./AiChatMindMapLoadingStudio";
import {
  MIND_MAP_BRANCH_PALETTE_COUNT,
  buildBranchDeepDivePrompt,
  computeMindMapLayout,
  createAllExpandedIds,
  createDefaultExpandedIds,
  type PositionedMindMapNode,
} from "./mind-map-layout";
import { getMindMapBranchPalette } from "./mind-map-theme";

export type AiChatMindMapPanelProps = Readonly<{
  isOpen: boolean;
  userId: string;
  organizationId: string;
  projectId: string;
  projectName: string;
  isChatBusy: boolean;
  onClose: () => void;
  onInspectEvidence: (evidence: InspectedEvidence) => void;
  onAskBranch: (prompt: string) => void;
}>;

export const AI_CHAT_MIND_MAP_DEFAULT_WIDTH = 440;
export const AI_CHAT_MIND_MAP_MIN_WIDTH = 340;
export const AI_CHAT_MIND_MAP_MAX_WIDTH = 920;
export const AI_CHAT_MIND_MAP_WIDTH_STORAGE_KEY =
  "continuum.aiChat.mindMapWidth";
const MIND_MAP_KEYBOARD_STEP = 20;
const MIN_CHAT_COLUMN_WIDTH = 500;

function resolveAvailableSplitWidth(panelEl: HTMLElement | null): number | null {
  if (!panelEl) return null;
  const chatSibling = panelEl.previousElementSibling;
  if (chatSibling instanceof HTMLElement) {
    const combined = chatSibling.clientWidth + panelEl.clientWidth;
    if (combined > 0) return combined;
  }
  const parentWidth = panelEl.parentElement?.clientWidth ?? 0;
  return parentWidth > 0 ? parentWidth : null;
}

function clampMindMapWidth(
  rawWidth: number,
  availableSplitWidth?: number | null,
): number {
  let maxAllowed = AI_CHAT_MIND_MAP_MAX_WIDTH;
  if (typeof availableSplitWidth === "number" && availableSplitWidth > 0) {
    maxAllowed = Math.max(
      AI_CHAT_MIND_MAP_MIN_WIDTH,
      Math.min(
        AI_CHAT_MIND_MAP_MAX_WIDTH,
        availableSplitWidth - MIN_CHAT_COLUMN_WIDTH,
      ),
    );
  } else if (typeof window !== "undefined" && window.innerWidth >= 1280) {
    maxAllowed = Math.max(
      AI_CHAT_MIND_MAP_MIN_WIDTH,
      Math.min(
        AI_CHAT_MIND_MAP_MAX_WIDTH,
        Math.floor(window.innerWidth * 0.65),
      ),
    );
  }
  return Math.round(
    Math.min(maxAllowed, Math.max(AI_CHAT_MIND_MAP_MIN_WIDTH, rawWidth)),
  );
}

function readStoredMindMapWidth(): number {
  if (typeof window === "undefined") {
    return AI_CHAT_MIND_MAP_DEFAULT_WIDTH;
  }
  try {
    const saved = window.localStorage.getItem(
      AI_CHAT_MIND_MAP_WIDTH_STORAGE_KEY,
    );
    if (saved !== null) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        return clampMindMapWidth(parsed, null);
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return AI_CHAT_MIND_MAP_DEFAULT_WIDTH;
}

function prefersSmoothMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  );
}

function findNodeAnywhere(
  node: AiChatMindMapNode | null,
  targetId: string | null,
  ancestors: readonly string[] = [],
  depth = 0,
  branchIndex = -1,
): PositionedMindMapNode | null {
  if (!node || !targetId) return null;
  if (node.id === targetId) {
    return {
      node,
      depth,
      branchIndex,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      centerY: 0,
      lines: [node.label],
      hasChildren: node.children.length > 0,
      isExpanded: false,
      hiddenDescendantCount: node.children.length,
      ancestorLabels: ancestors,
    };
  }
  const nextAncestors = [...ancestors, node.label];
  for (let idx = 0; idx < node.children.length; idx += 1) {
    const child = node.children[idx]!;
    const nextBranchIndex =
      depth === 0 ? idx % MIND_MAP_BRANCH_PALETTE_COUNT : branchIndex;
    const found = findNodeAnywhere(
      child,
      targetId,
      nextAncestors,
      depth + 1,
      nextBranchIndex,
    );
    if (found) return found;
  }
  return null;
}

export default function AiChatMindMapPanel({
  isOpen,
  userId,
  organizationId,
  projectId,
  isChatBusy,
  onClose,
  onInspectEvidence,
  onAskBranch,
}: AiChatMindMapPanelProps) {
  const t = useTranslations("AiChat");
  const rawLocale = useLocale();
  const promptLocale: "vi" | "en" = rawLocale === "vi" ? "vi" : "en";

  const [topicInput, setTopicInput] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [manualSubmittedTopic, setManualSubmittedTopic] = useState<
    string | null
  >(null);
  const [topicValidationError, setTopicValidationError] = useState<
    string | null
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasToggledFullscreen, setHasToggledFullscreen] = useState(false);
  const [isClosingFullscreen, setIsClosingFullscreen] = useState(false);
  const fullscreenTimerRef = useRef<number | null>(null);

  const [panelWidth, setPanelWidth] = useState<number>(readStoredMindMapWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);

  const commitPanelWidth = useCallback((nextWidth: number) => {
    const availableSplitWidth = resolveAvailableSplitWidth(panelRef.current);
    const clamped = clampMindMapWidth(nextWidth, availableSplitWidth);
    setPanelWidth(clamped);
    try {
      window.localStorage.setItem(
        AI_CHAT_MIND_MAP_WIDTH_STORAGE_KEY,
        String(clamped),
      );
    } catch {
      // Ignore storage quota / private mode failures
    }
  }, []);

  const startResizeAt = useCallback(
    (startX: number) => {
      dragCleanupRef.current?.();

      const renderedWidth =
        panelRef.current?.getBoundingClientRect().width ?? 0;
      const startWidth =
        renderedWidth > 0 ? Math.round(renderedWidth) : panelWidth;
      const isRtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";

      isDraggingRef.current = true;
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const updateFromClientX = (clientX: number) => {
        const delta = isRtl ? clientX - startX : startX - clientX;
        commitPanelWidth(startWidth + delta);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateFromClientX(moveEvent.clientX);
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateFromClientX(moveEvent.clientX);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        isDraggingRef.current = false;
        setIsResizing(false);
        dragCleanupRef.current = null;
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", cleanup);
    },
    [commitPanelWidth, panelWidth],
  );

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      startResizeAt(event.clientX);
    },
    [startResizeAt],
  );

  const handleResizeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDraggingRef.current) return;
      event.preventDefault();
      startResizeAt(event.clientX);
    },
    [startResizeAt],
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const isRtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";
      const growKey = isRtl ? "ArrowRight" : "ArrowLeft";
      const shrinkKey = isRtl ? "ArrowLeft" : "ArrowRight";

      if (event.key === growKey) {
        event.preventDefault();
        commitPanelWidth(panelWidth + MIND_MAP_KEYBOARD_STEP);
      } else if (event.key === shrinkKey) {
        event.preventDefault();
        commitPanelWidth(panelWidth - MIND_MAP_KEYBOARD_STEP);
      } else if (event.key === "Home") {
        event.preventDefault();
        commitPanelWidth(AI_CHAT_MIND_MAP_MIN_WIDTH);
      } else if (event.key === "End") {
        event.preventDefault();
        commitPanelWidth(AI_CHAT_MIND_MAP_MAX_WIDTH);
      }
    },
    [commitPanelWidth, panelWidth],
  );

  const scopeKey = `${userId}:${organizationId}:${projectId}`;
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);
  if (prevScopeKey !== scopeKey) {
    setPrevScopeKey(scopeKey);
    setTopicInput("");
    setActiveTopic("");
    setManualSubmittedTopic(null);
    setTopicValidationError(null);
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    setManualSubmittedTopic(null);
    setIsClosingFullscreen(false);
    if (!isOpen) {
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      if (fullscreenTimerRef.current !== null) {
        window.clearTimeout(fullscreenTimerRef.current);
      }
    };
  }, []);

  const {
    mindMap,
    isCheckingSaved,
    isGenerating,
    error,
    isError,
    resetError,
    generate,
  } = useAiMindMap({
    userId,
    organizationId,
    projectId,
    topic: activeTopic,
    enabled: isOpen,
    skipAutoFetch: manualSubmittedTopic === activeTopic,
  });

  const autoInitializedRef = useRef<string | null>(null);

  // Only synthesize automatically when the server explicitly reports status === "uninitialized"
  // (meaning ready documents exist, but no Mind Map snapshot has been generated for this scope yet).
  useEffect(() => {
    if (!isOpen || !userId || !organizationId || !projectId) return;
    if (!mindMap || mindMap.status !== "uninitialized" || isGenerating) return;
    const initKey = `${scopeKey}:${activeTopic}:${mindMap.scopeFingerprint}`;
    if (autoInitializedRef.current === initKey) return;
    autoInitializedRef.current = initKey;
    void generate({ topic: activeTopic, refresh: false }).catch(
      () => undefined,
    );
  }, [
    activeTopic,
    generate,
    isGenerating,
    isOpen,
    mindMap,
    organizationId,
    projectId,
    scopeKey,
    userId,
  ]);

  const handleExitFullscreenImmediate = useCallback(() => {
    if (fullscreenTimerRef.current !== null) {
      window.clearTimeout(fullscreenTimerRef.current);
      fullscreenTimerRef.current = null;
    }
    setIsClosingFullscreen(false);
    setIsFullscreen(false);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setHasToggledFullscreen(true);
    if (!isFullscreen) {
      if (fullscreenTimerRef.current !== null) {
        window.clearTimeout(fullscreenTimerRef.current);
        fullscreenTimerRef.current = null;
      }
      setIsClosingFullscreen(false);
      setIsFullscreen(true);
      return;
    }
    if (!prefersSmoothMotion()) {
      handleExitFullscreenImmediate();
      return;
    }
    if (isClosingFullscreen) return;
    setIsClosingFullscreen(true);
    fullscreenTimerRef.current = window.setTimeout(() => {
      fullscreenTimerRef.current = null;
      setIsClosingFullscreen(false);
      setIsFullscreen(false);
    }, 170);
  }, [handleExitFullscreenImmediate, isClosingFullscreen, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleExitFullscreenImmediate();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleExitFullscreenImmediate, isFullscreen]);

  const tree = mindMap?.tree ?? null;
  const citations = mindMap?.citations;
  const treeIdentity =
    mindMap && tree
      ? `${mindMap.projectId}:${mindMap.topic ?? ""}:${mindMap.scopeFingerprint}:${mindMap.generatedAt}`
      : "";

  const [treeInteraction, setTreeInteraction] = useState<{
    identity: string;
    expandedIds: ReadonlySet<string>;
    selectedNodeId: string | null;
  }>({
    identity: "",
    expandedIds: new Set<string>(),
    selectedNodeId: null,
  });

  const interactionIdentity = treeInteraction.identity;
  const interactionExpandedIds = treeInteraction.expandedIds;
  const interactionSelectedNodeId = treeInteraction.selectedNodeId;

  const effectiveExpandedIds = useMemo(() => {
    if (!tree) return new Set<string>();
    if (interactionIdentity === treeIdentity) {
      return interactionExpandedIds;
    }
    return createDefaultExpandedIds(tree);
  }, [interactionExpandedIds, interactionIdentity, tree, treeIdentity]);

  const effectiveSelectedNodeId = useMemo(() => {
    if (!tree) return null;
    if (interactionIdentity === treeIdentity && interactionSelectedNodeId) {
      return interactionSelectedNodeId;
    }
    return tree.id;
  }, [interactionIdentity, interactionSelectedNodeId, tree, treeIdentity]);

  const layout = useMemo(() => {
    if (!tree) return null;
    return computeMindMapLayout(tree, effectiveExpandedIds);
  }, [effectiveExpandedIds, tree]);

  const citationsByNumber = useMemo(() => {
    const map = new Map<number, AiChatCitation>();
    for (const citation of citations ?? []) {
      map.set(citation.number, citation);
    }
    return map;
  }, [citations]);

  const selectedPositionedNode = useMemo(() => {
    if (!layout || !effectiveSelectedNodeId) return null;
    const visibleMatch = layout.nodes.find(
      (item) => item.node.id === effectiveSelectedNodeId,
    );
    if (visibleMatch) return visibleMatch;
    return (
      findNodeAnywhere(tree, effectiveSelectedNodeId) ?? layout.nodes[0] ?? null
    );
  }, [effectiveSelectedNodeId, layout, tree]);

  const resolveCitationsForNode = useCallback(
    (item: PositionedMindMapNode | null): AiChatCitation[] => {
      if (!item) return [];
      const resolved: AiChatCitation[] = [];
      for (const num of item.node.citationNumbers) {
        const match = citationsByNumber.get(num);
        if (match) resolved.push(match);
      }
      return resolved;
    },
    [citationsByNumber],
  );

  const selectedNodeCitations = useMemo(
    () => resolveCitationsForNode(selectedPositionedNode),
    [resolveCitationsForNode, selectedPositionedNode],
  );

  const openEvidenceForNode = useCallback(
    (item: PositionedMindMapNode, preferredCitation?: AiChatCitation) => {
      const nodeCitations = resolveCitationsForNode(item);
      const primary = preferredCitation ?? nodeCitations[0];
      if (!primary) return;
      const focusTerms = [
        item.node.label,
        ...item.ancestorLabels.slice(1),
      ].filter(Boolean);
      onInspectEvidence({
        kind: "document",
        citation: primary,
        focusLabel: item.depth > 0 ? item.node.label : undefined,
        focusTerms,
        relatedCitations: nodeCitations,
      });
    },
    [onInspectEvidence, resolveCitationsForNode],
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      setTreeInteraction((prev) => ({
        identity: treeIdentity,
        expandedIds:
          prev.identity === treeIdentity
            ? prev.expandedIds
            : createDefaultExpandedIds(tree),
        selectedNodeId: nodeId,
      }));
    },
    [tree, treeIdentity],
  );

  const handleClearBranchSelection = useCallback(() => {
    if (!tree) return;
    setTreeInteraction((prev) => ({
      identity: treeIdentity,
      expandedIds:
        prev.identity === treeIdentity
          ? prev.expandedIds
          : createDefaultExpandedIds(tree),
      selectedNodeId: tree.id,
    }));
  }, [tree, treeIdentity]);

  const handleToggleNode = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      setTreeInteraction((prev) => {
        const currentExpanded =
          prev.identity === treeIdentity
            ? new Set(prev.expandedIds)
            : createDefaultExpandedIds(tree);
        if (currentExpanded.has(nodeId)) {
          currentExpanded.delete(nodeId);
        } else {
          currentExpanded.add(nodeId);
        }
        return {
          identity: treeIdentity,
          expandedIds: currentExpanded,
          selectedNodeId:
            prev.identity === treeIdentity && prev.selectedNodeId
              ? prev.selectedNodeId
              : nodeId,
        };
      });
    },
    [tree, treeIdentity],
  );

  const handleExpandAll = useCallback(() => {
    if (!tree) return;
    setTreeInteraction((prev) => ({
      identity: treeIdentity,
      expandedIds: createAllExpandedIds(tree),
      selectedNodeId:
        prev.identity === treeIdentity ? prev.selectedNodeId : tree.id,
    }));
  }, [tree, treeIdentity]);

  const handleCollapseDefault = useCallback(() => {
    if (!tree) return;
    setTreeInteraction((prev) => ({
      identity: treeIdentity,
      expandedIds: createDefaultExpandedIds(tree),
      selectedNodeId:
        prev.identity === treeIdentity ? prev.selectedNodeId : tree.id,
    }));
  }, [tree, treeIdentity]);

  const handleSubmitTopic = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizeMindMapTopic(topicInput);
      if (
        normalized.length > AI_MIND_MAP_MAX_TOPIC_LENGTH ||
        normalized.toUpperCase().length > AI_MIND_MAP_MAX_TOPIC_LENGTH
      ) {
        setTopicValidationError(
          t("mindMapTopicValidationLength", {
            max: AI_MIND_MAP_MAX_TOPIC_LENGTH,
          }),
        );
        return;
      }
      setTopicValidationError(null);
      setManualSubmittedTopic(normalized);
      setActiveTopic(normalized);
      void generate({ topic: normalized, refresh: true }).catch(
        () => undefined,
      );
    },
    [generate, t, topicInput],
  );

  const handleForceRefresh = useCallback(() => {
    setTopicValidationError(null);
    setManualSubmittedTopic(activeTopic);
    void generate({ topic: activeTopic, refresh: true }).catch(
      () => undefined,
    );
  }, [activeTopic, generate]);

  const handleResetOverview = useCallback(() => {
    setTopicInput("");
    setTopicValidationError(null);
    setManualSubmittedTopic(null);
    setActiveTopic("");
    resetError();
  }, [resetError]);

  const handleRetry = useCallback(() => {
    setTopicValidationError(null);
    setManualSubmittedTopic(activeTopic);
    void generate({ topic: activeTopic, refresh: true }).catch(
      () => undefined,
    );
  }, [activeTopic, generate]);

  const handleAskInChat = useCallback(() => {
    if (!selectedPositionedNode) return;
    const prompt = buildBranchDeepDivePrompt(
      selectedPositionedNode,
      promptLocale,
    );
    if (isFullscreen) {
      handleExitFullscreenImmediate();
    }
    onAskBranch(prompt);
  }, [
    handleExitFullscreenImmediate,
    isFullscreen,
    onAskBranch,
    promptLocale,
    selectedPositionedNode,
  ]);

  if (!isOpen) {
    return null;
  }

  const isAccessDenied = isError && isAccessOrResourceUnavailableError(error);
  const isServerFailure = isError && !isAccessDenied;
  const isSynthesizing =
    isGenerating || (!isError && mindMap?.status === "uninitialized");
  const isInitialChecking =
    !mindMap && isCheckingSaved && !isGenerating && !isError;
  const coverage = mindMap?.coverage;
  const normalizedInput = normalizeMindMapTopic(topicInput);
  const isSameActiveTopic =
    Boolean(mindMap && mindMap.status !== "uninitialized") &&
    normalizedInput === activeTopic;
  const selectedPalette = getMindMapBranchPalette(
    selectedPositionedNode?.branchIndex ?? -1,
  );
  const activeBranchSelection =
    selectedPositionedNode && selectedPositionedNode.depth > 0
      ? selectedPositionedNode
      : null;

  const panelBody = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gpt-sidebar">
      {/* Clean Single-Line Studio Header */}
      <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-gray-200/80 px-3.5 py-2.5 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
            <MindMapIcon aria-hidden="true" className="size-4" />
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {t("mindMapTitle")}
            </h2>
            <span className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-300">
              {t("mindMapStudioBadge")}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="mind-map-fullscreen-toggle"
            onClick={handleToggleFullscreen}
            aria-label={
              isFullscreen
                ? t("mindMapExitFullscreen")
                : t("mindMapOpenFullscreen")
            }
            className="group inline-flex size-8 items-center justify-center rounded-xl text-gray-500 transition-all duration-200 hover:bg-brand-50 hover:text-brand-600 active:scale-92 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span className="relative inline-flex size-4 items-center justify-center">
              <MaximizeIcon
                aria-hidden="true"
                className={cn(
                  "continuum-mind-map-fullscreen-icon absolute inset-0 size-4",
                  isFullscreen
                    ? "rotate-90 scale-75 opacity-0"
                    : cn(
                        "scale-100 opacity-100 group-hover:scale-110",
                        hasToggledFullscreen &&
                          "continuum-fullscreen-maximize-icon-enter",
                      ),
                )}
              />
              <MinimizeIcon
                aria-hidden="true"
                className={cn(
                  "continuum-mind-map-fullscreen-icon absolute inset-0 size-4",
                  isFullscreen
                    ? cn(
                        "scale-100 opacity-100 group-hover:scale-90",
                        hasToggledFullscreen &&
                          "continuum-fullscreen-minimize-icon-enter",
                      )
                    : "-rotate-90 scale-75 opacity-0",
                )}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleExitFullscreenImmediate();
              onClose();
            }}
            aria-label={t("mindMapClosePanel")}
            className="inline-flex size-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* Sleek Glass Studio Topic Focus Bar */}
      <form
        onSubmit={handleSubmitTopic}
        noValidate
        className="shrink-0 border-b border-gray-200/70 bg-gray-50/75 px-3.5 py-2 dark:border-white/10 dark:bg-gpt-canvas/70"
      >
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-white ps-2.5 pe-2 transition-colors dark:bg-gpt-composer",
              topicValidationError
                ? "border-error-500 focus-within:border-error-500"
                : "border-gray-200/90 focus-within:border-brand-500 dark:border-white/12 dark:focus-within:border-brand-400",
            )}
          >
            <ShootingStarIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 text-brand-500 dark:text-brand-400"
            />
            <label htmlFor="ai-mind-map-topic-input" className="sr-only">
              {t("mindMapTopicLabel")}
            </label>
            <input
              id="ai-mind-map-topic-input"
              data-testid="mind-map-topic-input"
              type="text"
              value={topicInput}
              aria-invalid={Boolean(topicValidationError)}
              onChange={(event) => {
                setTopicInput(event.target.value);
                if (topicValidationError) {
                  setTopicValidationError(null);
                }
              }}
              placeholder={t("mindMapTopicPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {activeTopic && (
            <button
              type="button"
              disabled={isSynthesizing}
              onClick={handleResetOverview}
              className="inline-flex h-9 shrink-0 items-center rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/12 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t("mindMapResetOverviewCta")}
            </button>
          )}

          <button
            type="submit"
            data-testid="mind-map-submit-button"
            disabled={isSynthesizing || isInitialChecking}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <RefreshIcon
              aria-hidden="true"
              className={cn(
                "size-3.5",
                isSynthesizing && "animate-spin motion-reduce:animate-none",
              )}
            />
            <span>
              {isSynthesizing
                ? t("mindMapGeneratingCta")
                : isSameActiveTopic
                  ? t("mindMapRegenerateCta")
                  : t("mindMapGenerateCta")}
            </span>
          </button>
        </div>

        {topicValidationError && (
          <p
            role="alert"
            data-testid="mind-map-validation-error"
            className="mt-1.5 text-xs font-medium text-error-600 dark:text-error-400"
          >
            {topicValidationError}
          </p>
        )}
      </form>

      {/* Main Content Area: All 8 Explicit States */}
      {isSynthesizing ? (
        <AiChatMindMapLoadingStudio mode="synthesizing" />
      ) : isInitialChecking ? (
        <AiChatMindMapLoadingStudio mode="checking" />
      ) : isAccessDenied ? (
        <div
          role="alert"
          data-testid="mind-map-permission-error"
          className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50/70 p-6 text-center dark:bg-gpt-canvas"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 ring-1 ring-warning-200/70 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30">
            <LockIcon aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
            {t("mindMapPermissionErrorTitle")}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-600 dark:text-gray-400">
            {t("mindMapPermissionErrorBody")}
          </p>
          <button
            type="button"
            data-testid="mind-map-retry-button"
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-theme-xs hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
          >
            <RefreshIcon aria-hidden="true" className="size-3.5" />
            <span>{t("retryAction")}</span>
          </button>
        </div>
      ) : isServerFailure ? (
        <div
          role="alert"
          data-testid="mind-map-server-error"
          className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50/70 p-6 text-center dark:bg-gpt-canvas"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-error-50 text-error-600 ring-1 ring-error-200/70 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/30">
            <AlertIcon aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
            {t("mindMapServerErrorTitle")}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-600 dark:text-gray-400">
            {t("mindMapServerErrorBody")}
          </p>
          <button
            type="button"
            data-testid="mind-map-retry-button"
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <RefreshIcon aria-hidden="true" className="size-3.5" />
            <span>{t("retryAction")}</span>
          </button>
        </div>
      ) : !mindMap || mindMap.status === "empty" || !layout ? (
        <div
          data-testid="mind-map-empty-state"
          className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50/70 p-6 text-center dark:bg-gpt-canvas"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-white/8 dark:text-gray-300 dark:ring-white/10">
            <DocsIcon aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
            {t("mindMapEmptyTitle")}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-600 dark:text-gray-400">
            {t("mindMapEmptyBody")}
          </p>
          {coverage && coverage.pendingDocumentCount > 0 && (
            <p className="mt-2.5 rounded-xl bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-800 tabular-nums dark:bg-warning-500/15 dark:text-warning-300">
              {t("mindMapEmptyPendingNotice", {
                count: coverage.pendingDocumentCount,
              })}
            </p>
          )}
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/documents`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-600 shadow-theme-xs hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-popover dark:text-brand-300 dark:hover:bg-white/10"
          >
            <span>{t("manageDocumentsCta")}</span>
            <ArrowRightIcon
              aria-hidden="true"
              className="size-3.5 rtl:rotate-180"
            />
          </Link>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Floating Glass Coverage & Saved Snapshot Strip */}
          <div className="pointer-events-none absolute top-2.5 start-3 end-3 z-10 flex flex-wrap items-center gap-1.5 tabular-nums">
            <span className="inline-flex items-center rounded-full border border-gray-200/90 bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700 shadow-theme-xs backdrop-blur-md dark:border-white/12 dark:bg-gpt-popover/90 dark:text-gray-200">
              {mindMap.topic
                ? t("mindMapTopicActiveBadge", { topic: mindMap.topic })
                : t("mindMapOverviewBadge")}
            </span>

            {coverage && (
              <>
                <span className="inline-flex items-center rounded-full border border-success-200/90 bg-success-50/92 px-2.5 py-0.5 text-xs font-semibold text-success-700 shadow-theme-xs backdrop-blur-md dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-300">
                  {t("mindMapCoverageUsed", {
                    used: coverage.usedDocumentCount,
                    total: coverage.accessibleReadyDocumentCount,
                  })}
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-200/90 bg-white/90 px-2.5 py-0.5 text-xs text-gray-600 shadow-theme-xs backdrop-blur-md dark:border-white/12 dark:bg-gpt-popover/90 dark:text-gray-300">
                  {t("mindMapCoverageEvidence", {
                    count: coverage.evidenceUnitCount,
                  })}
                </span>
                {coverage.omittedDocumentCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-warning-200/90 bg-warning-50/92 px-2.5 py-0.5 text-xs font-medium text-warning-800 shadow-theme-xs backdrop-blur-md dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300">
                    {t("mindMapCoverageOmitted", {
                      count: coverage.omittedDocumentCount,
                    })}
                  </span>
                )}
                {coverage.pendingDocumentCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-blue-light-200/90 bg-blue-light-50/92 px-2.5 py-0.5 text-xs font-medium text-blue-light-700 shadow-theme-xs backdrop-blur-md dark:border-blue-light-500/30 dark:bg-blue-light-500/15 dark:text-blue-light-300">
                    {t("mindMapCoveragePending", {
                      count: coverage.pendingDocumentCount,
                    })}
                  </span>
                )}
              </>
            )}

            {mindMap.hasSourceUpdates ? (
              <button
                type="button"
                data-testid="mind-map-new-docs-refresh"
                onClick={handleForceRefresh}
                title={t("mindMapNewDocsHint")}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-warning-300 bg-warning-50/95 px-2.5 py-0.5 text-xs font-semibold text-warning-800 shadow-theme-xs backdrop-blur-md transition-colors hover:bg-warning-100 dark:border-warning-500/40 dark:bg-warning-500/20 dark:text-warning-200 dark:hover:bg-warning-500/30"
              >
                <RefreshIcon aria-hidden="true" className="size-3" />
                <span>{t("mindMapNewDocsBadge")}</span>
              </button>
            ) : mindMap.cached ? (
              <span
                data-testid="mind-map-saved-badge"
                className="inline-flex items-center gap-1 rounded-full border border-brand-200/90 bg-brand-50/92 px-2.5 py-0.5 text-xs font-medium text-brand-700 shadow-theme-xs backdrop-blur-md dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
              >
                <CheckCircleIcon aria-hidden="true" className="size-3.5" />
                <span>{t("mindMapSavedBadge")}</span>
              </span>
            ) : null}
          </div>

          {/* Full-Bleed Interactive SVG Canvas */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AiChatMindMapCanvas
              key={isFullscreen ? "fullscreen" : "docked"}
              layout={layout}
              selectedNodeId={selectedPositionedNode?.node.id ?? null}
              isFullscreen={isFullscreen}
              inspectorReserveWidth={0}
              onSelectNode={handleSelectNode}
              onToggleNode={handleToggleNode}
              onInspectNodeSources={(item) => openEvidenceForNode(item)}
              onExpandAll={handleExpandAll}
              onCollapseDefault={handleCollapseDefault}
            />

            {/* Minimal Quick-Action Bar — shown ONLY when a non-root branch node is selected */}
            {activeBranchSelection && (
              <div
                key={activeBranchSelection.node.id}
                data-testid="mind-map-branch-quickbar"
                className={cn(
                  "continuum-quickbar-enter shrink-0 bg-white/95 backdrop-blur-md dark:bg-gpt-sidebar/95",
                  isFullscreen
                    ? "flex flex-col gap-2 border-t border-gray-200/80 px-3.5 py-2.5 lg:absolute lg:end-4 lg:bottom-3 lg:z-20 lg:max-w-2xl lg:flex-row lg:items-center lg:gap-2.5 lg:rounded-2xl lg:border lg:py-2 lg:shadow-theme-xl dark:border-white/12"
                    : "flex flex-col gap-2 border-t border-gray-200/80 px-3.5 py-2.5 dark:border-white/10",
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2 lg:flex-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        selectedPalette.dotBg,
                      )}
                    />
                    <span
                      title={activeBranchSelection.node.label}
                      className="truncate text-xs font-bold text-gray-900 dark:text-white"
                    >
                      {activeBranchSelection.node.label}
                    </span>
                  </div>

                  {!isFullscreen && (
                    <button
                      type="button"
                      data-testid="mind-map-selection-clear"
                      onClick={handleClearBranchSelection}
                      aria-label={t("mindMapClearSelectionAria")}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <CloseLineIcon aria-hidden="true" className="size-3.5" />
                    </button>
                  )}
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center gap-1.5",
                    !isFullscreen && "justify-between",
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {selectedNodeCitations.map((citation) => (
                      <button
                        key={citation.number}
                        type="button"
                        data-testid={`mind-map-citation-${citation.number}`}
                        onClick={() =>
                          openEvidenceForNode(activeBranchSelection, citation)
                        }
                        className={cn(
                          "inline-flex max-w-48 items-center gap-1 rounded-lg border border-gray-200/90 px-2 py-1 text-xs font-semibold transition-all hover:scale-102 active:scale-98 dark:border-white/12",
                          selectedPalette.inspectorBadgeBg,
                          selectedPalette.inspectorBadgeText,
                        )}
                      >
                        <DocsIcon aria-hidden="true" className="size-3 shrink-0" />
                        <span className="tabular-nums">[{citation.number}]</span>
                        <span className="truncate font-medium">
                          {citation.documentName ??
                            citation.sourceName ??
                            citation.documentId}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="ms-auto flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="mind-map-ask-branch"
                      onClick={handleAskInChat}
                      title={
                        isChatBusy ? t("mindMapAskInChatBusyHint") : undefined
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-theme-xs transition-all hover:bg-brand-700 active:scale-98 dark:bg-brand-500 dark:hover:bg-brand-600"
                    >
                      <ChatIcon aria-hidden="true" className="size-3.5" />
                      <span>{t("mindMapAskInChatCta")}</span>
                    </button>

                    {isFullscreen && (
                      <button
                        type="button"
                        data-testid="mind-map-selection-clear"
                        onClick={handleClearBranchSelection}
                        aria-label={t("mindMapClearSelectionAria")}
                        className="inline-flex size-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <CloseLineIcon aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-99999 flex items-center justify-center p-2 sm:p-5">
        <button
          type="button"
          aria-label={t("mindMapExitFullscreen")}
          onClick={handleToggleFullscreen}
          className={cn(
            "fixed inset-0 bg-gray-950/70 backdrop-blur-xs",
            isClosingFullscreen
              ? "continuum-backdrop-exit"
              : "continuum-backdrop-enter",
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("mindMapTitle")}
          data-testid="mind-map-fullscreen-dialog"
          className={cn(
            "continuum-fullscreen-dialog relative z-10 flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-white/10 dark:bg-gpt-sidebar",
            isClosingFullscreen
              ? "continuum-fullscreen-exit"
              : "continuum-fullscreen-enter",
          )}
        >
          <div className="continuum-fullscreen-content-enter flex h-full min-h-0 flex-col">
            {panelBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      ref={panelRef}
      aria-label={t("mindMapTitle")}
      data-testid="mind-map-docked-panel"
      style={{ width: `${panelWidth}px` }}
      className="continuum-docked-enter continuum-mind-map-dock absolute inset-0 z-30 flex flex-col bg-white max-xl:w-auto! xl:relative xl:inset-auto xl:z-20 xl:h-full xl:shrink-0 xl:border-s xl:border-gray-200/80 dark:bg-gpt-sidebar dark:xl:border-white/10"
    >
      {/* Desktop Interactive Resize Handle (Drag wider / narrower + Tactile Grip Pill & Brand Line) */}
      <div
        role="separator"
        tabIndex={0}
        data-testid="mind-map-resize-handle"
        aria-orientation="vertical"
        aria-label={t("resizeMindMapAriaLabel")}
        aria-valuemin={AI_CHAT_MIND_MAP_MIN_WIDTH}
        aria-valuemax={AI_CHAT_MIND_MAP_MAX_WIDTH}
        aria-valuenow={panelWidth}
        onPointerDown={handleResizePointerDown}
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={() => commitPanelWidth(AI_CHAT_MIND_MAP_DEFAULT_WIDTH)}
        onKeyDown={handleResizeKeyDown}
        className="group/resizer absolute inset-y-0 -start-1.5 z-40 hidden w-3 cursor-col-resize touch-none select-none focus:outline-none xl:flex xl:items-center xl:justify-center"
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 start-1/2 -ms-px w-0.5 transition-colors duration-150",
            isResizing
              ? "bg-brand-500"
              : "bg-transparent group-hover/resizer:bg-brand-500/85 group-focus-visible/resizer:bg-brand-500",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none relative z-10 flex h-9 w-3 items-center justify-center gap-0.5 rounded-full border shadow-theme-xs transition-all duration-150",
            isResizing
              ? "scale-105 border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-brand-500/25"
              : "border-gray-200/90 bg-white group-hover/resizer:scale-105 group-hover/resizer:border-brand-300 group-hover/resizer:bg-brand-50 group-focus-visible/resizer:border-brand-500 dark:border-white/15 dark:bg-gpt-popover dark:group-hover/resizer:border-brand-400/50 dark:group-hover/resizer:bg-brand-500/20",
          )}
        >
          <span
            className={cn(
              "h-3.5 w-px rounded-full transition-colors",
              isResizing
                ? "bg-brand-600 dark:bg-brand-200"
                : "bg-gray-300 group-hover/resizer:bg-brand-500 dark:bg-gray-500 dark:group-hover/resizer:bg-brand-300",
            )}
          />
          <span
            className={cn(
              "h-3.5 w-px rounded-full transition-colors",
              isResizing
                ? "bg-brand-600 dark:bg-brand-200"
                : "bg-gray-300 group-hover/resizer:bg-brand-500 dark:bg-gray-500 dark:group-hover/resizer:bg-brand-300",
            )}
          />
        </div>
      </div>

      {panelBody}
    </section>
  );
}
