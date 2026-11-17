"use client";

import { useTranslations } from "next-intl";
import {
  deriveTaskCompletionStatus,
  type AssessmentView,
} from "@/lib/queries/work-notes/work-note-assessment.types";

export default function WorkNoteAssessmentSummary({
  value,
}: {
  value: AssessmentView;
}) {
  const t = useTranslations("workNotes.assessment");
  const enough = value.noteAdequacy === "ENOUGH_FOR_PURPOSE";
  return (
    <section
      aria-label={t("conclusionsTitle")}
      className="space-y-1.5"
      aria-live="polite"
    >
      <p
        data-testid="assessment-state-badge"
        className={`text-sm font-semibold ${enough ? "text-success-700 dark:text-success-300" : "text-warning-700 dark:text-warning-300"}`}
      >
        {enough
          ? t("compactAdequate", { purpose: t(`purposes.${value.purpose}`) })
          : t(`stateLabels.${value.state}`)}
      </p>
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        {t(`taskCompletionStatus.${deriveTaskCompletionStatus(value)}`)}
      </p>
    </section>
  );
}
