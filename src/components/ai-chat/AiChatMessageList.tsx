"use client";

import {
  Fragment,
  memo,
  useCallback,
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
  BranchIcon,
  DocsIcon,
  ShootingStarIcon,
  TimeIcon,
} from "@/icons";
import type {
  AiChatCitation,
  AiChatMessage,
  AiChatSessionCitation,
  AiChatThread,
} from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import AiChatActivityProgress from "./AiChatActivityProgress";
import AiChatAnswerActionBar from "./AiChatAnswerActionBar";
import {
  groupAnswerVersions,
  isPersistedMessageId,
} from "./answer-action-utils";
import {
  buildProjectCitationHref,
  isContinuumDocumentId,
  parseContinuumCitationTarget,
  resolveSessionCitationPreview,
  tokenizeTextWithCitations,
  type CitationItemToken,
} from "./citation-utils";
import {
  useLocalSpeech,
  type LocalSpeechErrorKind,
} from "./useLocalSpeech";

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
  | Readonly<{
      kind: "document";
      citation: AiChatCitation;
      focusLabel?: string;
      focusTerms?: readonly string[];
      relatedCitations?: readonly AiChatCitation[];
    }>
  | Readonly<{ kind: "session"; sessionCitation: AiChatSessionCitation }>;

export interface AiChatMessageListProps {
  organizationId?: string;
  projectId: string;
  projectName?: string;
  threadId?: string | null;
  activeThread?: AiChatThread | null;
  branchingMessageId?: string | null;
  mode: "chat" | "work";
  messages: readonly DisplayAiChatMessage[];
  isThreadStreaming?: boolean;
  isLoadingMessages: boolean;
  isMessagesError: boolean;
  hasOlderMessages: boolean;
  isLoadingOlder: boolean;
  highlightedTurnId: string | null;
  onLoadOlder: () => void;
  onRetryMessages: () => void;
  onRetryTurn: (query: string) => void;
  onRegenerateMessage?: (
    targetMessage: DisplayAiChatMessage,
    questionMessage?: DisplayAiChatMessage,
  ) => void;
  onBranchFromMessage?: (targetMessage: DisplayAiChatMessage) => void;
  onSaveAnswerToTaskNote?: (
    targetMessage: AiChatMessage,
    questionText: string,
    threadId: string,
  ) => void;
  onSelectParentThread?: (parentThreadId: string) => void;
  onInspectEvidence: (evidence: InspectedEvidence) => void;
  onJumpToTurn: (turnId: string, fallback: AiChatSessionCitation) => void;
}

function BranchLineageDivider({
  parentThreadId,
  parentThreadTitle,
  untitledFallback,
  branchedFromLabel,
  branchedFromAria,
  deletedChatLabel,
  onSelectParentThread,
}: {
  parentThreadId: string | null | undefined;
  parentThreadTitle: string | null | undefined;
  untitledFallback: string;
  branchedFromLabel: (title: string) => string;
  branchedFromAria: (title: string) => string;
  deletedChatLabel: string;
  onSelectParentThread?: (parentThreadId: string) => void;
}) {
  const effectiveTitle = parentThreadTitle?.trim() || untitledFallback;
  const canNavigateToParent =
    Boolean(parentThreadId) && Boolean(onSelectParentThread);

  return (
    <div
      data-testid="ai-chat-branch-divider"
      className="flex items-center gap-3 py-1"
    >
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gray-200/80 dark:bg-white/10"
      />
      {canNavigateToParent && parentThreadId && onSelectParentThread ? (
        <button
          type="button"
          onClick={() => onSelectParentThread(parentThreadId)}
          aria-label={branchedFromAria(effectiveTitle)}
          title={branchedFromLabel(effectiveTitle)}
          className="inline-flex max-w-[min(26rem,calc(100%-2rem))] min-w-0 items-center gap-1.5 rounded-full border border-gray-200/90 bg-gray-50/90 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300 dark:hover:border-brand-400/40 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
        >
          <BranchIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-brand-500 dark:text-brand-400"
          />
          <span className="truncate">{branchedFromLabel(effectiveTitle)}</span>
        </button>
      ) : (
        <div
          role="note"
          className="inline-flex max-w-[min(26rem,calc(100%-2rem))] min-w-0 items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50/70 px-3 py-1 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-gpt-sidebar/80 dark:text-gray-400"
        >
          <BranchIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-gray-400 dark:text-gray-500"
          />
          <span className="truncate">{deletedChatLabel}</span>
        </div>
      )}
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gray-200/80 dark:bg-white/10"
      />
    </div>
  );
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

const EMPTY_SESSION_PREVIEWS: readonly string[] = [];

const FormattedAnswerProse = memo(function FormattedAnswerProse({
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
    const elements: ReactNode[] = [];
    let idx = 0;
    let segIdx = 0;

    const isHrLine = (line: string) =>
      /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
    const headingMatch = (line: string) =>
      line.trim().match(/^(#{1,6})\s+(.+)$/);
    const ulMatch = (line: string) => line.match(/^(\s*)[-*•]\s+(.+)$/);
    const olMatch = (line: string) => line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);

    while (idx < lines.length) {
      const current = lines[idx] ?? "";
      if (!current.trim()) {
        idx += 1;
        continue;
      }

      if (isHrLine(current)) {
        elements.push(
          <hr
            key={`hr-${keyPrefix}-${segIdx}`}
            className="my-2 border-gray-200/80 dark:border-white/10"
          />,
        );
        idx += 1;
        segIdx += 1;
        continue;
      }

      const hMatch = headingMatch(current);
      if (hMatch) {
        const level = hMatch[1]?.length ?? 3;
        const headingText = hMatch[2] ?? "";
        const HeadingTag = level >= 4 ? "h5" : "h4";
        elements.push(
          <HeadingTag
            key={`h-${keyPrefix}-${segIdx}`}
            className={
              level >= 4
                ? "pt-1 text-sm font-semibold text-gray-900 dark:text-white"
                : "pt-1 text-base font-semibold text-gray-900 dark:text-white"
            }
          >
            {renderInlineWithCitations(
              headingText,
              citations,
              sessionCitations,
              citationJumpAria,
              onClickToken,
            )}
          </HeadingTag>,
        );
        idx += 1;
        segIdx += 1;
        continue;
      }

      if (ulMatch(current)) {
        const items: Array<{ indent: number; text: string }> = [];
        while (idx < lines.length) {
          const matched = ulMatch(lines[idx] ?? "");
          if (!matched) break;
          items.push({
            indent: (matched[1] ?? "").length,
            text: matched[2] ?? "",
          });
          idx += 1;
        }
        elements.push(
          <ul
            key={`ul-${keyPrefix}-${segIdx}`}
            className="list-disc space-y-1.5 ps-5"
          >
            {items.map((item, lineIdx) => (
              <li
                key={lineIdx}
                className={item.indent >= 2 ? "ms-5 list-[circle]" : undefined}
              >
                {renderInlineWithCitations(
                  item.text,
                  citations,
                  sessionCitations,
                  citationJumpAria,
                  onClickToken,
                )}
              </li>
            ))}
          </ul>,
        );
        segIdx += 1;
        continue;
      }

      if (olMatch(current)) {
        const items: Array<{ num: number; indent: number; text: string }> = [];
        while (idx < lines.length) {
          const matched = olMatch(lines[idx] ?? "");
          if (!matched) break;
          items.push({
            indent: (matched[1] ?? "").length,
            num: Number.parseInt(matched[2] ?? "1", 10),
            text: matched[3] ?? "",
          });
          idx += 1;
        }
        const startNum = items[0]?.num ?? 1;
        elements.push(
          <ol
            key={`ol-${keyPrefix}-${segIdx}`}
            start={startNum > 1 ? startNum : undefined}
            className="list-decimal space-y-1.5 ps-5"
          >
            {items.map((item, lineIdx) => (
              <li
                key={lineIdx}
                className={item.indent >= 2 ? "ms-5" : undefined}
              >
                {renderInlineWithCitations(
                  item.text,
                  citations,
                  sessionCitations,
                  citationJumpAria,
                  onClickToken,
                )}
              </li>
            ))}
          </ol>,
        );
        segIdx += 1;
        continue;
      }

      const paragraphLines: string[] = [];
      while (idx < lines.length) {
        const line = lines[idx] ?? "";
        if (
          !line.trim() ||
          isHrLine(line) ||
          headingMatch(line) ||
          ulMatch(line) ||
          olMatch(line)
        ) {
          break;
        }
        paragraphLines.push(line);
        idx += 1;
      }
      const joined = paragraphLines.join("\n").trim();
      if (joined) {
        elements.push(
          <p
            key={`p-${keyPrefix}-${segIdx}`}
            className="whitespace-pre-wrap"
          >
            {renderInlineWithCitations(
              joined,
              citations,
              sessionCitations,
              citationJumpAria,
              onClickToken,
            )}
          </p>,
        );
        segIdx += 1;
      }
    }

    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0];
    return <Fragment key={`seg-${keyPrefix}`}>{elements}</Fragment>;
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
});

const UserTurnItem = memo(function UserTurnItem({
  message,
  isHighlighted,
  highlightedNotice,
}: {
  message: DisplayAiChatMessage;
  isHighlighted: boolean;
  highlightedNotice: string;
}) {
  return (
    <div
      id={`ai-chat-turn-${message.id}`}
      className={cn(
        "flex flex-col items-end rounded-3xl transition-all",
        isHighlighted &&
          "ring-2 ring-warning-400 ring-offset-4 dark:ring-offset-gpt-canvas",
      )}
    >
      {isHighlighted && (
        <span className="mb-1 text-xs font-semibold text-warning-600 dark:text-warning-400">
          {highlightedNotice}
        </span>
      )}
      <div className="max-w-4/5 rounded-3xl bg-gray-100 px-4 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap text-gray-900 dark:bg-gpt-bubble dark:text-gray-100">
        {message.content}
      </div>
    </div>
  );
});

interface AssistantTurnItemProps {
  groupKey: string;
  message: DisplayAiChatMessage;
  versions: readonly DisplayAiChatMessage[];
  activeVersionIndex: number;
  questionMessage?: DisplayAiChatMessage;
  organizationId: string;
  projectId: string;
  projectName: string;
  threadId: string | null;
  mode: "chat" | "work";
  isThreadStreaming: boolean;
  isHighlighted: boolean;
  isBranching: boolean;
  isSpeaking: boolean;
  speechError: LocalSpeechErrorKind | null;
  sessionPreviews: readonly string[];
  onRetryTurn: (query: string) => void;
  onRegenerateMessage?: (
    targetMessage: DisplayAiChatMessage,
    questionMessage?: DisplayAiChatMessage,
  ) => void;
  onBranchFromMessage?: (targetMessage: DisplayAiChatMessage) => void;
  onSaveAnswerToTaskNote?: (
    targetMessage: AiChatMessage,
    questionText: string,
    threadId: string,
  ) => void;
  onInspectEvidence: (evidence: InspectedEvidence) => void;
  onJumpToTurn: (turnId: string, fallback: AiChatSessionCitation) => void;
  onStopSpeech: () => void;
  onToggleSpeak: (messageId: string, content: string) => void;
  onSelectVersionIndex: (
    groupKey: string,
    nextIdx: number,
    versionCount: number,
  ) => void;
}

function areAssistantTurnPropsEqual(
  prev: AssistantTurnItemProps,
  next: AssistantTurnItemProps,
): boolean {
  if (
    prev.groupKey !== next.groupKey ||
    prev.message !== next.message ||
    prev.activeVersionIndex !== next.activeVersionIndex ||
    prev.questionMessage !== next.questionMessage ||
    prev.organizationId !== next.organizationId ||
    prev.projectId !== next.projectId ||
    prev.projectName !== next.projectName ||
    prev.threadId !== next.threadId ||
    prev.mode !== next.mode ||
    prev.isThreadStreaming !== next.isThreadStreaming ||
    prev.isHighlighted !== next.isHighlighted ||
    prev.isBranching !== next.isBranching ||
    prev.isSpeaking !== next.isSpeaking ||
    prev.speechError !== next.speechError ||
    prev.onRetryTurn !== next.onRetryTurn ||
    prev.onRegenerateMessage !== next.onRegenerateMessage ||
    prev.onBranchFromMessage !== next.onBranchFromMessage ||
    prev.onSaveAnswerToTaskNote !== next.onSaveAnswerToTaskNote ||
    prev.onInspectEvidence !== next.onInspectEvidence ||
    prev.onJumpToTurn !== next.onJumpToTurn ||
    prev.onStopSpeech !== next.onStopSpeech ||
    prev.onToggleSpeak !== next.onToggleSpeak ||
    prev.onSelectVersionIndex !== next.onSelectVersionIndex
  ) {
    return false;
  }
  if (prev.versions.length !== next.versions.length) {
    return false;
  }
  for (let i = 0; i < prev.versions.length; i += 1) {
    if (prev.versions[i] !== next.versions[i]) {
      return false;
    }
  }
  if (prev.sessionPreviews.length !== next.sessionPreviews.length) {
    return false;
  }
  for (let i = 0; i < prev.sessionPreviews.length; i += 1) {
    if (prev.sessionPreviews[i] !== next.sessionPreviews[i]) {
      return false;
    }
  }
  return true;
}

const AssistantTurnItem = memo(function AssistantTurnItem({
  groupKey,
  message,
  versions,
  activeVersionIndex,
  questionMessage,
  organizationId,
  projectId,
  projectName,
  threadId,
  mode,
  isThreadStreaming,
  isHighlighted,
  isBranching,
  isSpeaking,
  speechError,
  sessionPreviews,
  onRetryTurn,
  onRegenerateMessage,
  onBranchFromMessage,
  onSaveAnswerToTaskNote,
  onInspectEvidence,
  onJumpToTurn,
  onStopSpeech,
  onToggleSpeak,
  onSelectVersionIndex,
}: AssistantTurnItemProps) {
  const t = useTranslations("AiChat");
  const versionCount = versions.length;

  const citationJumpAria = useCallback(
    (label: string) => t("citationJumpAria", { label }),
    [t],
  );

  const handleTokenClick = useCallback(
    (item: CitationItemToken) => {
      if (item.type === "document") {
        const found = message.citations.find(
          (cit) => cit.number === item.number,
        );
        if (found) {
          onInspectEvidence({
            kind: "document",
            citation: found,
            relatedCitations: message.citations,
            focusTerms: questionMessage?.content
              ? [questionMessage.content]
              : undefined,
          });
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
    },
    [
      message.citations,
      message.sessionCitations,
      onInspectEvidence,
      onJumpToTurn,
      questionMessage,
    ],
  );

  const handleOpenTurnSources = useCallback(() => {
    if (message.citations.length > 0) {
      onInspectEvidence({
        kind: "document",
        citation: message.citations[0]!,
        relatedCitations: message.citations,
        focusTerms: questionMessage?.content
          ? [questionMessage.content]
          : undefined,
      });
      return;
    }
    if (message.sessionCitations.length > 0) {
      onInspectEvidence({
        kind: "session",
        sessionCitation: message.sessionCitations[0]!,
      });
    }
  }, [
    message.citations,
    message.sessionCitations,
    onInspectEvidence,
    questionMessage,
  ]);

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
    return questionMessage?.content?.trim() || undefined;
  })();

  // Inherited prefix messages are immutable in-place; users can branch from them instead.
  const canRegenerateTurn =
    !message.isInherited &&
    ((Boolean(onRegenerateMessage) && isPersistedMessageId(message.id)) ||
      Boolean(effectiveRetryQuery));

  const handleTriggerRegenerate = useCallback(() => {
    onStopSpeech();
    if (onRegenerateMessage && isPersistedMessageId(message.id)) {
      onRegenerateMessage(message, questionMessage);
    } else if (effectiveRetryQuery) {
      onRetryTurn(effectiveRetryQuery);
    }
  }, [
    effectiveRetryQuery,
    message,
    onRegenerateMessage,
    onRetryTurn,
    onStopSpeech,
    questionMessage,
  ]);

  const effectiveDisplayMessage = useMemo(
    () => (isNoAnswer ? { ...message, content: t("noAnswerNotice") } : message),
    [isNoAnswer, message, t],
  );

  return (
    <article
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
                href={
                  projectId === "all"
                    ? "/projects"
                    : `/projects/${encodeURIComponent(projectId)}/documents`
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-composer dark:text-brand-300 dark:hover:bg-white/10"
              >
                <span>{t("manageDocumentsCta")}</span>
                <ArrowRightIcon aria-hidden="true" className="size-3.5" />
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
            citationJumpAria={citationJumpAria}
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
                cit.pageFrom && cit.pageTo && cit.pageFrom !== cit.pageTo
                  ? t("pageRangeLabel", {
                      from: cit.pageFrom,
                      to: cit.pageTo,
                    })
                  : cit.pageFrom
                    ? t("pageSingleLabel", { page: cit.pageFrom })
                    : null;
              const parsedCitation = parseContinuumCitationTarget(cit);
              const targetProjectId =
                cit.projectId && isContinuumDocumentId(cit.projectId)
                  ? cit.projectId
                  : projectId !== "all"
                    ? projectId
                    : null;
              const canDeepLink = Boolean(
                targetProjectId && parsedCitation.entityId,
              );

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
                          relatedCitations: message.citations,
                          focusTerms: questionMessage?.content
                            ? [questionMessage.content]
                            : undefined,
                        })
                      }
                      className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {t("previewExcerptAction")}
                    </button>

                    {canDeepLink &&
                      targetProjectId &&
                      parsedCitation.entityId && (
                        <Link
                          href={buildProjectCitationHref(
                            targetProjectId,
                            parsedCitation.entityId,
                            parsedCitation.sourceKind,
                          )}
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
            {message.sessionCitations.map((sc, scIdx) => {
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
                      {sessionPreviews[scIdx] ?? sc.summaryExcerpt}
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

      {/* Answer Action Bar (Copy, Like/Dislike, Read Aloud, Share, Try Again, More Actions & Version Switcher) */}
      {!message.isStreaming &&
        !isEmptyEvidenceScope &&
        (message.status !== "failed" ||
          Boolean(message.content) ||
          versionCount > 1) && (
          <AiChatAnswerActionBar
            organizationId={organizationId}
            projectId={projectId}
            projectName={projectName}
            threadId={threadId}
            message={effectiveDisplayMessage}
            questionText={questionMessage?.content ?? ""}
            versionIndex={activeVersionIndex}
            versionCount={versionCount}
            isThreadStreaming={isThreadStreaming}
            isSpeaking={isSpeaking}
            speechError={speechError}
            canRegenerate={canRegenerateTurn && message.status !== "failed"}
            isBranching={isBranching}
            onSelectVersionIndex={(nextIdx) => {
              if (isSpeaking) {
                onStopSpeech();
              }
              onSelectVersionIndex(groupKey, nextIdx, versionCount);
            }}
            onRegenerate={handleTriggerRegenerate}
            onToggleSpeak={() =>
              void onToggleSpeak(message.id, effectiveDisplayMessage.content)
            }
            onOpenSources={
              message.citations.length > 0 ||
              message.sessionCitations.length > 0
                ? handleOpenTurnSources
                : undefined
            }
            onBranchInNewChat={
              onBranchFromMessage && isPersistedMessageId(message.id)
                ? () => {
                    onStopSpeech();
                    onBranchFromMessage(message);
                  }
                : undefined
            }
            onSaveToTaskNote={
              onSaveAnswerToTaskNote &&
              threadId &&
              isPersistedMessageId(message.id)
                ? () =>
                    onSaveAnswerToTaskNote(
                      effectiveDisplayMessage,
                      questionMessage?.content ?? "",
                      threadId,
                    )
                : undefined
            }
          />
        )}
    </article>
  );
}, areAssistantTurnPropsEqual);

const AiChatMessageList = memo(function AiChatMessageList({
  organizationId = "",
  projectId,
  projectName = "",
  threadId = null,
  activeThread = null,
  branchingMessageId = null,
  mode,
  messages,
  isThreadStreaming = false,
  isLoadingMessages,
  isMessagesError,
  hasOlderMessages,
  isLoadingOlder,
  highlightedTurnId,
  onLoadOlder,
  onRetryMessages,
  onRetryTurn,
  onRegenerateMessage,
  onBranchFromMessage,
  onSaveAnswerToTaskNote,
  onSelectParentThread,
  onInspectEvidence,
  onJumpToTurn,
}: AiChatMessageListProps) {
  const t = useTranslations("AiChat");
  const locale = useLocale();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);
  const lastScrollHeightRef = useRef<number>(0);

  const [selectedVersionIndexByGroup, setSelectedVersionIndexByGroup] =
    useState<
      Record<string, { selectedIndex: number; knownVersionCount: number }>
    >({});

  const {
    speakingMessageId,
    preparingMessageId,
    speechError,
    stopSpeech,
    toggleSpeak,
  } = useLocalSpeech(locale);

  useEffect(() => {
    stopSpeech();
  }, [projectId, stopSpeech, threadId]);

  const handleSelectVersionIndex = useCallback(
    (groupKey: string, nextIdx: number, versionCount: number) => {
      setSelectedVersionIndexByGroup((prev) => ({
        ...prev,
        [groupKey]: {
          selectedIndex: nextIdx,
          knownVersionCount: versionCount,
        },
      }));
    },
    [],
  );

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    lastScrollHeightRef.current = container.scrollHeight;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  const messagesById = useMemo(
    () => new Map(messages.map((item) => [item.id, item])),
    [messages],
  );
  const groupedTurns = useMemo(() => groupAnswerVersions(messages), [messages]);

  const branchPointMessageId = activeThread?.branchPointMessageId ?? null;
  const isBranchedThread = Boolean(
    activeThread?.isBranched || branchPointMessageId,
  );
  const branchDividerTurnIndex = useMemo(() => {
    if (!isBranchedThread || groupedTurns.length === 0) return null;
    if (branchPointMessageId) {
      const exactIdx = groupedTurns.findIndex((turn) =>
        turn.versions.some((ver) => ver.id === branchPointMessageId),
      );
      if (exactIdx >= 0) return exactIdx;
    }
    for (let idx = groupedTurns.length - 1; idx >= 0; idx -= 1) {
      if (groupedTurns[idx]?.versions.some((ver) => Boolean(ver.isInherited))) {
        return idx;
      }
    }
    return -1;
  }, [branchPointMessageId, groupedTurns, isBranchedThread]);

  const activeSpeechMessageId = speakingMessageId ?? preparingMessageId;
  useEffect(() => {
    if (!activeSpeechMessageId) return;
    const isStillActiveVersion = groupedTurns.some((turn) => {
      if (turn.message.role !== "assistant") return false;
      const versions = turn.versions ?? [turn.message];
      const saved = selectedVersionIndexByGroup[turn.groupKey];
      const idx =
        saved && saved.knownVersionCount === versions.length
          ? Math.min(Math.max(0, saved.selectedIndex), versions.length - 1)
          : versions.length - 1;
      return versions[idx]?.id === activeSpeechMessageId;
    });
    if (!isStillActiveVersion) {
      stopSpeech();
    }
  }, [
    activeSpeechMessageId,
    groupedTurns,
    selectedVersionIndexByGroup,
    stopSpeech,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const lastMessage = messages[messages.length - 1];
    const hasNewMessage = messages.length > prevCountRef.current;
    if (container && (hasNewMessage || lastMessage?.isStreaming)) {
      const prevScrollHeight = lastScrollHeightRef.current;
      const referenceScrollHeight =
        prevScrollHeight > 0
          ? Math.min(container.scrollHeight, prevScrollHeight)
          : container.scrollHeight;
      const distanceFromBottom =
        referenceScrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = isNearBottomRef.current && distanceFromBottom < 120;
      const isNewUserPrompt =
        hasNewMessage &&
        lastMessage?.role === "user" &&
        prevCountRef.current > 0;
      if (isNearBottom || isNewUserPrompt) {
        container.scrollTo?.({
          top: container.scrollHeight,
          behavior: "auto",
        });
        isNearBottomRef.current = true;
      }
      lastScrollHeightRef.current = container.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages]);

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

  const renderLineageDivider = () => (
    <BranchLineageDivider
      parentThreadId={activeThread?.parentThreadId}
      parentThreadTitle={activeThread?.parentThreadTitle}
      untitledFallback={t("untitledThreadFallback")}
      branchedFromLabel={(title) => t("branchedFromThread", { title })}
      branchedFromAria={(title) => t("branchedFromThreadAria", { title })}
      deletedChatLabel={t("branchedFromDeletedChat")}
      onSelectParentThread={onSelectParentThread}
    />
  );

  const highlightedNotice = t("turnHighlightedNotice");

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      data-ai-chat-scroll-region
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
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

        {isBranchedThread &&
          branchDividerTurnIndex === -1 &&
          renderLineageDivider()}

        {groupedTurns.map((turn, turnIndex) => {
          const isTurnBranchPoint = Boolean(
            isBranchedThread && turnIndex === branchDividerTurnIndex,
          );

          if (turn.message.role === "user") {
            const userMsg = turn.message;
            const isHighlighted = highlightedTurnId === userMsg.id;
            return (
              <Fragment key={userMsg.id}>
                <UserTurnItem
                  message={userMsg}
                  isHighlighted={isHighlighted}
                  highlightedNotice={highlightedNotice}
                />
                {isTurnBranchPoint && renderLineageDivider()}
              </Fragment>
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
          const sessionPreviews =
            message.sessionCitations.length > 0
              ? message.sessionCitations.map((sc) =>
                  resolveSessionCitationPreview(sc, messagesById),
                )
              : EMPTY_SESSION_PREVIEWS;

          return (
            <Fragment key={turn.groupKey}>
              <AssistantTurnItem
                groupKey={turn.groupKey}
                message={message}
                versions={turn.versions}
                activeVersionIndex={activeVersionIndex}
                questionMessage={turn.questionMessage}
                organizationId={organizationId}
                projectId={projectId}
                projectName={projectName}
                threadId={threadId}
                mode={mode}
                isThreadStreaming={isThreadStreaming}
                isHighlighted={isHighlighted}
                isBranching={branchingMessageId === message.id}
                isSpeaking={
                  speakingMessageId === message.id ||
                  preparingMessageId === message.id
                }
                speechError={
                  speechError?.messageId === message.id
                    ? speechError.kind
                    : null
                }
                sessionPreviews={sessionPreviews}
                onRetryTurn={onRetryTurn}
                onRegenerateMessage={onRegenerateMessage}
                onBranchFromMessage={onBranchFromMessage}
                onSaveAnswerToTaskNote={onSaveAnswerToTaskNote}
                onInspectEvidence={onInspectEvidence}
                onJumpToTurn={onJumpToTurn}
                onStopSpeech={stopSpeech}
                onToggleSpeak={toggleSpeak}
                onSelectVersionIndex={handleSelectVersionIndex}
              />
              {isTurnBranchPoint && renderLineageDivider()}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
});

export default AiChatMessageList;
