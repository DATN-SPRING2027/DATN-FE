"use client";

import { ChevronDown, Info, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/badge/Badge";
import type {
  HistoryFactStatus,
  HistoryRelation,
} from "@/lib/queries/work-notes/work-note-agent.api";
import {
  deriveTaskCompletionStatus,
  type AssessmentClaimHistoryMeta,
  type AssessmentGap,
  type AssessmentHistoryMetadata,
  type AssessmentView,
  type SourceRef,
} from "@/lib/queries/work-notes/work-note-assessment.types";

const MASKED_PLACEHOLDER = /\[\[WN_SEC:([A-Z_]+):[a-f0-9]{10,16}\]\]/g;

function formatHistoryDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function historyStatusPillClass(status: HistoryFactStatus): string {
  switch (status) {
    case "CURRENT":
      return "bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30";
    case "SUPERSEDED":
      return "bg-gray-100 text-gray-600 line-through decoration-gray-400 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700";
    case "OUTDATED":
      return "bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30";
    default:
      return "bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/15 dark:text-error-300 dark:ring-error-500/30";
  }
}

function gapCardClass(kind: AssessmentGap["kind"]): string {
  if (kind === "HISTORICAL_CONFLICT" || kind === "CONTRADICTION") {
    return "border-error-200 bg-error-25/60 dark:border-error-500/30 dark:bg-error-500/10";
  }
  if (kind === "OUTDATED_INFO") {
    return "border-warning-200 bg-warning-25/60 dark:border-warning-500/30 dark:bg-warning-500/10";
  }
  return "border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900/60";
}

function HistoryMetaBadges({
  meta,
}: {
  meta: Pick<
    AssessmentHistoryMetadata | AssessmentClaimHistoryMeta,
    "relation" | "taskKey" | "date" | "factStatus" | "noteTitle"
  >;
}) {
  const t = useTranslations("workNotes.assessment");
  const tHistory = useTranslations("workNotes.agent.historyContext");
  const relationText = (relation: HistoryRelation, taskKey?: string) => {
    const base =
      relation === "SELF"
        ? t("historySource.sameTask")
        : tHistory(`relation.${relation}`);
    return taskKey ? `${base} · ${taskKey}` : base;
  };
  return (
    <div
      data-testid="assessment-history-meta"
      className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]"
    >
      <span
        data-testid="assessment-history-source-badge"
        className="inline-flex rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
      >
        {t("historySource.badge")}
      </span>
      <span
        data-testid="assessment-history-relation-badge"
        className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
      >
        {relationText(meta.relation, meta.taskKey)}
      </span>
      <span
        data-testid="assessment-history-date"
        className="tabular-nums text-gray-500 dark:text-gray-400"
      >
        {t("historySource.dateLabel", { date: formatHistoryDate(meta.date) })}
      </span>
      <span
        data-testid={`assessment-history-status-${meta.factStatus}`}
        className={`inline-flex rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset ${historyStatusPillClass(meta.factStatus)}`}
      >
        {tHistory(`status.${meta.factStatus}`)}
      </span>
    </div>
  );
}

function SourceQuotes({
  refs,
  value,
  formatMasked,
}: {
  refs: SourceRef[];
  value: AssessmentView;
  formatMasked: (text: string) => string;
}) {
  const t = useTranslations("workNotes.assessment");
  if (!refs.length) return null;
  return (
    <details className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer font-medium hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:text-brand-300">
        {t("viewSources", { count: refs.length })}
      </summary>
      <div className="mt-1.5 space-y-2 rounded-lg bg-gray-50/80 p-2 dark:bg-gray-800/60">
        {refs.map((ref, index) => {
          const source = value.contextManifest.sources.find(
            (s) => s.id === ref.sourceId,
          );
          return (
            <div key={`${ref.sourceId}-${index}`} className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-200">
                {source ? formatMasked(source.label) : t("sourceUnavailable")}
              </p>
              {source?.kind === "HISTORY" && source.history && (
                <HistoryMetaBadges meta={source.history} />
              )}
              {source && (
                <blockquote className="max-h-28 overflow-auto border-s-2 border-gray-300 ps-2.5 break-words whitespace-pre-wrap text-gray-600 dark:border-gray-600 dark:text-gray-300">
                  {formatMasked(ref.quote)}
                </blockquote>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default function WorkNoteAssessmentEvidence({
  value,
  canCorrect,
  onCorrectionRequest,
}: {
  value: AssessmentView;
  canCorrect: boolean;
  onCorrectionRequest: (id: string) => void;
}) {
  const t = useTranslations("workNotes.assessment");
  const tAgent = useTranslations("workNotes.agent");
  const formatMasked = (text: string) =>
    text.replace(MASKED_PLACEHOLDER, (_m, category: string) => {
      const label = tAgent.has(`securityCategory.${category}`)
        ? tAgent(`securityCategory.${category}`)
        : category;
      return `🔒 ${label}`;
    });

  const taskCompletion = deriveTaskCompletionStatus(value);
  const purposeLabel = t(`purposes.${value.purpose}`);
  const showIncompleteTaskAdequateNote =
    value.noteAdequacy === "ENOUGH_FOR_PURPOSE" &&
    taskCompletion !== "CRITERIA_REPORTED_MET";

  const detailCount =
    value.taskUnderstanding.requirements.length + value.claims.length;
  const sourceCount = value.contextManifest.sources.length;

  return (
    <div className="space-y-3">
      {/* 1. Compact 3-Row Summary Card (never squished into 3 skinny columns) */}
      <section
        aria-label={t("conclusionsTitle")}
        className="space-y-2.5 rounded-xl border border-gray-200/90 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900/50"
      >
        <h4 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t("summaryHeading")}
        </h4>
        <div className="divide-y divide-gray-200/70 dark:divide-gray-800">
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {t("conclusions.noteAdequacy", { purpose: purposeLabel })}
            </span>
            <Badge
              size="sm"
              color={
                value.noteAdequacy === "ENOUGH_FOR_PURPOSE"
                  ? "success"
                  : value.noteAdequacy === "CONTRADICTORY"
                    ? "error"
                    : "warning"
              }
            >
              {t(`adequacyStatus.${value.noteAdequacy}`)}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 py-2">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {t("conclusions.taskCompletion")}
            </span>
            <Badge
              size="sm"
              color={
                taskCompletion === "CRITERIA_REPORTED_MET"
                  ? "success"
                  : taskCompletion === "CRITERIA_CONTRADICTED"
                    ? "error"
                    : "warning"
              }
            >
              {t(`taskCompletionStatus.${taskCompletion}`)}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {t("conclusions.taskClarity")}
            </span>
            <Badge
              size="sm"
              color={
                value.taskContextStatus === "CLEAR"
                  ? "success"
                  : value.taskContextStatus === "PARTIAL"
                    ? "warning"
                    : "error"
              }
            >
              {t(`taskStatus.${value.taskContextStatus}`)}
            </Badge>
          </div>
        </div>

        {showIncompleteTaskAdequateNote && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/70 p-2.5 text-xs leading-relaxed text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t("adequateNoteIncompleteTaskNotice", { purpose: purposeLabel })}
            </span>
          </div>
        )}
      </section>

      {/* 2. Actionable Points / Information Gaps (clean cards, short Correct trigger) */}
      {value.gaps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {t("openGapsHeading", { count: value.gaps.length })}
          </h4>
          <div className="space-y-2">
            {value.gaps.map((gap) => (
              <div
                key={gap.id}
                data-testid={`assessment-gap-${gap.kind}`}
                className={`space-y-1.5 rounded-xl border p-3 text-xs ${gapCardClass(gap.kind)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      size="sm"
                      color={
                        gap.kind === "HISTORICAL_CONFLICT" ||
                        gap.kind === "CONTRADICTION"
                          ? "error"
                          : gap.kind === "OUTDATED_INFO"
                            ? "warning"
                            : "light"
                      }
                    >
                      {t(`gapKind.${gap.kind}`)}
                    </Badge>
                    {gap.impact === "BLOCKING" && gap.status === "open" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                        {t("importantBadge")}
                      </span>
                    )}
                    {gap.status !== "open" && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {t(`gapStatus.${gap.status}`)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!canCorrect}
                    aria-label={t("correctGap", {
                      text: formatMasked(gap.target),
                    })}
                    onClick={() => onCorrectionRequest(gap.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:hover:bg-brand-500/15"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    <span>{t("correctShort")}</span>
                  </button>
                </div>

                <p className="font-medium leading-relaxed text-gray-900 dark:text-gray-100">
                  {formatMasked(gap.target)}
                </p>

                <SourceQuotes
                  refs={gap.sourceRefs}
                  value={value}
                  formatMasked={formatMasked}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Progressive Disclosure Accordion: Comparison Details (Requirements + Claims) */}
      <details
        data-testid="assessment-details-accordion"
        className="group rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
          <span>{t("detailsAccordion", { count: detailCount })}</span>
          <ChevronDown
            className="size-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-3.5 border-t border-gray-100 px-3 py-3 text-xs dark:border-gray-800">
          {/* Task Understanding */}
          <div className="space-y-1.5">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200">
              {t("understanding")}
            </h5>
            <p className="leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {formatMasked(value.taskUnderstanding.objective)}
            </p>
            {value.taskUnderstanding.scope &&
              value.taskUnderstanding.scope !==
                value.taskUnderstanding.objective && (
                <p className="leading-relaxed text-gray-500 dark:text-gray-400">
                  {formatMasked(value.taskUnderstanding.scope)}
                </p>
              )}
            {!!value.taskUnderstanding.unknowns.length && (
              <ul className="list-inside list-disc space-y-0.5 text-warning-700 dark:text-warning-400">
                {value.taskUnderstanding.unknowns.map((text, i) => (
                  <li key={i}>{formatMasked(text)}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Requirement Coverage */}
          {!!value.taskUnderstanding.requirements.length && (
            <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <h5 className="font-semibold text-gray-800 dark:text-gray-200">
                {t("coverage")}
              </h5>
              <div className="space-y-2">
                {value.taskUnderstanding.requirements.map((requirement) => {
                  const coverage = value.coverage.find(
                    (c) => c.requirementId === requirement.id,
                  );
                  const covStatus = coverage?.status ?? "UNKNOWN";
                  return (
                    <div
                      key={requirement.id}
                      className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="flex-1 font-medium text-gray-800 dark:text-gray-100">
                          {formatMasked(requirement.text)}
                        </p>
                        <Badge
                          size="sm"
                          color={
                            covStatus === "SUPPORTED"
                              ? "success"
                              : covStatus === "CONTRADICTORY"
                                ? "error"
                                : covStatus === "PARTIAL"
                                  ? "warning"
                                  : "light"
                          }
                        >
                          {t(`coverageStatus.${covStatus}`)}
                        </Badge>
                      </div>
                      <SourceQuotes
                        refs={[
                          ...requirement.sourceRefs,
                          ...(coverage?.sourceRefs ?? []),
                        ]}
                        value={value}
                        formatMasked={formatMasked}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extracted Claims */}
          {!!value.claims.length && (
            <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <h5 className="font-semibold text-gray-800 dark:text-gray-200">
                {t("claims")}
              </h5>
              <div className="space-y-2">
                {value.claims.map((claim) => (
                  <div
                    key={claim.id}
                    data-testid={
                      claim.originKind === "HISTORICAL_REPORT"
                        ? "assessment-historical-claim"
                        : undefined
                    }
                    className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 font-medium leading-relaxed break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                        {formatMasked(claim.text)}
                      </p>
                      <button
                        type="button"
                        disabled={!canCorrect}
                        aria-label={t("correctClaim", {
                          text: formatMasked(claim.text),
                        })}
                        onClick={() => onCorrectionRequest(claim.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:hover:bg-brand-500/15"
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                        <span>{t("correctShort")}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {t(`support.${claim.supportRelation}`)} ·{" "}
                      {t(`origin.${claim.originKind}`)} ·{" "}
                      {t(`verification.${claim.verificationStatus}`)}
                    </p>
                    {claim.originKind === "HISTORICAL_REPORT" &&
                      claim.history && (
                        <HistoryMetaBadges meta={claim.history} />
                      )}
                    <SourceQuotes
                      refs={claim.sourceRefs}
                      value={value}
                      formatMasked={formatMasked}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      {/* 4. Progressive Disclosure Accordion: Referenced Sources (Manifest — Closed by default) */}
      <details
        data-testid="assessment-sources-accordion"
        className="group rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
          <span>{t("sourcesAccordion", { count: sourceCount })}</span>
          <ChevronDown
            className="size-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-2 border-t border-gray-100 px-3 py-3 text-xs dark:border-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t("acquisition", {
              status: t(`load.${value.contextManifest.acquisitionStatus}`),
            })}
          </p>
          <ul className="space-y-2">
            {value.contextManifest.sources.map((source) => (
              <li
                key={source.id}
                data-testid={
                  source.kind === "HISTORY"
                    ? "assessment-manifest-history-item"
                    : undefined
                }
                className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {formatMasked(source.label)}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {t(`load.${source.loadStatus}`)} ·{" "}
                    {t(source.includedInRequest ? "included" : "excluded")}
                  </span>
                </div>
                {source.kind === "HISTORY" && source.history && (
                  <>
                    <HistoryMetaBadges meta={source.history} />
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {t("historySource.notCurrentEvidence")}
                    </p>
                  </>
                )}
                <details className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer font-medium hover:text-brand-600 dark:hover:text-brand-300">
                    {t("readSource")}
                  </summary>
                  <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-white p-2 font-sans break-words whitespace-pre-wrap text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {source.text ? formatMasked(source.text) : t("emptySource")}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
