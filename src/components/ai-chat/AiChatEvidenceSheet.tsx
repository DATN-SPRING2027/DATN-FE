"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckLineIcon,
  ChevronRightIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  MindMapIcon,
} from "@/icons";
import type { AiChatCitation } from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import type { InspectedEvidence } from "./AiChatMessageList";
import { isContinuumDocumentId } from "./citation-utils";

export type AiChatEvidenceSheetProps = Readonly<{
  evidence: InspectedEvidence | null;
  projectId: string;
  sessionPreviewText?: string;
  onClose: () => void;
}>;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "have",
  "will",
  "when",
  "where",
  "what",
  "which",
  "project",
  "document",
  "documents",
  "section",
  "overview",
  "summary",
  "trong",
  "những",
  "được",
  "theo",
  "tổng",
  "quan",
  "phần",
  "mục",
  "của",
  "các",
  "cho",
  "với",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSectionBreadcrumbs(heading: string): string[] {
  const parts = heading
    .split(/\s*>\s*|\s+\/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [heading.trim()];
}

function deriveMorphologicalPattern(word: string): string | null {
  const lower = word.toLowerCase();
  if (!/^[a-z]{6,}$/.test(lower) || STOP_WORDS.has(lower)) {
    return null;
  }
  if (lower.endsWith("cation") && lower.length >= 8) {
    const base = escapeRegExp(lower.slice(0, -6));
    return `\\b(?:${base}c|${base}k)[a-z]*\\b`;
  }
  const suffixes = [
    "ation",
    "ition",
    "tion",
    "sion",
    "ment",
    "ness",
    "ship",
    "able",
    "ible",
    "ing",
    "ed",
    "es",
    "s",
  ];
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix) && lower.length - suffix.length >= 5) {
      const stem = escapeRegExp(lower.slice(0, -suffix.length));
      return `\\b${stem}[a-z]*\\b`;
    }
  }
  return null;
}

function buildHighlightRegex(
  focusTerms: readonly string[] | undefined,
  heading: string | undefined,
): RegExp | null {
  const exactCandidates = new Set<string>();
  const stemPatterns = new Set<string>();

  const registerPhrase = (raw: string | undefined) => {
    if (!raw) return;
    const cleaned = raw
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/^\d+(?:\.\d+)*[.)]?\s*/, "")
      .trim();
    if (cleaned.length >= 3) {
      exactCandidates.add(cleaned);
    }
    for (const token of cleaned.split(/[\s,;:()/\\|–—-]+/)) {
      const word = token.trim();
      if (word.length >= 4 && !STOP_WORDS.has(word.toLowerCase())) {
        exactCandidates.add(word);
        const morphPattern = deriveMorphologicalPattern(word);
        if (morphPattern) {
          stemPatterns.add(morphPattern);
        }
      }
    }
  };

  for (const term of focusTerms ?? []) {
    registerPhrase(term);
  }

  if (heading) {
    const segments = splitSectionBreadcrumbs(heading);
    const leaf = segments[segments.length - 1];
    registerPhrase(leaf);
  }

  if (exactCandidates.size === 0 && stemPatterns.size === 0) return null;

  const sortedExact = [...exactCandidates]
    .sort((a, b) => b.length - a.length)
    .slice(0, 10)
    .map(escapeRegExp);

  const combined = [...sortedExact, ...[...stemPatterns].slice(0, 6)];
  if (combined.length === 0) return null;
  return new RegExp(`(${combined.join("|")})`, "gi");
}

function renderTextWithHighlights(
  text: string,
  highlightRegex: RegExp | null,
  keyPrefix: string,
): ReactNode {
  if (!highlightRegex || !text) {
    return text;
  }
  const parts = text.split(highlightRegex);
  if (parts.length <= 1) {
    return text;
  }
  return parts.map((part, idx) => {
    if (!part) return null;
    if (idx % 2 === 1) {
      return (
        <mark
          key={`${keyPrefix}-hl-${idx}`}
          data-testid="evidence-highlight-mark"
          className="rounded-sm bg-brand-100/90 px-1 py-0.5 font-semibold text-brand-900 ring-1 ring-brand-300/60 dark:bg-brand-500/25 dark:text-brand-100 dark:ring-brand-400/35"
        >
          {part}
        </mark>
      );
    }
    return <Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</Fragment>;
  });
}

function renderRichInline(
  line: string,
  highlightRegex: RegExp | null,
  keyPrefix: string,
): ReactNode {
  const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  if (tokens.length === 1 && !tokens[0]!.startsWith("`") && !tokens[0]!.startsWith("**")) {
    // Check for clean "Term: description" lead-in
    const colonMatch = /^([A-Za-zÀ-ỹ0-9_[\]()/ -]{2,34}):(\s+.*)$/.exec(line);
    if (colonMatch && !line.includes("://")) {
      const [, label, rest] = colonMatch;
      return (
        <>
          <strong className="font-semibold text-gray-950 dark:text-white">
            {renderTextWithHighlights(label!, highlightRegex, `${keyPrefix}-k`)}:
          </strong>
          {renderTextWithHighlights(rest!, highlightRegex, `${keyPrefix}-v`)}
        </>
      );
    }
    return renderTextWithHighlights(line, highlightRegex, keyPrefix);
  }

  return tokens.map((token, idx) => {
    const tokenKey = `${keyPrefix}-${idx}`;
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={tokenKey}
          data-testid="evidence-code-pill"
          className="font-mono inline-flex items-center rounded-md border border-brand-200/80 bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/15 dark:text-brand-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong
          key={tokenKey}
          className="font-bold text-gray-950 dark:text-white"
        >
          {renderTextWithHighlights(
            token.slice(2, -2),
            highlightRegex,
            `${tokenKey}-b`,
          )}
        </strong>
      );
    }
    return (
      <Fragment key={tokenKey}>
        {renderTextWithHighlights(token, highlightRegex, tokenKey)}
      </Fragment>
    );
  });
}

function FormattedExcerptBody({
  text,
  highlightRegex,
  leafHeading,
}: {
  text: string;
  highlightRegex: RegExp | null;
  leafHeading?: string;
}) {
  const rawLines = text.split(/\r?\n/);
  const normalizedLeaf = leafHeading?.trim().toLowerCase();

  // Single-line plain snippet without markdown/highlights stays a single <p>
  if (
    rawLines.length === 1 &&
    !highlightRegex &&
    !/(`[^`]+`|\*\*[^*]+\*\*|^\s*[-*•]\s+|^\s*#{1,6}\s+)/.test(text)
  ) {
    return (
      <p className="text-xs leading-relaxed text-gray-800 sm:text-sm dark:text-gray-100">
        {text}
      </p>
    );
  }

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-gray-800 sm:text-sm dark:text-gray-200">
      {rawLines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={`sp-${idx}`} className="h-1" aria-hidden="true" />;
        }

        const headingMatch = /^#{1,6}\s+(.*)$/.exec(trimmed);
        if (
          headingMatch ||
          (idx === 0 &&
            normalizedLeaf &&
            trimmed.toLowerCase() === normalizedLeaf)
        ) {
          const headingText = headingMatch ? headingMatch[1]! : trimmed;
          return (
            <div
              key={`hd-${idx}`}
              className="mb-1 flex items-center gap-2 border-b border-gray-200/70 pb-1.5 font-bold text-gray-950 dark:border-white/10 dark:text-white"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-1 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
              />
              <span>
                {renderTextWithHighlights(
                  headingText,
                  highlightRegex,
                  `hd-${idx}`,
                )}
              </span>
            </div>
          );
        }

        const bulletMatch = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(trimmed);
        if (bulletMatch) {
          return (
            <div
              key={`li-${idx}`}
              className="flex items-start gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/90 dark:hover:bg-white/5"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
              />
              <div className="min-w-0 flex-1 break-words">
                {renderRichInline(bulletMatch[1]!, highlightRegex, `li-${idx}`)}
              </div>
            </div>
          );
        }

        return (
          <p key={`p-${idx}`} className="break-words">
            {renderRichInline(trimmed, highlightRegex, `p-${idx}`)}
          </p>
        );
      })}
    </div>
  );
}

function prefersSmoothMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  );
}

export default function AiChatEvidenceSheet({
  evidence,
  projectId,
  sessionPreviewText,
  onClose,
}: AiChatEvidenceSheetProps) {
  const t = useTranslations("AiChat");
  const closeTimerRef = useRef<number | null>(null);

  const [prevEvidence, setPrevEvidence] = useState(evidence);
  const [selectedCitationNum, setSelectedCitationNum] = useState<number | null>(
    evidence?.kind === "document" ? evidence.citation.number : null,
  );
  const [isClosing, setIsClosing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (prevEvidence !== evidence) {
    setPrevEvidence(evidence);
    setIsClosing(false);
    setCopiedKey(null);
    setSelectedCitationNum(
      evidence?.kind === "document" ? evidence.citation.number : null,
    );
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (!prefersSmoothMotion()) {
      onClose();
      return;
    }
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 165);
  }, [isClosing, onClose]);

  const activeDocumentCitation: AiChatCitation | null = useMemo(() => {
    if (!evidence || evidence.kind !== "document") return null;
    if (
      evidence.relatedCitations &&
      evidence.relatedCitations.length > 0 &&
      selectedCitationNum !== null
    ) {
      return (
        evidence.relatedCitations.find(
          (item) => item.number === selectedCitationNum,
        ) ?? evidence.citation
      );
    }
    return evidence.citation;
  }, [evidence, selectedCitationNum]);

  const sectionBreadcrumbs = useMemo(() => {
    if (!activeDocumentCitation?.heading) return [];
    return splitSectionBreadcrumbs(activeDocumentCitation.heading);
  }, [activeDocumentCitation]);

  const highlightRegex = useMemo(() => {
    if (!evidence || evidence.kind !== "document") return null;
    return buildHighlightRegex(
      evidence.focusTerms,
      activeDocumentCitation?.heading,
    );
  }, [activeDocumentCitation, evidence]);

  const copyPayload =
    evidence?.kind === "document"
      ? (activeDocumentCitation?.snippet ?? "")
      : (sessionPreviewText ?? "");
  const activeCopyId =
    evidence?.kind === "document"
      ? `doc-${activeDocumentCitation?.number ?? 0}`
      : `sess-${evidence?.sessionCitation.ref ?? ""}`;
  const isCopied = copiedKey === activeCopyId;

  const handleCopyExcerpt = useCallback(async () => {
    if (!copyPayload || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopiedKey(activeCopyId);
    } catch {
      // Clipboard blocked in restricted context; ignore silently.
    }
  }, [activeCopyId, copyPayload]);

  if (!evidence) {
    return null;
  }

  const relatedCitations =
    evidence.kind === "document" ? (evidence.relatedCitations ?? []) : [];
  const leafHeading =
    sectionBreadcrumbs.length > 0
      ? sectionBreadcrumbs[sectionBreadcrumbs.length - 1]
      : undefined;

  return (
    <div className="fixed inset-0 z-999999 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("closeDialog")}
        onClick={handleRequestClose}
        className={cn(
          "fixed inset-0 bg-gray-950/60 backdrop-blur-sm",
          isClosing ? "continuum-backdrop-exit" : "continuum-backdrop-enter",
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("citationDialogAriaLabel")}
        data-testid="ai-chat-evidence-sheet"
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-gray-200/90 bg-white shadow-theme-xl sm:rounded-3xl dark:border-white/12 dark:bg-gpt-popover",
          isClosing ? "continuum-sheet-exit" : "continuum-sheet-enter",
        )}
      >
        {/* Top Pull-Up Handle Accent */}
        <div
          aria-hidden="true"
          className="flex shrink-0 justify-center pt-2.5 pb-1"
        >
          <span className="h-1 w-10 rounded-full bg-gray-300/85 dark:bg-white/18" />
        </div>

        {/* Multi-Source Tab Bar (when node has 2+ supporting citations) */}
        {relatedCitations.length > 1 && (
          <div
            role="tablist"
            aria-label={t("evidenceSourceSwitcherAria")}
            className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-gray-100 px-5 pt-1 pb-2.5 dark:border-white/10"
          >
            {relatedCitations.map((item) => {
              const isSelected = activeDocumentCitation?.number === item.number;
              const shortTitle =
                item.documentName ?? item.sourceName ?? item.documentId;
              return (
                <button
                  key={item.number}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`evidence-tab-${item.number}`}
                  onClick={() => setSelectedCitationNum(item.number)}
                  className={cn(
                    "inline-flex max-w-52 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all tabular-nums",
                    isSelected
                      ? "border-brand-300 bg-brand-50 text-brand-700 shadow-theme-xs dark:border-brand-400/40 dark:bg-brand-500/20 dark:text-brand-200"
                      : "border-gray-200/80 bg-gray-50/80 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
                  )}
                >
                  <span>[{item.number}]</span>
                  <span className="truncate font-medium">{shortTitle}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200/80 px-5 pt-2 pb-3.5 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-xl px-2.5 py-1 text-xs font-bold ring-1 tabular-nums",
                  evidence.kind === "document"
                    ? "bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
                    : "bg-warning-50 text-warning-800 ring-warning-200/80 dark:bg-warning-500/20 dark:text-warning-300 dark:ring-warning-400/30",
                )}
              >
                [
                {evidence.kind === "document" && activeDocumentCitation
                  ? activeDocumentCitation.number
                  : evidence.kind === "session"
                    ? evidence.sessionCitation.ref
                    : ""}
                ]
              </span>

              <h3 className="truncate text-sm font-bold text-gray-950 sm:text-base dark:text-white">
                {evidence.kind === "document" && activeDocumentCitation
                  ? (activeDocumentCitation.documentName ??
                    activeDocumentCitation.sourceName ??
                    activeDocumentCitation.documentId)
                  : evidence.kind === "session"
                    ? evidence.sessionCitation.source === "selected_group"
                      ? t("sessionSelectedGroup")
                      : t("sessionRecentContinuity")
                    : ""}
              </h3>
            </div>

            {/* Metadata Pills Row */}
            {evidence.kind === "document" && activeDocumentCitation && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 font-semibold text-success-700 ring-1 ring-success-200/80 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30">
                  <CheckCircleIcon aria-hidden="true" className="size-3.5" />
                  <span>{t("evidenceVerifiedBadge")}</span>
                </span>

                {activeDocumentCitation.versionNo !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    <DocsIcon aria-hidden="true" className="size-3" />
                    <span>
                      {t("versionBadge", {
                        version: activeDocumentCitation.versionNo,
                      })}
                    </span>
                  </span>
                )}

                {activeDocumentCitation.pageFrom && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    {activeDocumentCitation.pageTo &&
                    activeDocumentCitation.pageTo !==
                      activeDocumentCitation.pageFrom
                      ? t("pageRangeLabel", {
                          from: activeDocumentCitation.pageFrom,
                          to: activeDocumentCitation.pageTo,
                        })
                      : t("pageSingleLabel", {
                          page: activeDocumentCitation.pageFrom,
                        })}
                  </span>
                )}

                {evidence.focusLabel && (
                  <span className="inline-flex max-w-60 items-center gap-1 rounded-full bg-brand-50/90 px-2.5 py-0.5 font-semibold text-brand-700 ring-1 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/25">
                    <MindMapIcon aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate">
                      {t("evidenceFocusContextLabel", {
                        label: evidence.focusLabel,
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label={t("closeDialog")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        {evidence.kind === "document" && activeDocumentCitation ? (
          <div
            key={activeDocumentCitation.number}
            className="continuum-stagger-1 min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4"
          >
            {sectionBreadcrumbs.length > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  {t("excerptHeadingLabel")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                  {sectionBreadcrumbs.map((segment, idx) => {
                    const isLeaf = idx === sectionBreadcrumbs.length - 1;
                    return (
                      <span
                        key={`${segment}-${idx}`}
                        className="inline-flex max-w-full items-center gap-1"
                      >
                        {idx > 0 && (
                          <ChevronRightIcon
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-gray-400 rtl:rotate-180"
                          />
                        )}
                        <span
                          className={cn(
                            "truncate",
                            isLeaf
                              ? "rounded-lg bg-brand-50 px-2 py-0.5 font-bold text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
                              : "font-medium text-gray-600 dark:text-gray-300",
                          )}
                        >
                          {segment}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  {t("excerptContentLabel")}
                </p>

                {activeDocumentCitation.snippet && (
                  <button
                    type="button"
                    data-testid="evidence-copy-excerpt"
                    onClick={() => void handleCopyExcerpt()}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {isCopied ? (
                      <>
                        <CheckLineIcon
                          aria-hidden="true"
                          className="size-3.5 text-success-600 dark:text-success-400"
                        />
                        <span className="font-semibold text-success-700 dark:text-success-300">
                          {t("evidenceCopiedExcerpt")}
                        </span>
                      </>
                    ) : (
                      <>
                        <CopyIcon aria-hidden="true" className="size-3.5" />
                        <span>{t("evidenceCopyExcerpt")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="mt-1.5 rounded-2xl border border-gray-200/90 border-s-4 border-s-brand-500 bg-gray-50/85 p-4 shadow-theme-xs dark:border-white/10 dark:border-s-brand-400 dark:bg-gpt-sidebar/90">
                {activeDocumentCitation.snippet ? (
                  <FormattedExcerptBody
                    text={activeDocumentCitation.snippet}
                    highlightRegex={highlightRegex}
                    leafHeading={leafHeading}
                  />
                ) : (
                  <p className="text-xs text-gray-500 italic dark:text-gray-400">
                    {t("excerptNoSnippet")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : evidence.kind === "session" ? (
          <div className="continuum-stagger-1 min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4 text-xs">
            <div>
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {t("excerptContentLabel")}
              </p>
              <div className="mt-1.5 rounded-2xl border border-warning-300/60 border-s-4 border-s-warning-500 bg-warning-50/50 p-4 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 sm:text-sm dark:border-warning-500/25 dark:border-s-warning-400 dark:bg-gpt-sidebar dark:text-gray-200">
                {sessionPreviewText}
              </div>
            </div>

            {evidence.sessionCitation.turnIds.length > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  {t("turnReferenceIdsLabel")}
                </p>
                <p className="font-mono mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {evidence.sessionCitation.turnIds.join(", ")}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200/80 bg-gray-50/70 px-5 py-3 dark:border-white/10 dark:bg-gpt-sidebar/60">
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/12 dark:bg-gpt-popover dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t("evidenceCloseAction")}
          </button>

          {evidence.kind === "document" &&
            activeDocumentCitation &&
            isContinuumDocumentId(activeDocumentCitation.documentId) && (
              <Link
                href={`/projects/${encodeURIComponent(
                  projectId,
                )}/documents/${encodeURIComponent(
                  activeDocumentCitation.documentId,
                )}`}
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white shadow-theme-xs transition-all hover:bg-brand-700 active:scale-98 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <span>{t("openDocumentLink")}</span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 rtl:rotate-180"
                />
              </Link>
            )}
        </div>
      </div>
    </div>
  );
}
