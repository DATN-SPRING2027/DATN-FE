"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import type {
  AssessmentView,
  SourceRef,
} from "@/lib/queries/work-notes/work-note-assessment.types";

function SourceQuotes({
  refs,
  value,
}: {
  refs: SourceRef[];
  value: AssessmentView;
}) {
  const t = useTranslations("workNotes.assessment");
  if (!refs.length) return null;
  return (
    <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-brand-500">
        {t("viewSources", { count: refs.length })}
      </summary>
      <div className="mt-2 space-y-2">
        {refs.map((ref, index) => {
          const source = value.contextManifest.sources.find(
            (s) => s.id === ref.sourceId,
          );
          return (
            <div key={`${ref.sourceId}-${index}`}>
              <p className="font-medium">
                {source?.label ?? t("sourceUnavailable")}
              </p>
              {source && (
                <blockquote className="max-h-32 overflow-auto border-s-2 border-gray-200 ps-3 break-words whitespace-pre-wrap dark:border-gray-700">
                  {ref.quote}
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
  return (
    <>
      <details
        className="border-t border-gray-100 pt-3 dark:border-gray-800"
        open
      >
        <summary className="cursor-pointer font-medium">
          {t("manifest")}
        </summary>
        <p className="py-2 text-xs text-gray-500 dark:text-gray-400">
          {t("acquisition", {
            status: t(`load.${value.contextManifest.acquisitionStatus}`),
          })}
        </p>
        <ul className="space-y-2">
          {value.contextManifest.sources.map((source) => (
            <li key={source.id} className="text-sm">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-medium">{source.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`load.${source.loadStatus}`)} ·{" "}
                  {t(source.includedInRequest ? "included" : "excluded")}
                </span>
              </div>
              <p className="mt-1 text-xs break-words text-gray-500 dark:text-gray-400">
                {t("sourceVersion", { version: source.version })}
              </p>
              <details className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer">{t("readSource")}</summary>
                <pre className="mt-1 max-h-36 overflow-auto font-sans break-words whitespace-pre-wrap">
                  {source.text || t("emptySource")}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </details>
      <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <h4 className="font-medium">{t("understanding")}</h4>
        <p className="text-sm break-words whitespace-pre-wrap">
          {value.taskUnderstanding.objective}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {value.taskUnderstanding.scope}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("taskContext", {
            status: t(`taskStatus.${value.taskContextStatus}`),
          })}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("adequacy", {
            status: t(`adequacyStatus.${value.noteAdequacy}`),
          })}
        </p>
        {!!value.taskUnderstanding.unknowns.length && (
          <ul className="list-inside list-disc text-sm text-warning-700 dark:text-warning-400">
            {value.taskUnderstanding.unknowns.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        )}
      </div>
      {!!value.taskUnderstanding.requirements.length && (
        <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <h4 className="font-medium">{t("coverage")}</h4>
          {value.taskUnderstanding.requirements.map((requirement) => {
            const coverage = value.coverage.find(
              (c) => c.requirementId === requirement.id,
            );
            return (
              <div key={requirement.id} className="text-sm">
                <p>{requirement.text}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`coverageStatus.${coverage?.status ?? "UNKNOWN"}`)}
                </span>
                <SourceQuotes
                  refs={[
                    ...requirement.sourceRefs,
                    ...(coverage?.sourceRefs ?? []),
                  ]}
                  value={value}
                />
              </div>
            );
          })}
        </div>
      )}
      {!!value.claims.length && (
        <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <h4 className="font-medium">{t("claims")}</h4>
          {value.claims.map((claim) => (
            <div key={claim.id} className="space-y-1 text-sm">
              <p className="break-words whitespace-pre-wrap">{claim.text}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(`origin.${claim.originKind}`)} ·{" "}
                {t(`support.${claim.supportRelation}`)} ·{" "}
                {t(`verification.${claim.verificationStatus}`)}
              </p>
              <SourceQuotes refs={claim.sourceRefs} value={value} />
              <Button
                size="sm"
                variant="outline"
                disabled={!canCorrect}
                onClick={() => onCorrectionRequest(claim.id)}
              >
                {t("correctClaim", { text: claim.text })}
              </Button>
            </div>
          ))}
        </div>
      )}
      {!!value.gaps.length && (
        <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <h4 className="font-medium">{t("gaps")}</h4>
          {value.gaps.map((gap) => (
            <div key={gap.id} className="space-y-1 text-sm">
              <p>{gap.target}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(`gapStatus.${gap.status}`)} · {t(`owner.${gap.owner}`)} ·{" "}
                {t(`impact.${gap.impact}`)}
              </p>
              <SourceQuotes refs={gap.sourceRefs} value={value} />
              <Button
                size="sm"
                variant="outline"
                disabled={!canCorrect}
                onClick={() => onCorrectionRequest(gap.id)}
              >
                {t("correctGap", { text: gap.target })}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
