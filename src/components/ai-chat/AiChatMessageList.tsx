"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckLineIcon,
  CopyIcon,
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
import {
  isContinuumDocumentId,
  resolveSessionCitationPreview,
  tokenizeTextWithCitations,
  type CitationItemToken,
} from "./citation-utils";

import AiChatActivityProgress from "./AiChatActivityProgress";

// Canonical SAG abstention marker used by history responses predating answerStatus.
const SAG_NO_ANSWER_TEXT =
  "The available knowledge base does not contain enough traceable evidence to answer this question.";

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
  projectId: string;
  mode: "chat" | "work";
  messages: readonly DisplayAiChatMessage[];
  isLoadingMessages: boolean;
  isMessagesError: boolean;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
  highlightedTurnId: string | null;
  onLoadOlder: () => void;
  onRetryMessages: () => void;
  onRetryTurn: (query: string) => void;
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

function isGfmTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(line);
}

function splitGfmTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function parseGfmColumnAlignments(
  separatorLine: string,
): Array<"text-start" | "text-center" | "text-end"> {
  return splitGfmTableRow(separatorLine).map((col) => {
    const marker = col.trim();
    if (marker.startsWith(":") && marker.endsWith(":")) return "text-center";
    if (marker.endsWith(":")) return "text-end";
    return "text-start";
  });
}

function resolveLocalizedErrorMessage(
  errorCode: string | undefined,
  errorMessage: string | undefined,
  translate: (key: string) => string,
): string {
  switch (errorCode) {
    case "SEARCH_UNAVAILABLE":
      return translate("errorSearchUnavailable");
    case "LLM_TIMEOUT":
      return translate("errorLlmTimeout");
    case "LLM_RATE_LIMIT":
      return translate("errorLlmRateLimit");
    case "LLM_UNAVAILABLE":
      return translate("errorLlmUnavailable");
    case "CONFIGURATION_ERROR":
      return translate("errorConfiguration");
    case "STREAM_INTERRUPTED":
      return translate("errorStreamInterrupted");
    case "STREAM_ERROR":
      return translate("streamFailedDefault");
    default:
      return errorMessage ?? translate("streamFailedDefault");
  }
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

  const renderNonTableLines = (lines: string[], keyPrefix: string) => {
    const joined = lines.join("\n").trim();
    if (!joined) return null;

    if (lines.every((line) => /^[-*•]\s+/.test(line.trim()))) {
      return (
        <ul key={`ul-${keyPrefix}`} className="list-disc space-y-1.5 ps-5">
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

    if (lines.every((line) => /^\d+[.)]\s+/.test(line.trim()))) {
      const startMatch = lines[0]?.trim().match(/^(\d+)[.)]\s+/);
      const startNum = startMatch ? Number.parseInt(startMatch[1], 10) : 1;
      return (
        <ol
          key={`ol-${keyPrefix}`}
          start={startNum > 1 ? startNum : undefined}
          className="list-decimal space-y-1.5 ps-5"
        >
          {lines.map((line, lineIdx) => (
            <li key={lineIdx}>
              {renderInlineWithCitations(
                line.trim().replace(/^\d+[.)]\s+/, ""),
                citations,
                sessionCitations,
                citationJumpAria,
                onClickToken,
              )}
            </li>
          ))}
        </ol>
      );
    }

    if (lines.length === 1 && /^#{1,3}\s+/.test(joined)) {
      const headingText = joined.replace(/^#{1,3}\s+/, "");
      return (
        <h4
          key={`h-${keyPrefix}`}
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
      <p key={`p-${keyPrefix}`} className="whitespace-pre-wrap">
        {renderInlineWithCitations(
          joined,
          citations,
          sessionCitations,
          citationJumpAria,
          onClickToken,
        )}
      </p>
    );
  };

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

          const sepIdx = lines.findIndex(
            (line, idx) =>
              idx >= 1 &&
              isGfmTableSeparator(line) &&
              lines[idx - 1]?.includes("|"),
          );

          if (sepIdx >= 1) {
            const headerIdx = sepIdx - 1;
            const beforeLines = lines.slice(0, headerIdx);
            const alignments = parseGfmColumnAlignments(lines[sepIdx] ?? "");
            const headers = splitGfmTableRow(lines[headerIdx] ?? "");
            let tableEnd = sepIdx + 1;
            while (
              tableEnd < lines.length &&
              lines[tableEnd]?.trim().includes("|")
            ) {
              tableEnd += 1;
            }
            const bodyRows = lines
              .slice(sepIdx + 1, tableEnd)
              .map(splitGfmTableRow);
            const afterLines = lines.slice(tableEnd);
            const keyBase = `${blockIdx}-${paraIdx}`;

            return (
              <Fragment key={`tbl-wrap-${keyBase}`}>
                {beforeLines.length > 0 &&
                  renderNonTableLines(beforeLines, `${keyBase}-pre`)}
                <div className="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-white/10">
                  <table className="w-full border-collapse text-xs leading-5 tabular-nums">
                    <thead className="border-b border-gray-200/80 bg-gray-50/90 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                      <tr>
                        {headers.map((headerCell, colIdx) => (
                          <th
                            key={`th-${colIdx}`}
                            scope="col"
                            className={cn(
                              "px-3 py-2 font-semibold",
                              alignments[colIdx] ?? "text-start",
                            )}
                          >
                            {renderInlineWithCitations(
                              headerCell,
                              citations,
                              sessionCitations,
                              citationJumpAria,
                              onClickToken,
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/70 dark:divide-white/10">
                      {bodyRows.map((rowCells, rowIdx) => (
                        <tr
                          key={`tr-${rowIdx}`}
                          className="bg-white/60 transition-colors hover:bg-gray-50/70 dark:bg-transparent dark:hover:bg-white/5"
                        >
                          {headers.map((_h, colIdx) => (
                            <td
                              key={`td-${rowIdx}-${colIdx}`}
                              className={cn(
                                "px-3 py-2 align-top text-gray-700 dark:text-gray-200",
                                alignments[colIdx] ?? "text-start",
                              )}
                            >
                              {renderInlineWithCitations(
                                rowCells[colIdx] ?? "",
                                citations,
                                sessionCitations,
                                citationJumpAria,
                                onClickToken,
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {afterLines.length > 0 &&
                  renderNonTableLines(afterLines, `${keyBase}-post`)}
              </Fragment>
            );
          }

          return renderNonTableLines(lines, `${blockIdx}-${paraIdx}`);
        });
      })}
    </div>
  );
}

export default function AiChatMessageList({
  projectId,
  mode,
  messages,
  isLoadingMessages,
  isMessagesError,
  hasOlderMessages,
  isLoadingOlder,
  highlightedTurnId,
  onLoadOlder,
  onRetryMessages,
  onRetryTurn,
  onInspectEvidence,
  onJumpToTurn,
}: AiChatMessageListProps) {
  const t = useTranslations("AiChat");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesById = new Map(messages.map((item) => [item.id, item]));

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (messages.length > prevCountRef.current || lastMessage?.isStreaming) {
      const container = scrollContainerRef.current;
      container?.scrollTo?.({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  const handleCopy = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(messageId);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === messageId ? null : prev));
      }, 1800);
    } catch {
      // Clipboard may be restricted in headless contexts.
    }
  };

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div
        role="status"
        aria-label={t("messagesLoading")}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-8"
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
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10">
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
    <div
      ref={scrollContainerRef}
      data-ai-chat-scroll-region
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
    >
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

        {messages.map((message, index) => {
          const isHighlighted = highlightedTurnId === message.id;

          if (message.role === "user") {
            return (
              <div
                key={message.id}
                id={`ai-chat-turn-${message.id}`}
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
                  {message.content}
                </div>
              </div>
            );
          }

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
          const isNoAnswer =
            message.status === "ok" &&
            !message.isStreaming &&
            (message.answerStatus === "no_answer" ||
              (message.answerStatus === undefined &&
                message.citations.length === 0 &&
                message.sessionCitations.length === 0 &&
                message.content.trim() === SAG_NO_ANSWER_TEXT));
          const effectiveRetryQuery = (() => {
            if (message.retryQuery?.trim()) return message.retryQuery.trim();
            if (message.status !== "failed" && message.status !== "cancelled") {
              return undefined;
            }
            for (let prevIdx = index - 1; prevIdx >= 0; prevIdx -= 1) {
              const prevMsg = messages[prevIdx];
              if (prevMsg?.role === "user" && prevMsg.content.trim()) {
                return prevMsg.content.trim();
              }
            }
            return undefined;
          })();

          return (
            <article
              key={message.id}
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
              ) : isNoAnswer ? (
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {t("noAnswerNotice")}
                </p>
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

              {/* Failed Error Banner with Retry */}
              {message.status === "failed" && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
                >
                  <div className="flex items-center gap-2">
                    <AlertIcon aria-hidden="true" className="size-4 shrink-0" />
                    <span>
                      {resolveLocalizedErrorMessage(
                        message.errorCode,
                        message.errorMessage,
                        (key) => t(key as Parameters<typeof t>[0]),
                      )}
                    </span>
                  </div>
                  {effectiveRetryQuery && (
                    <button
                      type="button"
                      onClick={() => onRetryTurn(effectiveRetryQuery)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-error-700 ring-1 ring-error-200 hover:bg-error-50 dark:bg-gpt-composer dark:text-error-300 dark:ring-error-700"
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

              {/* Minimal ChatGPT Message Action Bar */}
              {!message.isStreaming &&
                (Boolean(message.content) ||
                  (message.status === "cancelled" &&
                    Boolean(effectiveRetryQuery))) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {message.content && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            message.id,
                            isNoAnswer ? t("noAnswerNotice") : message.content,
                          )
                        }
                        aria-label={t("copyAnswer")}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        {copiedId === message.id ? (
                          <>
                            <CheckLineIcon
                              aria-hidden="true"
                              className="size-3.5 text-success-500"
                            />
                            <span>{t("copiedAnswer")}</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon aria-hidden="true" className="size-3.5" />
                            <span>{t("copyAnswer")}</span>
                          </>
                        )}
                      </button>
                    )}
                    {message.status === "cancelled" && effectiveRetryQuery && (
                      <button
                        type="button"
                        onClick={() => onRetryTurn(effectiveRetryQuery)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-gpt-composer dark:text-gray-200 dark:hover:bg-white/10"
                      >
                        <span>{t("retryTurn")}</span>
                      </button>
                    )}
                  </div>
                )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
