"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  ChatIcon,
  CloseLineIcon,
  DocsIcon,
  InfoIcon,
  LockIcon,
  MaximizeIcon,
  MindMapIcon,
  MinimizeIcon,
  RefreshIcon,
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
import {
  buildBranchDeepDivePrompt,
  computeMindMapLayout,
  createAllExpandedIds,
  createDefaultExpandedIds,
  type PositionedMindMapNode,
} from "./mind-map-layout";

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

function findNodeAnywhere(
  node: AiChatMindMapNode | null,
  targetId: string | null,
  ancestors: readonly string[] = [],
  depth = 0,
): PositionedMindMapNode | null {
  if (!node || !targetId) return null;
  if (node.id === targetId) {
    return {
      node,
      depth,
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
  for (const child of node.children) {
    const found = findNodeAnywhere(child, targetId, nextAncestors, depth + 1);
    if (found) return found;
  }
  return null;
}

export default function AiChatMindMapPanel({
  isOpen,
  userId,
  organizationId,
  projectId,
  projectName,
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
  const [topicValidationError, setTopicValidationError] = useState<
    string | null
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { mindMap, isGenerating, error, isError, resetError, generate } =
    useAiMindMap({
      userId,
      organizationId,
      projectId,
      topic: activeTopic,
    });

  const autoRequestedScopeRef = useRef<string | null>(null);
  const scopeKey = `${userId}:${organizationId}:${projectId}`;

  useEffect(() => {
    if (!isOpen || !userId || !organizationId || !projectId) return;
    if (activeTopic !== "") return;
    if (mindMap || isGenerating) {
      autoRequestedScopeRef.current = scopeKey;
      return;
    }
    if (autoRequestedScopeRef.current === scopeKey) return;
    autoRequestedScopeRef.current = scopeKey;
    void generate("").catch(() => undefined);
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

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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

  const selectedNodeCitations = useMemo(() => {
    if (!selectedPositionedNode) return [];
    const items: AiChatCitation[] = [];
    for (const num of selectedPositionedNode.node.citationNumbers) {
      const match = citationsByNumber.get(num);
      if (match) items.push(match);
    }
    return items;
  }, [citationsByNumber, selectedPositionedNode]);

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
      if (normalized.length > AI_MIND_MAP_MAX_TOPIC_LENGTH) {
        setTopicValidationError(
          t("mindMapTopicValidationLength", {
            max: AI_MIND_MAP_MAX_TOPIC_LENGTH,
          }),
        );
        return;
      }
      setTopicValidationError(null);
      setActiveTopic(normalized);
      void generate(normalized).catch(() => undefined);
    },
    [generate, t, topicInput],
  );

  const handleResetOverview = useCallback(() => {
    setTopicInput("");
    setTopicValidationError(null);
    setActiveTopic("");
    resetError();
    void generate("").catch(() => undefined);
  }, [generate, resetError]);

  const handleRetry = useCallback(() => {
    setTopicValidationError(null);
    void generate(activeTopic).catch(() => undefined);
  }, [activeTopic, generate]);

  const handleAskInChat = useCallback(() => {
    if (!selectedPositionedNode) return;
    const prompt = buildBranchDeepDivePrompt(
      selectedPositionedNode,
      promptLocale,
    );
    if (isFullscreen) {
      setIsFullscreen(false);
    }
    onAskBranch(prompt);
  }, [isFullscreen, onAskBranch, promptLocale, selectedPositionedNode]);

  if (!isOpen) {
    return null;
  }

  const isAccessDenied = isError && isAccessOrResourceUnavailableError(error);
  const isServerFailure = isError && !isAccessDenied;
  const coverage = mindMap?.coverage;

  const panelBody = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gpt-sidebar">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200/80 px-4 py-3 dark:border-white/10">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <MindMapIcon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {t("mindMapTitle")}
              </h2>
              <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-300">
                {t("mindMapStudioBadge")}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
              {t("mindMapSubtitle", { project: projectName })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="mind-map-fullscreen-toggle"
            onClick={() => setIsFullscreen((prev) => !prev)}
            aria-label={
              isFullscreen
                ? t("mindMapExitFullscreen")
                : t("mindMapOpenFullscreen")
            }
            className="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {isFullscreen ? (
              <MinimizeIcon aria-hidden="true" className="size-4" />
            ) : (
              <MaximizeIcon aria-hidden="true" className="size-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFullscreen(false);
              onClose();
            }}
            aria-label={t("mindMapClosePanel")}
            className="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* Topic Focus Form */}
      <form
        onSubmit={handleSubmitTopic}
        noValidate
        className="shrink-0 border-b border-gray-200/80 bg-gray-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-gpt-canvas/60"
      >
        <div className="flex items-center gap-2">
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
            className={cn(
              "h-8.5 min-w-0 flex-1 rounded-xl border bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none dark:bg-gpt-composer dark:text-gray-100 dark:placeholder:text-gray-500",
              topicValidationError
                ? "border-error-500 focus:border-error-500"
                : "border-gray-200 focus:border-brand-500 dark:border-white/10 dark:focus:border-brand-400",
            )}
          />
          {activeTopic && (
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleResetOverview}
              className="inline-flex h-8.5 shrink-0 items-center rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t("mindMapResetOverviewCta")}
            </button>
          )}
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <RefreshIcon
              aria-hidden="true"
              className={cn("size-3.5", isGenerating && "animate-spin")}
            />
            <span>
              {isGenerating
                ? t("mindMapGeneratingCta")
                : mindMap && normalizeMindMapTopic(topicInput) === activeTopic
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

      {/* Main Content Area: 8 Explicit States */}
      {isGenerating ? (
        <div
          role="status"
          data-testid="mind-map-loading-state"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <div className="flex w-full max-w-sm items-center justify-center gap-6">
            <div className="h-14 w-36 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/20" />
            <div className="flex flex-col gap-2.5">
              <div className="h-10 w-36 animate-pulse rounded-xl bg-gray-200 dark:bg-white/10" />
              <div className="h-10 w-40 animate-pulse rounded-xl bg-gray-200/80 dark:bg-white/8" />
              <div className="h-10 w-32 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/6" />
            </div>
          </div>
          <div className="max-w-xs space-y-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("mindMapLoadingTitle")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("mindMapLoadingBody")}
            </p>
          </div>
        </div>
      ) : isAccessDenied ? (
        <div
          role="alert"
          data-testid="mind-map-permission-error"
          className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300">
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
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
          >
            <RefreshIcon aria-hidden="true" className="size-3.5" />
            <span>{t("retryAction")}</span>
          </button>
        </div>
      ) : isServerFailure ? (
        <div
          role="alert"
          data-testid="mind-map-server-error"
          className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
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
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <RefreshIcon aria-hidden="true" className="size-3.5" />
            <span>{t("retryAction")}</span>
          </button>
        </div>
      ) : !mindMap || mindMap.status === "empty" || !layout ? (
        <div
          data-testid="mind-map-empty-state"
          className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center"
        >
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-gray-300">
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
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-600 hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-popover dark:text-brand-300 dark:hover:bg-white/10"
          >
            <span>{t("manageDocumentsCta")}</span>
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Coverage & Fallback Strip */}
          <div className="shrink-0 space-y-2 border-b border-gray-200/80 px-4 py-2 text-xs dark:border-white/10">
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700 dark:bg-white/8 dark:text-gray-200">
                {mindMap.topic
                  ? t("mindMapTopicActiveBadge", { topic: mindMap.topic })
                  : t("mindMapOverviewBadge")}
              </span>
              {coverage && (
                <>
                  <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 font-medium text-success-700 dark:bg-success-500/15 dark:text-success-300">
                    {t("mindMapCoverageUsed", {
                      used: coverage.usedDocumentCount,
                      total: coverage.accessibleReadyDocumentCount,
                    })}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-white/8 dark:text-gray-300">
                    {t("mindMapCoverageEvidence", {
                      count: coverage.evidenceUnitCount,
                    })}
                  </span>
                  {coverage.omittedDocumentCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 font-medium text-warning-800 dark:bg-warning-500/15 dark:text-warning-300">
                      {t("mindMapCoverageOmitted", {
                        count: coverage.omittedDocumentCount,
                      })}
                    </span>
                  )}
                  {coverage.pendingDocumentCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-blue-light-50 px-2 py-0.5 font-medium text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-300">
                      {t("mindMapCoveragePending", {
                        count: coverage.pendingDocumentCount,
                      })}
                    </span>
                  )}
                </>
              )}
            </div>

            {mindMap.generationMode === "outline_fallback" && (
              <div
                data-testid="mind-map-fallback-badge"
                className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-200"
              >
                <AlertIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning-600 dark:text-warning-300"
                />
                <div className="min-w-0">
                  <p className="font-semibold">{t("mindMapFallbackBadge")}</p>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    {t("mindMapFallbackDesc")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Interactive SVG Canvas + Selected Node Inspector */}
          <div
            className={cn(
              "flex min-h-0 flex-1",
              isFullscreen ? "flex-col lg:flex-row" : "flex-col",
            )}
          >
            <AiChatMindMapCanvas
              key={isFullscreen ? "fullscreen" : "docked"}
              layout={layout}
              selectedNodeId={selectedPositionedNode?.node.id ?? null}
              isFullscreen={isFullscreen}
              onSelectNode={handleSelectNode}
              onToggleNode={handleToggleNode}
              onExpandAll={handleExpandAll}
              onCollapseDefault={handleCollapseDefault}
            />

            {/* Selected Node Detail & Source Verification Inspector */}
            {selectedPositionedNode && (
              <aside
                className={cn(
                  "flex shrink-0 flex-col justify-between gap-3 overflow-y-auto bg-white p-4 dark:bg-gpt-sidebar",
                  isFullscreen
                    ? "max-h-72 border-t border-gray-200/80 lg:max-h-none lg:w-92 lg:border-s lg:border-t-0 dark:border-white/10"
                    : "max-h-64 border-t border-gray-200/80 dark:border-white/10",
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-300">
                        {t("mindMapInspectorBadge")}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedPositionedNode.node.label}
                      </h3>
                    </div>

                    <button
                      type="button"
                      data-testid="mind-map-ask-branch"
                      onClick={handleAskInChat}
                      title={
                        isChatBusy ? t("mindMapAskInChatBusyHint") : undefined
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                    >
                      <ChatIcon aria-hidden="true" className="size-3.5" />
                      <span>{t("mindMapAskInChatCta")}</span>
                    </button>
                  </div>

                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                    {selectedPositionedNode.node.summary ||
                      t("mindMapNodeSummaryEmpty")}
                  </p>

                  <div>
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                      {t("mindMapNodeCitationsHeading")}
                    </p>
                    {selectedNodeCitations.length === 0 ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("mindMapNodeNoCitations")}
                      </p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {selectedNodeCitations.map((citation) => (
                          <button
                            key={citation.number}
                            type="button"
                            data-testid={`mind-map-citation-${citation.number}`}
                            onClick={() =>
                              onInspectEvidence({
                                kind: "document",
                                citation,
                              })
                            }
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1 text-start text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                          >
                            <span className="font-semibold tabular-nums">
                              [{citation.number}]
                            </span>
                            <span className="max-w-44 truncate">
                              {citation.documentName ??
                                citation.sourceName ??
                                citation.documentId}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-1.5 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <InfoIcon
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-gray-400 dark:text-gray-500"
                  />
                  <span>{t("mindMapHonestyNote")}</span>
                </div>
              </aside>
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
          onClick={() => setIsFullscreen(false)}
          className="fixed inset-0 bg-gray-950/70 backdrop-blur-xs"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("mindMapTitle")}
          data-testid="mind-map-fullscreen-dialog"
          className="relative z-10 flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-white/10 dark:bg-gpt-sidebar"
        >
          {panelBody}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={t("mindMapTitle")}
      data-testid="mind-map-docked-panel"
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-white xl:static xl:z-auto xl:h-full xl:w-[408px] xl:shrink-0 xl:border-s xl:border-gray-200/80 2xl:w-[468px] dark:bg-gpt-sidebar dark:xl:border-white/10"
    >
      {panelBody}
    </section>
  );
}
