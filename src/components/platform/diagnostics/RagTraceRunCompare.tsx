"use client";

import { useFormatter, useTranslations } from "next-intl";
import styles from "./RagTraceRunCompare.module.css";
import type { RagTraceDetail, RagTraceStage } from "./ragTrace.types";

const stages: readonly RagTraceStage[] = [
  "retrieval_candidates",
  "retrieval_selected",
  "tool_pack",
  "model_input",
  "final_citation",
];

function checkpoint(detail: RagTraceDetail, stage: RagTraceStage) {
  return detail.checkpoints.findLast((item) => item.stage === stage);
}

export default function RagTraceRunCompare({
  latest,
  previous,
}: {
  latest: RagTraceDetail;
  previous: RagTraceDetail;
}) {
  const t = useTranslations("platformConsole.ragTrace.explorer.compare");
  const tStatus = useTranslations("platformConsole.ragTrace.status");
  const tStage = useTranslations("platformConsole.ragTrace.stage");
  const format = useFormatter();
  const latencyDelta =
    latest.trace.durationMs == null || previous.trace.durationMs == null
      ? null
      : latest.trace.durationMs - previous.trace.durationMs;

  function duration(value: number | null) {
    return value == null
      ? t("notRecorded")
      : format.number(value, {
          style: "unit",
          unit: "millisecond",
          unitDisplay: "short",
          maximumFractionDigits: 0,
        });
  }

  function observedCount(detail: RagTraceDetail, stage: RagTraceStage) {
    const stageCheckpoint = checkpoint(detail, stage);
    if (!stageCheckpoint || stageCheckpoint.coverage === "not_recorded") {
      return null;
    }
    return {
      count: stageCheckpoint.items.filter(
        (item) => item.disposition === "present",
      ).length,
      coverage: stageCheckpoint.coverage,
    };
  }

  return (
    <section className={styles.compare} aria-labelledby="trace-compare-title">
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>{t("kicker")}</span>
          <h3 id="trace-compare-title">{t("title")}</h3>
          <p>{t("description")}</p>
        </div>
        <div
          className={styles.delta}
          data-direction={
            latencyDelta == null
              ? "unknown"
              : latencyDelta > 0
                ? "slower"
                : latencyDelta < 0
                  ? "faster"
                  : "same"
          }
        >
          <span>{t("latencyDelta")}</span>
          <strong>
            {latencyDelta == null
              ? t("notComparable")
              : `${latencyDelta > 0 ? "+" : latencyDelta < 0 ? "−" : ""}${duration(Math.abs(latencyDelta))}`}
          </strong>
        </div>
      </header>

      <div className={styles.comparison}>
        {[previous, latest].map((detail, index) => (
          <article
            className={styles.run}
            data-current={index === 1}
            key={detail.trace.traceId}
          >
            <div className={styles.runHeading}>
              <span className={styles.runTag}>
                {index === 1 ? t("latest") : t("previous")}
              </span>
              <code>{detail.trace.runId ?? detail.trace.traceId}</code>
            </div>
            <dl className={styles.runFacts}>
              <div>
                <dt>{t("outcome")}</dt>
                <dd
                  data-outcome={
                    detail.trace.answerStatus ?? detail.trace.runtimeState
                  }
                >
                  {tStatus(
                    detail.trace.answerStatus ?? detail.trace.runtimeState,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("totalTime")}</dt>
                <dd>{duration(detail.trace.durationMs)}</dd>
              </div>
              <div>
                <dt>{t("firstText")}</dt>
                <dd>{duration(detail.trace.firstTextMs)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className={styles.stageTable}>
        <div className={styles.stageHeader}>
          <span>{t("evidenceAtStage")}</span>
          <span>{t("previous")}</span>
          <span>{t("latest")}</span>
        </div>
        {stages.map((stage) => (
          <div className={styles.stageRow} key={stage}>
            <strong>{tStage(stage)}</strong>
            {[previous, latest].map((detail) => {
              const result = observedCount(detail, stage);
              return (
                <span
                  key={detail.trace.traceId}
                  data-current={detail.trace.traceId === latest.trace.traceId}
                  data-coverage={result?.coverage ?? "not_recorded"}
                >
                  {result
                    ? t("evidenceCount", { count: result.count })
                    : t("notRecorded")}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className={styles.footnote}>{t("footnote")}</p>
    </section>
  );
}
