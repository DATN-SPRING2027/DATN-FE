"use client";

import { useTranslations } from "next-intl";
import {
  AlertIcon,
  BoltIcon,
  CheckCircleIcon,
  DocsIcon,
  PlatformServerIcon,
  RefreshIcon,
} from "@/icons";
import { cn } from "@/utils";
import PlatformAiFeedbackPanel from "./PlatformAiFeedbackPanel";
import StatusBadge from "./ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  box,
  formatPlatformDate,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformAiDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole.aiOperations");
  const tOps = useTranslations("platformConsole.operations");
  const tRoot = useTranslations("platformConsole");
  const { canReadAi, ai, permissions } = model;

  if (!canReadAi) {
    return (
      <p
        role="status"
        className={`${box} p-6 text-xs text-warning-700 dark:text-warning-300`}
      >
        Your Platform session does not grant platform.ai.operations.read.
      </p>
    );
  }

  const formatDependencyLabel = (key: string): string => {
    switch (key) {
      case "database":
        return t("depDatabase");
      case "knowledgeRuntime":
        return t("depKnowledgeRuntime");
      case "retrieval":
        return t("depRetrieval");
      case "modelProvider":
        return t("depModelProvider");
      case "processingJobs":
        return t("depProcessingJobs");
      case "failedProcessingSummary":
        return t("depFailedProcessingSummary");
      default:
        return key;
    }
  };

  const data = ai.data;
  const runtimeProfile = data?.runtimeProfile ?? null;
  const corpusSummary = data?.corpusSummary ?? null;
  const jobSummary = data?.jobSummary ?? null;
  const hasAnyTelemetry =
    runtimeProfile !== null || corpusSummary !== null || jobSummary !== null;
  const dependencyEntries = data ? Object.entries(data.dependencies) : [];

  return (
    <>
      <section
        aria-labelledby="platform-ai-operations-heading"
        className={`${box} p-5`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="max-w-2xl">
            <h2
              id="platform-ai-operations-heading"
              className="text-sm font-semibold text-gray-900 dark:text-white"
            >
              {t("sectionTitle")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t("sectionSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void ai.refetch?.()}
            disabled={Boolean(ai.isFetching)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshIcon
              aria-hidden="true"
              className={cn(
                "size-3.5 text-gray-500 dark:text-gray-400",
                ai.isFetching && "animate-spin",
              )}
            />
            <span>{ai.isFetching ? tRoot("refreshing") : tRoot("refresh")}</span>
          </button>
        </div>

        {data !== undefined &&
          !isReadAccessLost(ai.error) &&
          (ai.isFetching || ai.isRefetchError) && (
            <div className="mt-4">
              <QueryRefreshStatus
                hasData
                isFetching={ai.isFetching}
                isRefetchError={ai.isRefetchError}
                onRetry={() => void ai.refetch?.()}
              />
            </div>
          )}

        {ai.isError && (!data || isReadAccessLost(ai.error)) ? (
          <ErrorState retry={() => void ai.refetch?.()} />
        ) : !data ? (
          <Loading columns={5} />
        ) : (
          <>
            <div className="mt-4">
              <DirectoryTable
                headers={[
                  tOps("service"),
                  t("livenessLabel"),
                  tOps("readiness"),
                  tOps("availability"),
                  tOps("checked"),
                ]}
              >
                <tr>
                  <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">
                    {data.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={data.liveness} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={data.readiness} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={data.availability} />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 tabular-nums dark:text-gray-300">
                    {formatPlatformDate(data.lastCheckedAt)}
                  </td>
                </tr>
              </DirectoryTable>
            </div>

            <p className="mt-4 rounded-xl border border-gray-200/80 bg-gray-50/80 p-3.5 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-200">
              {data.diagnosticsSummary}
            </p>

            {/* Live Runtime & Ingestion Telemetry */}
            <div className="mt-5">
              <h3 className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                {t("telemetryHeading")}
              </h3>

              {!hasAnyTelemetry ? (
                <p className="mt-2.5 rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4 text-xs leading-relaxed text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                  {t("telemetryUnavailable")}
                </p>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {/* Card 1: LLM Runtime */}
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      runtimeProfile?.llmConfigured
                        ? "border-success-500/25 bg-success-50/50 dark:border-success-500/20 dark:bg-success-500/10"
                        : runtimeProfile
                          ? "border-warning-500/30 bg-warning-50/50 dark:border-warning-500/20 dark:bg-warning-500/10"
                          : "border-gray-200/80 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-950/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-[11px] font-semibold tracking-wider uppercase",
                          runtimeProfile?.llmConfigured
                            ? "text-success-700 dark:text-success-300"
                            : runtimeProfile
                              ? "text-warning-700 dark:text-warning-300"
                              : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {t("kpiLlmTitle")}
                      </p>
                      {runtimeProfile?.llmConfigured ? (
                        <CheckCircleIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-success-600 dark:text-success-300"
                        />
                      ) : runtimeProfile ? (
                        <AlertIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-warning-600 dark:text-warning-300"
                        />
                      ) : (
                        <BoltIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-gray-400 dark:text-gray-500"
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 text-base font-bold leading-snug break-words",
                        runtimeProfile?.llmConfigured
                          ? "text-success-700 dark:text-success-300"
                          : runtimeProfile
                            ? "text-warning-700 dark:text-warning-300"
                            : "text-gray-700 dark:text-gray-300",
                      )}
                    >
                      {runtimeProfile?.llmModel ??
                        (runtimeProfile?.llmConfigured
                          ? t("kpiLlmProviderUnknown")
                          : t("kpiLlmUnconfigured"))}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed tabular-nums",
                        runtimeProfile?.llmConfigured
                          ? "text-success-700/85 dark:text-success-300/85"
                          : runtimeProfile
                            ? "text-warning-700/85 dark:text-warning-300/85"
                            : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {runtimeProfile
                        ? t("kpiLlmHint", {
                            provider:
                              runtimeProfile.llmProvider ??
                              t("kpiLlmProviderUnknown"),
                            workers: runtimeProfile.workerConcurrency,
                          })
                        : t("telemetryUnavailable")}
                    </p>
                  </div>

                  {/* Card 2: Retrieval & Parser */}
                  <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                        {t("kpiRetrievalTitle")}
                      </p>
                      <PlatformServerIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      />
                    </div>
                    <p className="mt-1.5 text-base font-bold leading-snug break-words text-gray-900 dark:text-white">
                      {runtimeProfile?.retrievalModel ??
                        t("kpiRetrievalUnconfigured")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {runtimeProfile
                        ? t("kpiRetrievalHint", {
                            vectorStore:
                              runtimeProfile.vectorStore ??
                              t("kpiComponentUnknown"),
                            parser:
                              runtimeProfile.parserProvider ??
                              t("kpiComponentUnknown"),
                          })
                        : t("telemetryUnavailable")}
                    </p>
                  </div>

                  {/* Card 3: Indexed Corpus */}
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      corpusSummary && corpusSummary.failed > 0
                        ? "border-warning-500/30 bg-warning-50/50 dark:border-warning-500/20 dark:bg-warning-500/10"
                        : corpusSummary
                          ? "border-success-500/25 bg-success-50/50 dark:border-success-500/20 dark:bg-success-500/10"
                          : "border-gray-200/80 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-950/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-[11px] font-semibold tracking-wider uppercase",
                          corpusSummary && corpusSummary.failed > 0
                            ? "text-warning-700 dark:text-warning-300"
                            : corpusSummary
                              ? "text-success-700 dark:text-success-300"
                              : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {t("kpiCorpusTitle")}
                      </p>
                      <DocsIcon
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0",
                          corpusSummary && corpusSummary.failed > 0
                            ? "text-warning-600 dark:text-warning-300"
                            : corpusSummary
                              ? "text-success-600 dark:text-success-300"
                              : "text-gray-400 dark:text-gray-500",
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 text-2xl font-bold tabular-nums",
                        corpusSummary && corpusSummary.failed > 0
                          ? "text-warning-700 dark:text-warning-300"
                          : corpusSummary
                            ? "text-success-700 dark:text-success-300"
                            : "text-gray-400 dark:text-gray-500",
                      )}
                    >
                      {corpusSummary ? corpusSummary.ready : "—"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed tabular-nums",
                        corpusSummary && corpusSummary.failed > 0
                          ? "text-warning-700/85 dark:text-warning-300/85"
                          : corpusSummary
                            ? "text-success-700/85 dark:text-success-300/85"
                            : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {corpusSummary
                        ? t("kpiCorpusHint", corpusSummary)
                        : t("telemetryUnavailable")}
                    </p>
                  </div>

                  {/* Card 4: Ingestion Jobs */}
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      jobSummary && jobSummary.failed > 0
                        ? "border-warning-500/30 bg-warning-50/50 dark:border-warning-500/20 dark:bg-warning-500/10"
                        : "border-gray-200/80 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-950/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-[11px] font-semibold tracking-wider uppercase",
                          jobSummary && jobSummary.failed > 0
                            ? "text-warning-700 dark:text-warning-300"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {t("kpiJobsTitle")}
                      </p>
                      {jobSummary && jobSummary.failed > 0 ? (
                        <AlertIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-warning-600 dark:text-warning-300"
                        />
                      ) : (
                        <BoltIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 text-2xl font-bold tabular-nums",
                        jobSummary && jobSummary.failed > 0
                          ? "text-warning-700 dark:text-warning-300"
                          : jobSummary
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-400 dark:text-gray-500",
                      )}
                    >
                      {jobSummary
                        ? t("kpiJobsActiveValue", {
                            active: jobSummary.queued + jobSummary.running,
                          })
                        : "—"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed tabular-nums",
                        jobSummary && jobSummary.failed > 0
                          ? "text-warning-700/85 dark:text-warning-300/85"
                          : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {jobSummary
                        ? t("kpiJobsHint", jobSummary)
                        : t("telemetryUnavailable")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Structured Dependency Probes Grid */}
            <div className="mt-5">
              <h3 className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                {t("dependenciesHeading")}
              </h3>
              {dependencyEntries.length === 0 ? (
                <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("dependenciesEmpty")}
                </p>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {dependencyEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-gray-50/60 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-950/40"
                    >
                      <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                        {formatDependencyLabel(key)}
                      </span>
                      <StatusBadge status={String(value)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <PlatformAiFeedbackPanel permissions={permissions} />
    </>
  );
}
