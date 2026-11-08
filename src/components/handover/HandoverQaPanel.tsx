"use client";

import { useState } from "react";
import HandoverAiCoverageWarning from "./HandoverAiCoverageWarning";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { ChatIcon, ChevronDownIcon, DocsIcon } from "@/icons";
import type {
  HandoverAnswerDto,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import { useAskHandoverQuestionMutation } from "@/lib/queries/handovers/useHandovers";
import {
  buildSourceWorkspaceHref,
  extractHandoverErrorMessage,
  formatShortId,
} from "./handover-ui.utils";

function parseAndCleanSectionText(
  rawText: string,
  fallbackTitle?: string,
): { title: string | null; body: string } {
  let text = rawText.trim();
  let extractedTitle: string | null = fallbackTitle ?? null;

  const bracketMatch = text.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (bracketMatch) {
    extractedTitle = bracketMatch[1].trim();
    text = bracketMatch[2].trim();
  }

  // Strip raw code-fence markers and noisy ASCII banner lines (====, ----)
  const cleaned = text
    .replace(/```[a-zA-Z0-9_-]*|'''[a-zA-Z0-9_-]*/g, " ")
    .replace(/[#\s]*={3,}[#\s]*/g, "\n")
    .replace(/[#\s]*-{4,}[#\s]*/g, "\n")
    .replace(/\s*#\s*(\d+\.\s+[^\n#]+?)\s*#/g, "\n• $1: ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: extractedTitle,
    body: cleaned || text,
  };
}

function formatSourceKindLabel(kind: string): string {
  switch (kind) {
    case "PROJECT_DOCUMENT":
      return "Document";
    case "TASK_NOTE":
      return "Task Note";
    case "WORK_REPORT":
      return "Work Report";
    case "KNOWLEDGE_OBJECT":
      return "Knowledge";
    default:
      return kind;
  }
}

export default function HandoverQaPanel({
  projectId,
  handover,
  sourceTitles,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
  sourceTitles?: Record<string, string>;
}) {
  const t = useTranslations("handover.qa");
  const t5 = useTranslations("handover.fiveStep");
  const askMutation = useAskHandoverQuestionMutation(projectId, handover.id);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<
    Array<{ q: string; a: HandoverAnswerDto }>
  >([]);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [localError, setLocalError] = useState<string | null>(null);

  if (!handover.publishedRevisionId) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("noRevisionNotice")}
        </p>
      </section>
    );
  }

  const submitQuestion = async (rawQuestion: string) => {
    setLocalError(null);
    const trimmed = rawQuestion.trim();
    if (!trimmed || !handover.publishedRevisionId) return;

    try {
      const res = await askMutation.mutateAsync({
        revisionId: handover.publishedRevisionId,
        assignmentVersion: handover.assignmentVersion,
        question: trimmed,
      });
      setHistory((prev) => [{ q: trimmed, a: res.data }, ...prev]);
      setQuestion("");
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Unable to answer question."),
      );
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuestion(question);
  };

  const starterPrompts = [
    t5("qaPrompt1"),
    t5("qaPrompt2"),
    t5("qaPrompt3"),
  ];

  const resolveSummaryMessage = (answer: HandoverAnswerDto): string => {
    if (
      answer.message ===
      "Answered from authorized published handover sources."
    ) {
      return t5("qaGroundedSummary", {
        count: String(answer.sections.length),
      });
    }
    if (
      answer.message ===
      "Insufficient grounded evidence in the authorized published handover sources."
    ) {
      return t5("qaInsufficientSummary");
    }
    return answer.message;
  };

  return (
    <div className="space-y-4">
      {/* Question Composer Card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/60 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
              <ChatIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("title")}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-400">
                {t("subtitle")}
              </p>
            </div>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              {t5("qaClearHistory")}
            </button>
          )}
        </div>

        {/* Quick Starter Prompts */}
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            {t5("qaQuickPromptsLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                disabled={askMutation.isPending}
                onClick={() => {
                  setQuestion(promptText);
                  void submitQuestion(promptText);
                }}
                className="cursor-pointer rounded-xl border border-brand-200/80 bg-brand-50/60 px-3 py-1.5 text-start text-xs font-medium text-brand-700 transition-all hover:border-brand-300 hover:bg-brand-100/70 disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAsk} className="mt-4 space-y-3">
          {localError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {localError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-300 bg-gray-50/40 transition-colors focus-within:border-brand-500 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-800/60 dark:focus-within:border-brand-400 dark:focus-within:bg-gray-800">
            <label htmlFor="handover-qa-input" className="sr-only">
              {t("questionLabel")}
            </label>
            <textarea
              id="handover-qa-input"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (question.trim() && !askMutation.isPending) {
                    void submitQuestion(question);
                  }
                }
              }}
              placeholder={t("questionPlaceholder")}
              className="w-full resize-none border-0 bg-transparent px-3.5 pt-3 pb-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-gray-500"
            />
            <div className="flex items-center justify-end px-3 pb-2.5">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!question.trim()}
                isLoading={askMutation.isPending}
              >
                {askMutation.isPending ? t("asking") : t("askCta")}
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* Answer Thread */}
      {history.map((entry, idx) => (
        <article
          key={`${idx}-${entry.q}`}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          {/* Question & Status Header */}
          <div className="border-b border-gray-100 bg-gray-50/70 px-5 py-3.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  Q
                </span>
                <p className="text-sm font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                  {entry.q}
                </p>
              </div>
              <Badge
                color={
                  entry.a.answerStatus === "ANSWERED" ? "success" : "warning"
                }
                size="sm"
              >
                {entry.a.answerStatus === "ANSWERED"
                  ? t("statusAnswered")
                  : t("statusInsufficient")}
              </Badge>
            </div>

            <p className="mt-1.5 ps-8.5 text-xs leading-5 text-gray-600 [overflow-wrap:anywhere] dark:text-gray-400">
              {resolveSummaryMessage(entry.a)}
            </p>
          </div>

          <div className="p-5">
            <HandoverAiCoverageWarning
              warnings={entry.a.warnings}
              coverage={entry.a.coverage}
            />

            {/* Structured Cited Source Cards */}
            {entry.a.sections.length > 0 && (
              <div className="space-y-3">
                {entry.a.sections.map((sec, sIdx) => {
                  const primaryCitation = sec.citations[0];
                  const lookupTitle = primaryCitation
                    ? (sourceTitles?.[
                        `${primaryCitation.source.kind}:${primaryCitation.source.id}`
                      ] ?? sourceTitles?.[primaryCitation.source.id])
                    : undefined;
                  const { title, body } = parseAndCleanSectionText(
                    sec.text,
                    lookupTitle,
                  );
                  const displayTitle =
                    title ??
                    t5("qaSectionDefaultTitle", {
                      index: String(sIdx + 1),
                    });
                  const primaryHref = primaryCitation
                    ? buildSourceWorkspaceHref(
                        projectId,
                        primaryCitation.source.kind,
                        primaryCitation.source.id,
                      )
                    : null;

                  const sectionKey = `${idx}-${sIdx}`;
                  const isExpanded = Boolean(expandedSections[sectionKey]);
                  const isLongExcerpt =
                    body.length > 220 || body.split("\n").length > 3;
                  const isRedundantBody =
                    body.trim().toLowerCase() ===
                    displayTitle.trim().toLowerCase();

                  return (
                    <div
                      key={sIdx}
                      className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-colors hover:border-gray-300/90 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-gray-700"
                    >
                      {/* Card Top Bar: Number + Document Title + Type Badge + Open Link */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-200/80 tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
                            {sIdx + 1}
                          </span>
                          <DocsIcon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {displayTitle}
                          </h3>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {primaryCitation && (
                            <Badge color="info" size="sm">
                              {formatSourceKindLabel(
                                primaryCitation.source.kind,
                              )}{" "}
                              · v{primaryCitation.source.version}
                            </Badge>
                          )}
                          {primaryHref && (
                            <Link
                              href={primaryHref}
                              className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-theme-xs transition-colors hover:bg-brand-50 dark:border-brand-500/30 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-brand-500/15"
                            >
                              <span>{t5("qaOpenSource")}</span>
                              <span aria-hidden="true">↗</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Excerpt Body with 3-Line Clamp & Expand Button */}
                      {!isRedundantBody && (
                        <div className="mt-2.5 ps-8.5">
                          <p
                            className={`whitespace-pre-line text-sm leading-6 text-gray-700 [overflow-wrap:anywhere] dark:text-gray-300 ${
                              !isExpanded && isLongExcerpt ? "line-clamp-3" : ""
                            }`}
                          >
                            {body}
                          </p>

                          {isLongExcerpt && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSections((prev) => ({
                                  ...prev,
                                  [sectionKey]: !prev[sectionKey],
                                }))
                              }
                              className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                            >
                              <span>
                                {isExpanded
                                  ? t5("qaCollapseExcerpt")
                                  : t5("qaExpandExcerpt")}
                              </span>
                              <ChevronDownIcon
                                className={`h-3.5 w-3.5 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Subtle Citation Reference Pills */}
                      {sec.citations.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 ps-8.5">
                          {sec.citations.map((cit, cIdx) => {
                            const href = buildSourceWorkspaceHref(
                              projectId,
                              cit.source.kind,
                              cit.source.id,
                            );
                            const label = `${cit.source.kind}:${formatShortId(cit.source.id)} v${cit.source.version} (${cit.locator.value})`;
                            return href ? (
                              <Link
                                key={cIdx}
                                href={href}
                                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
                              >
                                <DocsIcon className="h-3 w-3" />
                                <span>{label}</span>
                              </Link>
                            ) : (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                              >
                                <DocsIcon className="h-3 w-3" />
                                <span>{label}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
