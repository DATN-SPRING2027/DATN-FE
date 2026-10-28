"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import WorkNoteAssessmentEvidence from "./WorkNoteAssessmentEvidence";
import Badge from "@/components/ui/badge/Badge";
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
  "w-full rounded-lg border border-gray-200 bg-transparent p-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:text-gray-200";

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
  return (
    <section
      aria-label={t("title")}
      className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="min-w-0 flex-1 font-semibold">{t("title")}</h3>
        {state && (
          <span role="status" aria-live="polite">
            <Badge
              color={
                state === "ready_to_edit"
                  ? "success"
                  : state === "error" || state === "contradiction"
                    ? "error"
                    : "warning"
              }
            >
              {state}
            </Badge>
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t("intro")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1 space-y-1 text-sm">
          <span>{t("purpose")}</span>
          <select
            className={fieldClass}
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
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || purposeChanged}
          onClick={() => {
            setManual(false);
            onAssess(purpose);
          }}
        >
          {t("check")}
        </Button>
      </div>
      {state && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t(`stateHelp.${state}`)}
        </p>
      )}
      {purposeChanged && (
        <p
          role="status"
          className="text-sm text-warning-700 dark:text-warning-400"
        >
          {t("purposeChanged")}
        </p>
      )}
      {value && (
        <>
          <WorkNoteAssessmentEvidence
            value={value}
            canCorrect={can("correct")}
            onCorrectionRequest={(target) => {
              setCorrectionTarget(target);
              setCorrectionText("");
            }}
          />
          {correctionTarget && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                onCorrect(correctionTarget, correctionText.trim());
                setCorrectionTarget(null);
              }}
            >
              <label className="block space-y-1 text-sm">
                <span>{t("correctionText")}</span>
                <textarea
                  autoFocus
                  rows={3}
                  maxLength={2000}
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
          {question && (
            <section
              aria-label={t("questionTitle")}
              className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800"
            >
              <h4 className="font-medium">{question.text}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {question.reason}
              </p>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onReply("answered", answer.trim());
                  setAnswerBuffer(null);
                }}
              >
                <label className="block space-y-1 text-sm">
                  <span>{t("answer")}</span>
                  <textarea
                    ref={questionInput}
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
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={!can("reply")}
                      onClick={() => onReply("answered", option)}
                    >
                      {option}
                    </Button>
                  ))}
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
          {(value.state === "paused" || value.counters.noProgress >= 2) && (
            <p
              role="status"
              className="text-sm text-warning-700 dark:text-warning-400"
            >
              {t("stopNotice", { questions: value.counters.questionCount })}
            </p>
          )}
          {manual && (
            <p
              role="status"
              className="text-sm text-gray-600 dark:text-gray-300"
            >
              {t("manualNotice")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Button size="sm" disabled={!can("rewrite")} onClick={onRewrite}>
              {t("rewrite")}
            </Button>
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
              {t("reset")}
            </Button>
          </div>
          {resetOpen && (
            <fieldset className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <legend className="px-1 text-sm font-medium">{t("reset")}</legend>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("resetHint")}
              </p>
              {value.answers
                .filter((a) => a.disposition === "answered")
                .map((a) => (
                  <label key={a.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
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
                      {t("carryAnswer", { text: a.answer ?? a.target })}
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
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("signals", {
                applied: value.signals.proposalApplied ? t("yes") : t("no"),
                validated: value.authorValidated ? t("yes") : t("no"),
                saved: value.signals.saved ? t("yes") : t("no"),
              })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("reviewNotEstablished")}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!can("validate_author") || value.authorValidated}
              onClick={onValidate}
            >
              {t("validateAuthor")}
            </Button>
          </div>
          <details className="border-t border-gray-100 pt-3 dark:border-gray-800">
            <summary className="cursor-pointer text-sm">
              {t("feedback")}
            </summary>
            <p className="my-2 text-xs text-gray-500 dark:text-gray-400">
              {t("feedbackHint")}
            </p>
            <label className="block space-y-1 text-sm">
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
              className="mt-2"
              disabled={!can("feedback")}
              onClick={() => onFeedback(feedback)}
            >
              {t("sendFeedback")}
            </Button>
            {!!value.feedback?.length && (
              <p
                role="status"
                className="mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                {t("feedbackRecorded")}
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
