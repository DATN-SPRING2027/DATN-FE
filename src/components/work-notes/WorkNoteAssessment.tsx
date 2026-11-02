"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  HelpCircle,
  History,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import WorkNoteAssessmentEvidence from "./WorkNoteAssessmentEvidence";
import { formatMaskedSensitiveText } from "./WorkNoteSecurityNotice";
import {
  ASSESSMENT_PURPOSES,
  type AssessmentPurpose,
  type AssessmentView,
} from "@/lib/queries/work-notes/work-note-assessment.types";
import type { AssessmentFeedbackCategory } from "@/lib/queries/work-notes/work-note-assessment.api";

export type WorkNoteAssessmentProps = {
  value?: AssessmentView | null;
  stale: boolean;
  busy: boolean;
  onAssess: (purpose: AssessmentPurpose) => void;
  onReply: (
    disposition: "answered" | "unknown" | "skipped",
    answer?: string,
  ) => void;
  onRewrite: () => void;
  onCorrect: (target: string, text: string) => void;
  onReset: (purpose: AssessmentPurpose, carryAnswerIds: string[]) => void;
  onValidate: () => void;
  onFeedback: (category: AssessmentFeedbackCategory) => void;
};

const feedbackCategories: AssessmentFeedbackCategory[] = [
  "UNNECESSARY_QUESTION",
  "MISSING_QUESTION",
  "WRONG_SOURCE",
  "FALSE_SUFFICIENT",
];

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

export default function WorkNoteAssessment({
  value,
  stale,
  busy,
  onAssess,
  onReply,
  onRewrite,
  onCorrect,
  onReset,
  onValidate,
  onFeedback,
}: WorkNoteAssessmentProps) {
  const t = useTranslations("workNotes.assessment");
  const tAgent = useTranslations("workNotes.agent");
  const formatMasked = (text: string) =>
    formatMaskedSensitiveText(text, (category) =>
      tAgent.has(`securityCategory.${category}`)
        ? tAgent(`securityCategory.${category}`)
        : category,
    );
  const [purpose, setPurpose] = useState<AssessmentPurpose>(
    value?.purpose ?? "AUTO",
  );
  const [answerBuffer, setAnswerBuffer] = useState<{
    questionId: string;
    text: string;
  } | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [carry, setCarry] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [feedback, setFeedback] = useState<AssessmentFeedbackCategory>(
    "UNNECESSARY_QUESTION",
  );
  const questionInput = useRef<HTMLTextAreaElement>(null);

  const purposeChanged = !!value && purpose !== value.purpose;
  const isStale = stale || purposeChanged || value?.state === "stale";
  const state = busy ? "analyzing" : isStale ? "stale" : value?.state;

  const can = (action: string) =>
    !busy &&
    !!value?.allowedActions.includes(action) &&
    (!isStale || ["correct", "feedback", "reset", "manual"].includes(action)) &&
    !(purposeChanged && action === "correct");

  const question = !manual && !isStale ? value?.nextQuestion : null;
  const answer =
    answerBuffer?.questionId === question?.id ? (answerBuffer?.text ?? "") : "";

  useEffect(() => {
    questionInput.current?.focus();
  }, [question?.id]);

  const showResetPanel = resetOpen || purposeChanged;

  return (
    <section
      aria-label={t("title")}
      className="space-y-3.5 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
    >
      {/* 1. Clean Header + Friendly Localized Status Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {t("title")}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {state ? t(`stateHelp.${state}`) : t("introShort")}
            </p>
          </div>
        </div>
        {state && (
          <span
            role="status"
            aria-live="polite"
            data-testid="assessment-state-badge"
            className="shrink-0"
          >
            <Badge
              size="sm"
              color={
                state === "ready_to_edit"
                  ? "success"
                  : state === "error" || state === "contradiction"
                    ? "error"
                    : "warning"
              }
            >
              {t(`stateLabels.${state}`)}
            </Badge>
          </span>
        )}
      </div>

      {/* 2. Compact Purpose Selector + Check Action */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          {t("purpose")}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("purpose")}
            className="min-w-44 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            value={purpose}
            disabled={busy}
            onChange={(e) => {
              setPurpose(e.target.value as AssessmentPurpose);
              setCarry([]);
            }}
          >
            {ASSESSMENT_PURPOSES.map((p) => (
              <option key={p} value={p} className="dark:bg-gray-900">
                {t(`purposes.${p}`)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={busy || purposeChanged}
            onClick={() => {
              setManual(false);
              onAssess(purpose);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{t("check")}</span>
          </button>
        </div>
      </div>

      {purposeChanged && (
        <p
          role="status"
          className="rounded-lg border border-warning-200 bg-warning-50/70 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
        >
          {t("purposeChanged")}
        </p>
      )}

      {value && (
        <>
          {/* 3. TOP PRIORITY: Active Clarification Question (immediately visible without scrolling!) */}
          {question && (
            <section
              aria-label={t("questionTitle")}
              className="space-y-3 rounded-xl border border-brand-200/90 bg-brand-50/45 p-3.5 dark:border-brand-500/30 dark:bg-brand-500/10"
            >
              <div className="flex items-center gap-1.5 text-brand-700 dark:text-brand-300">
                <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold">{t("questionBadge")}</span>
              </div>

              <h4 className="text-xs font-bold leading-relaxed text-gray-900 dark:text-gray-100">
                {formatMasked(question.text)}
              </h4>

              {question.historyRef && (
                <div
                  data-testid="assessment-history-ref"
                  className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ring-1 ring-inset ${
                    question.historyRef.status === "CURRENT"
                      ? "bg-white text-gray-600 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
                      : "bg-warning-50 text-warning-800 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-200 dark:ring-warning-500/30"
                  }`}
                >
                  <History
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {question.historyRef.relation &&
                    question.historyRef.relation !== "SELF"
                      ? tAgent("historyRefRelatedLabel", {
                          title: formatMasked(question.historyRef.noteTitle),
                          relation: `${tAgent(`historyContext.relation.${question.historyRef.relation}`)}${
                            question.historyRef.taskKey
                              ? ` ${question.historyRef.taskKey}`
                              : ""
                          }`,
                          date: question.historyRef.date
                            .split("-")
                            .reverse()
                            .join("/"),
                        })
                      : tAgent("historyRefLabel", {
                          title: formatMasked(question.historyRef.noteTitle),
                          date: question.historyRef.date
                            .split("-")
                            .reverse()
                            .join("/"),
                        })}
                    {question.historyRef.status !== "CURRENT" &&
                      ` · ${tAgent(`historyContext.status.${question.historyRef.status}`)}`}
                  </span>
                </div>
              )}

              {question.reason && (
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {formatMasked(question.reason)}
                </p>
              )}

              {question.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {question.options.map((option, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={!can("reply")}
                      onClick={() => onReply("answered", option)}
                      className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-start text-xs font-medium text-brand-700 shadow-2xs transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-brand-500/35 dark:bg-gray-900 dark:text-brand-200 dark:hover:bg-brand-500/15"
                    >
                      {formatMasked(option)}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onReply("answered", answer.trim());
                  setAnswerBuffer(null);
                }}
              >
                <label className="block space-y-1 text-xs">
                  <span className="sr-only">{t("answer")}</span>
                  <textarea
                    ref={questionInput}
                    aria-label={t("answer")}
                    placeholder={t("answerPlaceholder")}
                    rows={2}
                    maxLength={2000}
                    value={answer}
                    onChange={(e) =>
                      setAnswerBuffer({
                        questionId: question.id,
                        text: e.target.value,
                      })
                    }
                    disabled={!can("reply")}
                    className={fieldClass}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!can("reply") || !answer.trim()}
                  >
                    {t("sendAnswer")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={!can("reply")}
                    onClick={() => onReply("unknown")}
                  >
                    {t("unknown")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={!can("reply")}
                    onClick={() => onReply("skipped")}
                  >
                    {t("skip")}
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* 3B. Ready-to-Rewrite Callout when sufficient */}
          {!question && can("rewrite") && (
            <div className="space-y-2.5 rounded-xl border border-success-200 bg-success-50/70 p-3.5 dark:border-success-500/30 dark:bg-success-500/10">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success-600 dark:text-success-400"
                  aria-hidden="true"
                />
                <div className="space-y-0.5 text-xs">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {t("readyBannerTitle", {
                      purpose: t(`purposes.${value.purpose}`),
                    })}
                  </p>
                  <p className="leading-relaxed text-gray-600 dark:text-gray-300">
                    {t("readyBannerHint")}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={onRewrite}>
                {t("rewrite")}
              </Button>
            </div>
          )}

          {/* Inline Correction Form (opens right in view when user clicks Correct on any item) */}
          {correctionTarget && (
            <form
              className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/35 p-3 dark:border-brand-500/30 dark:bg-brand-500/10"
              onSubmit={(e) => {
                e.preventDefault();
                onCorrect(correctionTarget, correctionText.trim());
                setCorrectionTarget(null);
              }}
            >
              <label className="block space-y-1 text-xs font-medium text-gray-800 dark:text-gray-200">
                <span>{t("correctionText")}</span>
                <textarea
                  autoFocus
                  rows={2}
                  maxLength={2000}
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t("correctionHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="submit"
                  disabled={!can("correct") || !correctionText.trim()}
                >
                  {t("submitCorrection")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}

          {(value.state === "paused" || value.counters.noProgress >= 2) && (
            <p
              role="status"
              className="rounded-lg border border-warning-200 bg-warning-50/70 px-3 py-2 text-xs leading-relaxed text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
            >
              {t("stopNotice", { questions: value.counters.questionCount })}
            </p>
          )}

          {manual && (
            <p
              role="status"
              className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600 dark:bg-gray-800/70 dark:text-gray-300"
            >
              {t("manualNotice")}
            </p>
          )}

          {/* Reset / Carry-Answers Panel (shown when user changes purpose or clicks Reset) */}
          {showResetPanel && (
            <fieldset className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <legend className="px-1 text-xs font-semibold text-gray-800 dark:text-gray-200">
                {t("reset")}
              </legend>
              <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {t("resetHint")}
              </p>
              {value.answers
                .filter((a) => a.disposition === "answered")
                .map((a) => (
                  <label
                    key={a.id}
                    className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-200"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={carry.includes(a.id)}
                      onChange={(e) =>
                        setCarry((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span>
                      {t("carryAnswer", {
                        text: formatMasked(a.answer ?? a.target),
                      })}
                    </span>
                  </label>
                ))}
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  onReset(purpose, carry);
                  setResetOpen(false);
                  setManual(false);
                }}
              >
                {t("confirmReset")}
              </Button>
            </fieldset>
          )}

          {/* 4. Summary + Open Gaps + Collapsed Deep-Dive Accordions */}
          <WorkNoteAssessmentEvidence
            value={value}
            canCorrect={can("correct")}
            onCorrectionRequest={(target) => {
              setCorrectionTarget(target);
              setCorrectionText("");
            }}
          />

          {/* 5. Secondary Actions & Quality Feedback Accordion (Closed by default) */}
          <details
            data-testid="assessment-more-actions-accordion"
            className="group rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
              <span>{t("moreActionsAccordion")}</span>
              <ChevronDown
                className="size-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="space-y-3 border-t border-gray-100 px-3 py-3 text-xs dark:border-gray-800">
              <div className="flex flex-wrap gap-2">
                {(question || !can("rewrite")) && (
                  <Button
                    size="sm"
                    disabled={!can("rewrite")}
                    onClick={onRewrite}
                  >
                    {t("rewrite")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setManual(true)}
                >
                  {t("manual")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !value.allowedActions.includes("reset")}
                  onClick={() => {
                    setResetOpen((v) => !v);
                    setCarry([]);
                  }}
                >
                  <RotateCcw className="me-1 size-3.5" aria-hidden="true" />
                  {t("reset")}
                </Button>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!can("validate_author") || value.authorValidated}
                  onClick={onValidate}
                >
                  {t("validateAuthor")}
                </Button>
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {t("reviewNotEstablished")}
                </p>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                <p className="font-semibold text-gray-800 dark:text-gray-200">
                  {t("feedback")}
                </p>
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {t("feedbackHint")}
                </p>
                <label className="block space-y-1 text-xs">
                  <span>{t("feedbackCategory")}</span>
                  <select
                    value={feedback}
                    onChange={(e) =>
                      setFeedback(e.target.value as AssessmentFeedbackCategory)
                    }
                    className={fieldClass}
                  >
                    {feedbackCategories.map((category) => (
                      <option
                        key={category}
                        value={category}
                        className="dark:bg-gray-900"
                      >
                        {t(`feedbackCategories.${category}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!can("feedback")}
                  onClick={() => onFeedback(feedback)}
                >
                  {t("sendFeedback")}
                </Button>
                {!!value.feedback?.length && (
                  <p
                    role="status"
                    className="text-[11px] text-gray-500 dark:text-gray-400"
                  >
                    {t("feedbackRecorded")}
                  </p>
                )}
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
