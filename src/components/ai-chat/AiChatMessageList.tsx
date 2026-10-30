"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  DocsIcon,
  ShootingStarIcon,
  TimeIcon,
} from "@/icons";
import type {
  AiChatCitation,
  AiChatMessage,
  AiChatSessionCitation,
} from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import AiChatActivityProgress from "./AiChatActivityProgress";
import AiChatAnswerActionBar from "./AiChatAnswerActionBar";
import {
  groupAnswerVersions,
  isPersistedMessageId,
} from "./answer-action-utils";
import {
  isContinuumDocumentId,
  resolveSessionCitationPreview,
  tokenizeTextWithCitations,
  type CitationItemToken,
} from "./citation-utils";
import { useLocalSpeech } from "./useLocalSpeech";

export type DisplayAiChatMessage = AiChatMessage & {
  activityStartedAt?: number;
  activityFinishedAt?: number;
  isStreaming?: boolean;
  answerStatus?: "answered" | "no_answer";
  errorMessage?: string;
  retryQuery?: string;
};

export type InspectedEvidence =
  | Readonly<{ kind: "document"; citation: AiChatCitation }>
  | Readonly<{ kind: "session"; sessionCitation: AiChatSessionCitation }>;

export interface AiChatMessageListProps {
  organizationId: string;
  projectId: string;
  projectName: string;
  threadId: string | null;
  mode: "chat" | "work";
  messages: readonly DisplayAiChatMessage[];
  isThreadStreaming: boolean;
  isLoadingMessages: boolean;
  isMessagesError: boolean;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
  highlightedTurnId: string | null;
  onLoadOlder: () => void;
  onRetryMessages: () => void;
  onRetryTurn: (query: string) => void;
  onRegenerateMessage: (
    targetMessage: DisplayAiChatMessage,
    questionMessage?: DisplayAiChatMessage,
  ) => void;
  onInspectEvidence: (evidence: InspectedEvidence) => void;
  onJumpToTurn: (turnId: string, fallback: AiChatSessionCitation) => void;
}

function renderBoldAndCodeText(
  rawText: string,
  keyPrefix: string,
): ReactNode[] {
  const parts = rawText.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="font-mono rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-brand-600 dark:bg-white/10 dark:text-brand-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong
          key={key}
          className="font-semibold text-gray-900 dark:text-white"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function renderInlineWithCitations(
  line: string,
  citations: readonly AiChatCitation[],
  sessionCitations: readonly AiChatSessionCitation[],
  citationJumpAria: (label: string) => string,
  onClickToken: (item: CitationItemToken) => void,
): ReactNode {
  const tokens = tokenizeTextWithCitations(line);
  return tokens.map((token, idx) => {
    if (token.kind === "text") {
      return (
        <Fragment key={`txt-${idx}`}>
          {renderBoldAndCodeText(token.text, `seg-${idx}`)}
        </Fragment>
      );
    }
    return (
      <span
        key={`cit-${idx}`}
        className="mx-0.5 inline-flex flex-wrap items-center gap-1 align-baseline"
      >
        {token.items.map((item, subIdx) => {
          const isSession = item.type === "session";
          const matched = isSession
            ? sessionCitations.some((sc) => sc.ref === item.ref)
            : citations.some((c) => c.number === item.number);
          return (
            <button
              key={`${item.label}-${subIdx}`}
              type="button"
              onClick={() => onClickToken(item)}
              aria-label={citationJumpAria(item.label)}
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs leading-none font-semibold tabular-nums transition-colors",
                isSession
                  ? "bg-warning-500/15 text-warning-700 hover:bg-warning-500/25 dark:text-warning-300"
                  : matched
                    ? "bg-brand-500/15 text-brand-600 hover:bg-brand-500/25 dark:text-brand-300"
                    : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
              )}
            >
              [{item.label}]
            </button>
          );
        })}
      </span>
    );
  });
}

function FormattedAnswerProse({
  content,
  citations,
  sessionCitations,
  citationJumpAria,
  onClickToken,
}: {
  content: string;
  citations: readonly AiChatCitation[];
  sessionCitations: readonly AiChatSessionCitation[];
  citationJumpAria: (label: string) => string;
  onClickToken: (item: CitationItemToken) => void;
}) {
  const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-7 break-words text-gray-800 dark:text-gray-100">
      {blocks.map((block, blockIdx) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const stripped = block
            .slice(3, -3)
            .replace(/^[a-zA-Z0-9_-]+\r?\n/, "");
          return (
            <pre
              key={`code-${blockIdx}`}
              className="font-mono overflow-x-auto rounded-2xl border border-gray-200/80 bg-gray-950 p-4 text-xs leading-relaxed text-gray-100 dark:border-white/10 dark:bg-gpt-sidebar"
            >
              <code>{stripped}</code>
            </pre>
          );
        }

        const paragraphs = block.split(/\n{2,}/);
        return paragraphs.map((para, paraIdx) => {
          const trimmed = para.trim();
          if (!trimmed) return null;
          const lines = trimmed.split(/\r?\n/);

          if (lines.every((line) => /^[-*•]\s+/.test(line.trim()))) {
            return (
              <ul
                key={`ul-${blockIdx}-${paraIdx}`}
                className="list-disc space-y-1.5 ps-5"
              >
                {lines.map((line, lineIdx) => (
                  <li key={lineIdx}>
                    {renderInlineWithCitations(
                      line.trim().replace(/^[-*•]\s+/, ""),
                      citations,
                      sessionCitations,
                      citationJumpAria,
                      onClickToken,
                    )}
                  </li>
                ))}
              </ul>
            );
          }

          if (lines.length === 1 && /^#{1,3}\s+/.test(trimmed)) {
            const headingText = trimmed.replace(/^#{1,3}\s+/, "");
            return (
              <h4
                key={`h-${blockIdx}-${paraIdx}`}
                className="pt-1 text-base font-semibold text-gray-900 dark:text-white"
              >
                {renderInlineWithCitations(
                  headingText,
                  citations,
                  sessionCitations,
                  citationJumpAria,
                  onClickToken,
                )}
              </h4>
            );
          }

          return (
            <p key={`p-${blockIdx}-${paraIdx}`} className="whitespace-pre-wrap">
              {renderInlineWithCitations(
                trimmed,
                citations,
                sessionCitations,
                citationJumpAria,
                onClickToken,
              )}
            </p>
          );
        });
      })}
    </div>
  );
}

export default function AiChatMessageList({
  organizationId,
  projectId,
  projectName,
  threadId,
  mode,
  messages,
  isThreadStreaming,
  isLoadingMessages,
  isMessagesError,
  hasOlderMessages,
  isLoadingOlder,
  highlightedTurnId,
  onLoadOlder,
  onRetryMessages,
  onRetryTurn,
  onRegenerateMessage,
  onInspectEvidence,
  onJumpToTurn,
}: AiChatMessageListProps) {
  const t = useTranslations("AiChat");
  const locale = useLocale();
  const bottomEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);

  const [selectedVersionIndexByGroup, setSelectedVersionIndexByGroup] =
    useState<
      Record<string, { selectedIndex: number; knownVersionCount: number }>
    >({});

  const { speakingMessageId, speechError, stopSpeech, toggleSpeak } =
    useLocalSpeech(locale);

  useEffect(() => {
    stopSpeech();
  }, [projectId, stopSpeech, threadId]);

  const messagesById = useMemo(
    () => new Map(messages.map((item) => [item.id, item])),
    [messages],
  );
  const groupedTurns = useMemo(() => groupAnswerVersions(messages), [messages]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (messages.length > prevCountRef.current || lastMessage?.isStreaming) {
      bottomEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div
        role="status"
        aria-label={t("messagesLoading")}
        className="flex-1 overflow-y-auto px-4 py-8"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-3">
              <div className="ms-auto h-10 w-56 animate-pulse rounded-3xl bg-gray-100 dark:bg-gpt-bubble" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-gpt-sidebar" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isMessagesError && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-error-200 bg-error-50 p-5 text-center dark:border-error-800/60 dark:bg-error-500/10"
        >
          <div className="mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-full bg-error-100 text-error-600 dark:bg-error-500/20 dark:text-error-300">
            <AlertIcon aria-hidden="true" className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("messagesErrorTitle")}
          </h3>
          <button
            type="button"
            onClick={onRetryMessages}
            className="mt-4 inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            {t("retryAction")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-7">
        {hasOlderMessages && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={isLoadingOlder}
              aria-busy={isLoadingOlder}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300 dark:hover:bg-white/10"
            >
              <TimeIcon aria-hidden="true" className="size-3.5" />
              <span>
                {isLoadingOlder
                  ? t("loadingOlderMessages")
                  : t("loadOlderMessages")}
              </span>
            </button>
          </div>
        )}

        {groupedTurns.map((turn) => {
          if (turn.message.role === "user") {
            const userMsg = turn.message;
            const isHighlighted = highlightedTurnId === userMsg.id;
            return (
              <div
                key={userMsg.id}
                id={`ai-chat-turn-${userMsg.id}`}
                className={cn(
                  "flex flex-col items-end rounded-3xl transition-all",
                  isHighlighted &&
                    "ring-2 ring-warning-400 ring-offset-4 dark:ring-offset-gpt-canvas",
                )}
              >
                {isHighlighted && (
                  <span className="mb-1 text-xs font-semibold text-warning-600 dark:text-warning-400">
                    {t("turnHighlightedNotice")}
                  </span>
                )}
                <div className="max-w-4/5 rounded-3xl bg-gray-100 px-4 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap text-gray-900 dark:bg-gpt-bubble dark:text-gray-100">
                  {userMsg.content}
                </div>
              </div>
            );
          }

          const versionCount = turn.versions.length;
          const storedSelection = selectedVersionIndexByGroup[turn.groupKey];
          const activeVersionIndex =
            storedSelection &&
            storedSelection.knownVersionCount === versionCount &&
            storedSelection.selectedIndex >= 0 &&
            storedSelection.selectedIndex < versionCount
              ? storedSelection.selectedIndex
              : versionCount - 1;
          const message = turn.versions[activeVersionIndex] ?? turn.message;

          const isHighlighted = turn.versions.some(
            (ver) => ver.id === highlightedTurnId,
          );

          const handleTokenClick = (item: CitationItemToken) => {
            if (item.type === "document") {
              const found = message.citations.find(
                (cit) => cit.number === item.number,
              );
              if (found) {
                onInspectEvidence({ kind: "document", citation: found });
              }
            } else {
              const foundSession = message.sessionCitations.find(
                (sc) => sc.ref === item.ref,
              );
              if (foundSession) {
                const targetTurnId = foundSession.turnIds[0];
                if (targetTurnId) {
                  onJumpToTurn(targetTurnId, foundSession);
                } else {
                  onInspectEvidence({
                    kind: "session",
                    sessionCitation: foundSession,
                  });
                }
              }
            }
          };

          const isEmptyEvidenceScope =
            message.content.trim() ===
            "[Answer hidden because its evidence is unavailable in the current source scope.]";

          const canRegenerateTurn =
            isPersistedMessageId(message.id) || Boolean(message.retryQuery);

          const handleTriggerRegenerate = () => {
            stopSpeech();
            if (isPersistedMessageId(message.id)) {
              onRegenerateMessage(message, turn.questionMessage);
            } else if (message.retryQuery) {
              onRetryTurn(message.retryQuery);
            }
          };

          return (
            <article
              key={turn.groupKey}
              id={`ai-chat-turn-${message.id}`}
              aria-label={t("assistantRoleLabel")}
              className={cn(
                "space-y-3 rounded-2xl transition-all",
                isHighlighted &&
                  "p-2 ring-2 ring-warning-400 ring-offset-2 dark:ring-offset-gpt-canvas",
              )}
            >
              {/* Subtle ChatGPT "Thought / Searched" Top Pill Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">
                  <ShootingStarIcon aria-hidden="true" className="size-3" />
                  <span>{t("assistantRoleLabel")}</span>
                </span>

                {message.sessionCitations.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-warning-500/30 bg-warning-500/10 px-2.5 py-0.5 text-xs font-medium text-warning-700 tabular-nums dark:text-warning-300">
                    {t("ecceMemoryBadge", {
                      count: message.sessionCitations.length,
                    })}
                  </span>
                )}

                {message.status === "cancelled" && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {t("statusCancelled")}
                  </span>
                )}

                {message.status === "failed" && (
                  <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-xs font-medium text-error-700 dark:bg-error-500/15 dark:text-error-300">
                    {t("statusFailed")}
                  </span>
                )}
              </div>

              <AiChatActivityProgress
                isStreaming={Boolean(message.isStreaming)}
                hasContent={Boolean(message.content)}
                status={message.status}
                steps={message.retrievalSteps}
                startedAt={message.activityStartedAt}
                finishedAt={message.activityFinishedAt}
                defaultExpanded={mode === "work"}
              />

              {/* Borderless Answer Prose or Clean Empty-Evidence Scope Callout */}
              {isEmptyEvidenceScope ? (
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-gpt-sidebar">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
                      <DocsIcon aria-hidden="true" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                        {t("noEvidenceScopeTitle")}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                        {t("noEvidenceScopeBody")}
                      </p>
                      <Link
                        href={`/projects/${encodeURIComponent(
                          projectId,
                        )}/documents`}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-composer dark:text-brand-300 dark:hover:bg-white/10"
                      >
                        <span>{t("manageDocumentsCta")}</span>
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                message.content && (
                  <FormattedAnswerProse
                    content={message.content}
                    citations={message.citations}
                    sessionCitations={message.sessionCitations}
                    citationJumpAria={(label) =>
                      t("citationJumpAria", { label })
                    }
                    onClickToken={handleTokenClick}
                  />
                )
              )}

              {message.answerStatus === "no_answer" &&
                !isEmptyEvidenceScope && (
                  <p className="rounded-xl bg-gray-50 px-3.5 py-2 text-xs text-gray-600 dark:bg-gpt-sidebar dark:text-gray-300">
                    {t("noAnswerNotice")}
                  </p>
                )}

              {/* Failed Error Banner */}
              {message.status === "failed" && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
                >
                  <div className="flex items-center gap-2">
                    <AlertIcon aria-hidden="true" className="size-4 shrink-0" />
                    <span>
                      {message.errorMessage ?? t("streamFailedDefault")}
                    </span>
                  </div>
                  {canRegenerateTurn && (
                    <button
                      type="button"
                      disabled={isThreadStreaming}
                      onClick={handleTriggerRegenerate}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-error-700 ring-1 ring-error-200 hover:bg-error-50 disabled:opacity-50 dark:bg-gpt-composer dark:text-error-300 dark:ring-error-700"
                    >
                      {t("retryTurn")}
                    </button>
                  )}
                </div>
              )}

              {/* Verified Document Citations */}
              {message.citations.length > 0 && (
                <div className="pt-1">
                  <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase tabular-nums dark:text-gray-500">
                    {t("documentSourcesHeading", {
                      count: message.citations.length,
                    })}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {message.citations.map((cit) => {
                      const title =
                        cit.documentName ??
                        cit.sourceName ??
                        cit.label ??
                        cit.documentId;
                      const pageText =
                        cit.pageFrom &&
                        cit.pageTo &&
                        cit.pageFrom !== cit.pageTo
                          ? t("pageRangeLabel", {
                              from: cit.pageFrom,
                              to: cit.pageTo,
                            })
                          : cit.pageFrom
                            ? t("pageSingleLabel", { page: cit.pageFrom })
                            : null;
                      const canDeepLink = isContinuumDocumentId(cit.documentId);

                      return (
                        <div
                          key={`${cit.number}-${cit.sourceId}-${cit.documentId}`}
                          className="group flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 transition-all hover:border-brand-500/40 hover:bg-white dark:border-white/10 dark:bg-gpt-sidebar dark:hover:border-brand-400/40 dark:hover:bg-gpt-composer"
                        >
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="inline-flex shrink-0 items-center rounded-md bg-brand-500/15 px-1.5 py-0.5 text-xs font-bold text-brand-600 tabular-nums dark:text-brand-300">
                                  [{cit.number}]
                                </span>
                                <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                                  {title}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400 tabular-nums">
                                {cit.versionNo !== undefined && (
                                  <span>
                                    {t("versionBadge", {
                                      version: cit.versionNo,
                                    })}
                                  </span>
                                )}
                                {pageText && <span>{pageText}</span>}
                              </div>
                            </div>

                            {cit.snippet && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {cit.snippet}
                              </p>
                            )}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                onInspectEvidence({
                                  kind: "document",
                                  citation: cit,
                                })
                              }
                              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                            >
                              {t("previewExcerptAction")}
                            </button>

                            {canDeepLink && (
                              <Link
                                href={`/projects/${encodeURIComponent(
                                  projectId,
                                )}/documents/${encodeURIComponent(
                                  cit.documentId,
                                )}`}
                                className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                              >
                                <span>{t("openDocumentLink")}</span>
                                <ArrowRightIcon
                                  aria-hidden="true"
                                  className="size-3"
                                />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ECCE Session Memory Citations */}
              {message.sessionCitations.length > 0 && (
                <div className="pt-1">
                  <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase tabular-nums dark:text-gray-500">
                    {t("sessionMemoryHeading", {
                      count: message.sessionCitations.length,
                    })}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {message.sessionCitations.map((sc) => {
                      const firstTurnId = sc.turnIds[0];
                      return (
                        <div
                          key={sc.ref}
                          className="flex flex-col justify-between rounded-2xl border border-warning-500/25 bg-warning-50/40 p-3 dark:bg-gpt-sidebar"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-md bg-warning-500/20 px-1.5 py-0.5 text-xs font-bold text-warning-700 tabular-nums dark:text-warning-300">
                                [{sc.ref}]
                              </span>
                              <span className="text-xs font-medium text-warning-700 dark:text-warning-300">
                                {sc.source === "selected_group"
                                  ? t("sessionSelectedGroup")
                                  : t("sessionRecentContinuity")}
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                              {resolveSessionCitationPreview(sc, messagesById)}
                            </p>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                onInspectEvidence({
                                  kind: "session",
                                  sessionCitation: sc,
                                })
                              }
                              className="font-medium text-warning-700 hover:underline dark:text-warning-300"
                            >
                              {t("previewExcerptAction")}
                            </button>
                            {firstTurnId && (
                              <button
                                type="button"
                                onClick={() => onJumpToTurn(firstTurnId, sc)}
                                className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                              >
                                <span>{t("jumpToTurnAction")}</span>
                                <ArrowRightIcon
                                  aria-hidden="true"
                                  className="size-3"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Answer Action Bar (Copy, Like/Dislike, Read Aloud, Share, Try Again & Version Switcher) */}
              {!message.isStreaming && !isEmptyEvidenceScope && (
                <AiChatAnswerActionBar
                  organizationId={organizationId}
                  projectId={projectId}
                  projectName={projectName}
                  threadId={threadId}
                  message={message}
                  questionText={turn.questionMessage?.content ?? ""}
                  versionIndex={activeVersionIndex}
                  versionCount={versionCount}
                  isThreadStreaming={isThreadStreaming}
                  isSpeaking={speakingMessageId === message.id}
                  speechError={
                    speechError?.messageId === message.id
                      ? speechError.kind
                      : null
                  }
                  canRegenerate={canRegenerateTurn}
                  onSelectVersionIndex={(nextIdx) => {
                    if (speakingMessageId === message.id) {
                      stopSpeech();
                    }
                    setSelectedVersionIndexByGroup((prev) => ({
                      ...prev,
                      [turn.groupKey]: {
                        selectedIndex: nextIdx,
                        knownVersionCount: versionCount,
                      },
                    }));
                  }}
                  onRegenerate={handleTriggerRegenerate}
                  onToggleSpeak={() =>
                    void toggleSpeak(message.id, message.content)
                  }
                />
              )}
            </article>
          );
        })}

        <div ref={bottomEndRef} />
      </div>
    </div>
  );
}
