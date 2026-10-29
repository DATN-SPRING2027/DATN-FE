"use client";

import { useTranslations } from "next-intl";
import { AlertIcon } from "@/icons";
import type { HandoverAiWarning } from "@/lib/queries/handovers/handover.types";

export default function HandoverAiCoverageWarning({
  warnings,
}: {
  warnings?: readonly HandoverAiWarning[];
}) {
  const t = useTranslations("handover.aiCoverage");
  if (!warnings?.includes("AI_EVIDENCE_INCOMPLETE")) return null;
  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
    >
      <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 [overflow-wrap:anywhere]">
        <strong className="font-semibold">{t("title")}</strong>{" "}
        {t("description")}
      </p>
    </div>
  );
}
