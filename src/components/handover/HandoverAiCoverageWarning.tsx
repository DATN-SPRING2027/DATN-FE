"use client";

import { useTranslations } from "next-intl";
import { AlertIcon, DocsIcon } from "@/icons";
import type {
  HandoverAiCoverageDto,
  HandoverAiWarning,
  SourceRefDto,
} from "@/lib/queries/handovers/handover.types";
import { formatShortId } from "./handover-ui.utils";

function sourceRefKey(ref: SourceRefDto): string {
  return `${ref.kind}:${ref.id.trim().toLowerCase()}:${ref.version.trim() || "1"}`;
}

function dedupeSources(
  sources: readonly SourceRefDto[] | undefined,
): SourceRefDto[] {
  if (!sources?.length) return [];
  const seen = new Set<string>();
  const out: SourceRefDto[] = [];
  for (const s of sources) {
    const key = sourceRefKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export default function HandoverAiCoverageWarning({
  warnings,
  coverage,
  usedSources: fallbackUsedSources,
  allSources: fallbackAllSources,
  sourceLabels,
}: {
  warnings?: readonly HandoverAiWarning[];
  coverage?: HandoverAiCoverageDto | null;
  usedSources?: readonly SourceRefDto[];
  allSources?: readonly SourceRefDto[];
  sourceLabels?: ReadonlyMap<string, string>;
}) {
  const t = useTranslations("handover.aiCoverage");
  if (!warnings?.includes("AI_EVIDENCE_INCOMPLETE")) return null;

  const fallbackUsed = dedupeSources(fallbackUsedSources);
  const fallbackAll = dedupeSources(fallbackAllSources);
  const fallbackUsedKeys = new Set(fallbackUsed.map((s) => sourceRefKey(s)));
  const fallbackSkipped = fallbackAll.filter(
    (s) => !fallbackUsedKeys.has(sourceRefKey(s)),
  );

  const used = coverage
    ? dedupeSources(coverage.includedSources)
    : fallbackUsed.length > 0
      ? fallbackUsed
      : fallbackAll;
  const skipped = coverage
    ? dedupeSources(coverage.skippedSources)
    : fallbackSkipped;
  const truncated = coverage ? dedupeSources(coverage.truncatedSources) : [];
  const hasSourceBreakdown =
    used.length > 0 || skipped.length > 0 || truncated.length > 0;

  const formatSourceLabel = (ref: SourceRefDto): string => {
    const custom =
      sourceLabels?.get(sourceRefKey(ref)) ??
      sourceLabels?.get(`${ref.kind}:${ref.id.trim().toLowerCase()}`);
    if (custom) {
      return `${custom} (${ref.kind}:${formatShortId(ref.id)} v${ref.version})`;
    }
    return `${ref.kind}:${formatShortId(ref.id)} v${ref.version}`;
  };

  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
    >
      <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2 [overflow-wrap:anywhere]">
        <p>
          <strong className="font-semibold">{t("title")}</strong>{" "}
          {t("description")}
        </p>

        {hasSourceBreakdown && (
          <div className="space-y-1.5 border-t border-warning-200/80 pt-2 dark:border-warning-500/20">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold tabular-nums">
                {t("usedSourcesLabel", { count: String(used.length) })}
              </span>
              {used.length === 0 ? (
                <span className="text-warning-700/80 dark:text-warning-300/80">
                  {t("noneLabel")}
                </span>
              ) : (
                used.map((ref) => (
                  <span
                    key={`used-${sourceRefKey(ref)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-warning-300/80 bg-white/80 px-2 py-0.5 font-medium text-warning-900 tabular-nums dark:border-warning-500/30 dark:bg-gray-900/60 dark:text-warning-100"
                  >
                    <DocsIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span>{formatSourceLabel(ref)}</span>
                  </span>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold tabular-nums">
                {t("skippedSourcesLabel", { count: String(skipped.length) })}
              </span>
              {skipped.length === 0 ? (
                <span className="text-warning-700/80 dark:text-warning-300/80">
                  {t("noneLabel")}
                </span>
              ) : (
                skipped.map((ref) => (
                  <span
                    key={`skipped-${sourceRefKey(ref)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-warning-300/80 bg-warning-100/80 px-2 py-0.5 font-medium text-warning-900 tabular-nums dark:border-warning-500/30 dark:bg-warning-500/20 dark:text-warning-100"
                  >
                    <DocsIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span>{formatSourceLabel(ref)}</span>
                  </span>
                ))
              )}
            </div>

            {truncated.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold tabular-nums">
                  {t("truncatedSourcesLabel", {
                    count: String(truncated.length),
                  })}
                </span>
                {truncated.map((ref) => (
                  <span
                    key={`truncated-${sourceRefKey(ref)}`}
                    className="inline-flex items-center gap-1 rounded-md border border-warning-300/80 bg-white/80 px-2 py-0.5 font-medium text-warning-900 tabular-nums dark:border-warning-500/30 dark:bg-gray-900/60 dark:text-warning-100"
                  >
                    <DocsIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span>{formatSourceLabel(ref)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
