"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import CopyIdentifier from "../ui/CopyIdentifier";
import styles from "./RagTraceDetailView.module.css";
import type {
  RagTraceCheckpoint,
  RagTraceDetail,
  RagTraceEvidence,
  RagTraceStage,
} from "./ragTrace.types";
import { createTraceView } from "./ragTraceView";

type Focus = { spanId: string; stage?: RagTraceStage };
type TraceMode = "tree" | "timeline" | "graph" | "log";
type InspectorMode = "preview" | "json";
const rulerTicks = [0, 1, 2, 3, 4];
const stages: readonly RagTraceStage[] = [
  "retrieval_candidates",
  "retrieval_selected",
  "tool_pack",
  "model_input",
  "final_citation",
];

function checkpointState(
  checkpoint: RagTraceCheckpoint | undefined,
  item: RagTraceEvidence | undefined,
) {
  return (
    item?.disposition ??
    (!checkpoint || checkpoint.coverage === "not_recorded"
      ? "not_recorded"
      : checkpoint.coverage === "complete"
        ? "not_observed"
        : "incomplete")
  );
}

export default function RagTraceDetailView({
  detail,
  initialSpanId,
}: {
  detail: RagTraceDetail;
  initialSpanId?: string;
}) {
  return (
    <TraceWorkspace
      key={`${detail.trace.traceId}:${initialSpanId ?? "root"}`}
      detail={detail}
      initialSpanId={initialSpanId}
    />
  );
}

function TraceWorkspace({
  detail,
  initialSpanId,
}: {
  detail: RagTraceDetail;
  initialSpanId?: string;
}) {
  const t = useTranslations("platformConsole.ragTrace");
  const format = useFormatter();
  const labelId = useId();
  const findingsId = useId();
  const journeyId = useId();
  const evidenceId = useId();
  const timelineId = useId();
  const inspectorId = useId();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const view = useMemo(() => createTraceView(detail), [detail]);
  const [evidenceChoice, setEvidenceChoice] = useState<string>();
  const [focus, setFocus] = useState<Focus>();
  const [traceMode, setTraceMode] = useState<TraceMode>("tree");
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("preview");
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const evidenceRef =
    evidenceChoice && view.evidence.includes(evidenceChoice)
      ? evidenceChoice
      : view.initialEvidence;
  const stops = evidenceRef ? view.evidenceStops(evidenceRef) : [];
  const activeFocus: { spanId: string | undefined; stage?: RagTraceStage } =
    focus &&
    (view.spans.some((span) => span.spanId === focus.spanId) ||
      view.checkpoints.some(
        (checkpoint) =>
          checkpoint.spanId === focus.spanId &&
          checkpoint.stage === focus.stage,
      ))
      ? focus
      : {
          spanId:
            view.spans.find((span) => span.spanId === initialSpanId)?.spanId ??
            view.initialSpan?.spanId ??
            stops.find((stop) => stop.state === "removed")?.checkpoint
              ?.spanId ??
            stops.find((stop) => stop.checkpoint)?.checkpoint?.spanId,
        };
  const selectedSpan = view.spans.find(
    (span) => span.spanId === activeFocus.spanId,
  );
  const selectedCheckpoints = view.checkpoints.filter(
    (checkpoint) =>
      checkpoint.spanId === activeFocus.spanId &&
      (activeFocus.stage === undefined ||
        checkpoint.stage === activeFocus.stage),
  );
  const selectedCheckpoint = selectedCheckpoints.at(-1);
  const selectedItem = selectedCheckpoint?.items.find(
    (candidate) => candidate.unitRef === evidenceRef,
  );
  const retrievalCheckpoint = view.checkpoints.findLast(
    (checkpoint) => checkpoint.stage === "retrieval_selected",
  );
  const retrievalSpan = retrievalCheckpoint
    ? view.spans.find((span) => span.spanId === retrievalCheckpoint.spanId)
    : undefined;
  const outcome = detail.trace.answerStatus ?? detail.trace.runtimeState;
  const shouldShowRuler =
    view.timingEnd > 0 &&
    view.spans.some(
      (span) => span.startOffsetMs !== null && span.durationMs !== null,
    );
  const timelineWindowDuration =
    view.timingEnd > 0 ? view.timingEnd / timelineZoom : 0;
  const maxTimelineOffset = Math.max(
    0,
    view.timingEnd - timelineWindowDuration,
  );
  const timelineWindowStart = Math.min(timelineOffset, maxTimelineOffset);
  const timelineWindowEnd = timelineWindowStart + timelineWindowDuration;
  const failedSpan = view.spans.find((span) => span.status === "failed");
  const removedEvidence = view.evidence.flatMap((unitRef) => {
    const stop = view
      .evidenceStops(unitRef)
      .find((candidate) => candidate.state === "removed");
    return stop
      ? [{ unitRef, stage: stop.stage, reason: stop.item?.reason }]
      : [];
  });
  const missingFinalCitation = view.checkpoints.some(
    (checkpoint) =>
      checkpoint.stage === "final_citation" &&
      checkpoint.coverage !== "complete",
  );
  const signals: Array<{
    tone: "danger" | "warning" | "neutral";
    text: string;
  }> = [];
  if (failedSpan) {
    signals.push({
      tone: "danger",
      text: t("findings.failed", {
        stage: t(`span.${failedSpan.kind}`),
        reason: failedSpan.reason
          ? t(`reason.${failedSpan.reason}`)
          : t("notRecorded"),
      }),
    });
  }
  for (const removed of removedEvidence.slice(0, 2)) {
    signals.push({
      tone: "warning",
      text: t("findings.removed", {
        unit: removed.unitRef,
        stage: t(`stage.${removed.stage}`),
        reason: removed.reason
          ? t(`reason.${removed.reason}`)
          : t("notRecorded"),
      }),
    });
  }
  if (missingFinalCitation) {
    signals.push({ tone: "neutral", text: t("findings.finalCitationMissing") });
  }
  if (detail.trace.captureState !== "recorded") {
    signals.push({
      tone: "neutral",
      text: t(`capture.${detail.trace.captureState}`),
    });
  }
  if (signals.length === 0) {
    signals.push({ tone: "neutral", text: t("findings.noFindings") });
  }

  function duration(ms: number | null) {
    if (ms === null) return t("notRecorded");
    return format.number(ms >= 1000 ? ms / 1000 : ms, {
      style: "unit",
      unit: ms >= 1000 ? "second" : "millisecond",
      unitDisplay: "short",
      maximumFractionDigits: ms >= 1000 ? 2 : 3,
    });
  }

  function rulerDuration(ms: number) {
    const seconds = ms >= 1000;
    return `${format.number(seconds ? ms / 1000 : ms, {
      maximumFractionDigits: seconds ? 1 : 0,
    })}${seconds ? "s" : "ms"}`;
  }

  function panTimeline(direction: -1 | 1) {
    setTimelineOffset((current) =>
      Math.min(
        maxTimelineOffset,
        Math.max(0, current + direction * timelineWindowDuration * 0.35),
      ),
    );
  }

  function zoomTimeline(direction: -1 | 1) {
    const nextZoom = Math.max(1, Math.min(8, timelineZoom * (direction > 0 ? 2 : 0.5)));
    const nextWindow = view.timingEnd / nextZoom;
    const nextMaxOffset = Math.max(0, view.timingEnd - nextWindow);
    setTimelineZoom(nextZoom);
    setTimelineOffset((current) =>
      Math.min(nextMaxOffset, Math.max(0, current + (timelineWindowDuration - nextWindow) / 2)),
    );
  }

  function zoomToSelectedSpan() {
    if (!selectedSpan || selectedSpan.startOffsetMs === null || view.timingEnd <= 0) return;
    const nextZoom = 4;
    const nextWindow = view.timingEnd / nextZoom;
    const spanCenter =
      selectedSpan.startOffsetMs + (selectedSpan.durationMs ?? 0) / 2;
    setTimelineZoom(nextZoom);
    setTimelineOffset(
      Math.min(
        Math.max(0, view.timingEnd - nextWindow),
        Math.max(0, spanCenter - nextWindow / 2),
      ),
    );
  }

  function fitTimeline() {
    setTimelineZoom(1);
    setTimelineOffset(0);
  }

  function chooseEvidence(unitRef: string, stage?: RagTraceStage) {
    setEvidenceChoice(unitRef);
    const nextStops = view.evidenceStops(unitRef);
    const stop = stage
      ? nextStops.find((candidate) => candidate.stage === stage)
      : (nextStops.find((candidate) => candidate.state === "removed") ??
        nextStops.find((candidate) => candidate.state === "present"));
    if (stop?.checkpoint) {
      setFocus({ spanId: stop.checkpoint.spanId, stage: stop.stage });
    }
  }

  function chooseStage(stage: RagTraceStage) {
    const checkpoint = view.checkpoints.findLast(
      (candidate) => candidate.stage === stage,
    );
    if (checkpoint) {
      setFocus({ spanId: checkpoint.spanId, stage });
      const item = evidenceRef
        ? checkpoint.items.find(
            (candidate) => candidate.unitRef === evidenceRef,
          )
        : undefined;
      if (!item && checkpoint.items[0]) {
        setEvidenceChoice(checkpoint.items[0].unitRef);
      }
    }
  }

  const inspectorTitle = activeFocus.stage
    ? t(`stage.${activeFocus.stage}`)
    : selectedSpan
      ? t(`span.${selectedSpan.kind}`)
      : t("inspector");
  const inspectorJson = selectedSpan
    ? {
        span: selectedSpan,
        checkpoints: selectedCheckpoints,
      }
    : {
        trace: detail.trace,
        spans: view.spans,
        checkpoints: view.checkpoints,
      };
  const logSpans = [...view.spans].sort((left, right) => {
    if (left.startOffsetMs === null) return right.startOffsetMs === null ? left.sequence - right.sequence : 1;
    if (right.startOffsetMs === null) return -1;
    return left.startOffsetMs - right.startOffsetMs || left.sequence - right.sequence;
  });

  return (
    <section className={styles.workspace} aria-labelledby={labelId}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowMark} aria-hidden="true">
            R
          </span>
          <span>{t("eyebrow")}</span>
          <span className={styles.eyebrowRule} aria-hidden="true" />
          <span>{t("traceDetail")}</span>
        </div>
        <div className={styles.headline}>
          <div className={styles.headlineCopy}>
            <h2 id={labelId}>{t("title")}</h2>
            <p>{t("subtitle")}</p>
          </div>
          <div className={styles.badges}>
            <span className={styles.outcome} data-outcome={outcome}>
              {t(`status.${outcome}`)}
            </span>
            <span
              className={styles.captureBadge}
              data-capture={detail.trace.captureState}
            >
              {t(`captureState.${detail.trace.captureState}`)}
            </span>
          </div>
        </div>
        <div className={styles.runMeta}>
          <span className={styles.copyId}>
            <span>{t("requestId")}</span>
            <CopyIdentifier
              label={t("requestId")}
              value={detail.trace.requestId}
            />
          </span>
          <span className={styles.copyId}>
            <span>{t("traceId")}</span>
            <CopyIdentifier label={t("traceId")} value={detail.trace.traceId} />
          </span>
          {detail.trace.runId && (
            <span className={styles.copyId}>
              <span>{t("runId")}</span>
              <CopyIdentifier label={t("runId")} value={detail.trace.runId} />
            </span>
          )}
          <time dateTime={detail.trace.startedAt}>
            {format.dateTime(new Date(detail.trace.startedAt), {
              dateStyle: "medium",
              timeStyle: "medium",
            })}
          </time>
        </div>
      </header>

      <div className={styles.metrics} aria-label={t("overview.title")}>
        <Metric
          label={t("overview.totalLatency")}
          value={duration(detail.trace.durationMs)}
        />
        <Metric
          label={t("overview.firstText")}
          value={duration(detail.trace.firstTextMs)}
        />
        <Metric
          label={t("overview.steps")}
          value={format.number(view.spans.length)}
        />
        <Metric
          label={t("overview.evidence")}
          value={format.number(view.evidence.length)}
        />
      </div>

      <section className={styles.findings} aria-labelledby={findingsId}>
        <div className={styles.findingsHeading}>
          <span className={styles.findingsGlyph} aria-hidden="true">
            !
          </span>
          <h3 id={findingsId}>{t("findings.title")}</h3>
          <span>{t("findings.derivedFromRecordedData")}</span>
        </div>
        <ul>
          {signals.map((signal, index) => (
            <li key={`${signal.tone}-${index}`} data-tone={signal.tone}>
              <span aria-hidden="true" />
              {signal.text}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.journey} aria-labelledby={journeyId}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionOverline}>
              {t("journey.overline")}
            </span>
            <h3 id={journeyId}>{t("journey.title")}</h3>
          </div>
          <p>{t("journey.description")}</p>
        </div>
        <ol className={styles.journeyRail}>
          {stages.map((stage, index) => {
            const checkpoint = view.checkpoints.findLast(
              (candidate) => candidate.stage === stage,
            );
            const active = activeFocus.stage === stage;
            const count = new Set(checkpoint?.items.map((item) => item.unitRef))
              .size;
            return (
              <li
                key={stage}
                data-stage={stage}
                data-present={Boolean(checkpoint)}
                data-active={active}
                data-coverage={checkpoint?.coverage ?? "not_recorded"}
              >
                <button
                  type="button"
                  disabled={!checkpoint}
                  aria-pressed={active}
                  aria-controls={inspectorId}
                  onClick={() => chooseStage(stage)}
                >
                  <span className={styles.journeyIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{t(`stage.${stage}`)}</strong>
                  <span className={styles.journeyMeta}>
                    {checkpoint
                      ? t("journey.evidenceCount", { count })
                      : t("notRecorded")}
                  </span>
                  <span className={styles.journeyCoverage}>
                    {checkpoint
                      ? t(`coverageShort.${checkpoint.coverage}`)
                      : t("coverageShort.not_recorded")}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.evidence} aria-labelledby={evidenceId}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionOverline}>
                  {t("evidenceOverline")}
                </span>
                <h3 id={evidenceId}>{t("evidence")}</h3>
              </div>
              <p>{t("evidenceDescription")}</p>
            </div>
            {view.evidence.length > 0 ? (
              <div className={styles.matrixScroll}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th scope="col">{t("matrix.evidence")}</th>
                      {stages.map((stage) => (
                        <th scope="col" data-stage={stage} key={stage}>
                          {t(`stage.${stage}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.evidence.map((unitRef) => {
                      const unitStops = view.evidenceStops(unitRef);
                      return (
                        <tr
                          key={unitRef}
                          data-selected={unitRef === evidenceRef}
                        >
                          <th scope="row">
                            <button
                              type="button"
                              className={styles.evidenceRef}
                              aria-pressed={unitRef === evidenceRef}
                              onClick={() => chooseEvidence(unitRef)}
                            >
                              <span
                                className={styles.evidenceGlyph}
                                aria-hidden="true"
                              >
                                E
                              </span>
                              <code>{unitRef}</code>
                            </button>
                          </th>
                          {stages.map((stage) => {
                            const stop = unitStops.find(
                              (candidate) => candidate.stage === stage,
                            );
                            const state = stop?.state ?? "not_recorded";
                            const item = stop?.item;
                            const value =
                              item?.citationNumber != null
                                ? t("citationNumber", {
                                    number: item.citationNumber,
                                  })
                                : item?.rank != null && state === "present"
                                  ? t("rank", { number: item.rank })
                                  : t(`evidenceState.${state}`);
                            const pressed = Boolean(
                              stop?.checkpoint &&
                              activeFocus.spanId === stop.checkpoint.spanId &&
                              activeFocus.stage === stage &&
                              evidenceRef === unitRef,
                            );
                            return (
                              <td data-stage={stage} key={stage}>
                                <button
                                  type="button"
                                  className={styles.matrixCell}
                                  data-stage={stage}
                                  data-state={state}
                                  disabled={!stop?.checkpoint}
                                  aria-pressed={pressed}
                                  aria-label={`${unitRef}, ${t(`stage.${stage}`)}: ${value}`}
                                  onClick={() => chooseEvidence(unitRef, stage)}
                                >
                                  <span aria-hidden="true" />
                                  <span>{value}</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>{t("noEvidence")}</p>
            )}
            <p className={styles.matrixNote}>{t("matrix.note")}</p>
          </section>

          <nav className={styles.traceViewTabs} aria-label={t("traceViews.label")}>
            {(["tree", "timeline", "graph", "log"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                data-active={traceMode === mode}
                aria-pressed={traceMode === mode}
                onClick={() => setTraceMode(mode)}
              >
                <span className={styles.viewGlyph} data-view={mode} aria-hidden="true" />
                {t(`traceViews.${mode}`)}
                {mode === "tree" && <span className={styles.tabCount}>{view.spans.length}</span>}
              </button>
            ))}
          </nav>

          {traceMode === "timeline" && <section className={styles.timeline} aria-labelledby={timelineId}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionOverline}>
                  {t("timelineOverline")}
                </span>
                <h3 id={timelineId}>{t("timeline")}</h3>
              </div>
              {shouldShowRuler && (
                <div className={styles.timelineToolbar}>
                  <p>{t("elapsed")}</p>
                  <div className={styles.timelineControls} role="group" aria-label={t("timelineControls.controls")}>
                    <button type="button" aria-label={t("timelineControls.panEarlier")} disabled={timelineWindowStart <= 0} onClick={() => panTimeline(-1)}>←</button>
                    <button type="button" aria-label={t("timelineControls.zoomOut")} disabled={timelineZoom <= 1} onClick={() => zoomTimeline(-1)}>−</button>
                    <span>{format.number(timelineZoom)}×</span>
                    <button type="button" aria-label={t("timelineControls.zoomIn")} disabled={timelineZoom >= 8} onClick={() => zoomTimeline(1)}>+</button>
                    <button type="button" aria-label={t("timelineControls.panLater")} disabled={timelineWindowStart >= maxTimelineOffset} onClick={() => panTimeline(1)}>→</button>
                    <button type="button" onClick={fitTimeline}>{t("timelineControls.fit")}</button>
                    <button
                      type="button"
                      disabled={!selectedSpan || selectedSpan.startOffsetMs === null}
                      onClick={zoomToSelectedSpan}
                    >
                      {t("timelineControls.toSelection")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {view.spans.length > 0 ? (
              <div className={styles.timelineGrid}>
                {shouldShowRuler && (
                  <div className={styles.ruler} aria-hidden="true">
                    <span className={styles.rulerTicks}>
                          {rulerTicks.map((tick) => (
                        <span key={tick}>
                              {rulerDuration(
                                timelineWindowStart +
                                  (timelineWindowDuration * tick) / 4,
                              )}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <ol className={styles.rows} aria-label={t("timeline")}>
                  {view.spans.map((span) => {
                    const start = span.startOffsetMs;
                    const length = span.durationMs;
                    const scaled =
                      shouldShowRuler && start !== null && length !== null;
                    const overlapsTimeline =
                      scaled &&
                      start <= timelineWindowEnd &&
                      start + length >= timelineWindowStart;
                    const clippedStart =
                      scaled && overlapsTimeline
                        ? Math.max(start, timelineWindowStart)
                        : 0;
                    const clippedEnd =
                      scaled && overlapsTimeline
                        ? Math.min(start + length, timelineWindowEnd)
                        : 0;
                    const selected = activeFocus.spanId === span.spanId;
                    const spanCheckpoint = view.checkpoints.find(
                      (checkpoint) => checkpoint.spanId === span.spanId,
                    );
                    return (
                      <li key={span.spanId}>
                        <button
                          type="button"
                          ref={(button) => {
                            if (button)
                              rowRefs.current.set(span.spanId, button);
                            else rowRefs.current.delete(span.spanId);
                          }}
                          className={styles.row}
                          data-kind={span.kind}
                          data-status={span.status}
                          data-timed={shouldShowRuler}
                          aria-label={t("timelineRow", {
                            step: t(`span.${span.kind}`),
                            status: t(`status.${span.status}`),
                            duration: duration(length),
                          })}
                          aria-controls={inspectorId}
                          aria-pressed={selected}
                          onClick={() => setFocus({ spanId: span.spanId })}
                        >
                          <span
                            className={styles.step}
                            style={{
                              paddingInlineStart:
                                Math.min(view.depth(span), 4) * 14,
                            }}
                          >
                            <span
                              className={styles.stepNode}
                              aria-hidden="true"
                            />
                            <span className={styles.stepCopy}>
                              <strong>{t(`span.${span.kind}`)}</strong>
                              <small>{t(`status.${span.status}`)}</small>
                            </span>
                          </span>
                          {shouldShowRuler && scaled && overlapsTimeline ? (
                            <span className={styles.track}>
                              <span
                                className={styles.bar}
                                role="img"
                                data-zero={length === 0}
                                style={{
                                  insetInlineStart: `${((clippedStart - timelineWindowStart) / timelineWindowDuration) * 100}%`,
                                  inlineSize: `${((clippedEnd - clippedStart) / timelineWindowDuration) * 100}%`,
                                }}
                                aria-label={t("timingRange", {
                                  start: duration(start),
                                  end: duration(start + length),
                                })}
                              />
                            </span>
                          ) : shouldShowRuler && !scaled ? (
                            <span className={styles.missing}>
                              {t("notRecorded")}
                            </span>
                          ) : shouldShowRuler ? (
                            <span className={styles.missing}>{t("timelineControls.outsideWindow")}</span>
                          ) : null}
                          <span className={styles.rowMeta}>
                            {spanCheckpoint && (
                              <small>
                                {t("timelineMeta.checkpoints", {
                                  count: spanCheckpoint.items.length,
                                })}
                              </small>
                            )}
                            <strong>{duration(length)}</strong>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <p className={styles.empty}>{t("noSpans")}</p>
            )}
          </section>}

          {traceMode === "tree" && (
            <section className={styles.traceView} aria-labelledby={timelineId}>
              <div className={styles.traceViewHeading}>
                <div>
                  <span className={styles.sectionOverline}>{t("traceViews.tree")}</span>
                  <h3 id={timelineId}>{t("journey.title")}</h3>
                </div>
                <span>{t("timelineMeta.checkpoints", { count: view.checkpoints.length })}</span>
              </div>
              {view.spans.length > 0 ? (
                <ol className={styles.treeRows} aria-label={t("traceViews.tree")}>
                  {view.spans.map((span) => {
                    const selected = activeFocus.spanId === span.spanId;
                    const checkpointCount = view.checkpoints.filter(
                      (checkpoint) => checkpoint.spanId === span.spanId,
                    ).length;
                    return (
                      <li key={span.spanId} data-depth={view.depth(span)}>
                        <button
                          type="button"
                          ref={(button) => {
                            if (button) rowRefs.current.set(span.spanId, button);
                            else rowRefs.current.delete(span.spanId);
                          }}
                          className={styles.treeRow}
                          data-kind={span.kind}
                          data-selected={selected}
                          aria-label={t("timelineRow", {
                            step: t(`span.${span.kind}`),
                            status: t(`status.${span.status}`),
                            duration: duration(span.durationMs),
                          })}
                          aria-controls={inspectorId}
                          aria-pressed={selected}
                          onClick={() => setFocus({ spanId: span.spanId })}
                        >
                          <span className={styles.treeIndent} style={{ inlineSize: Math.min(view.depth(span), 4) * 1.2 + 0.45 + "rem" }} aria-hidden="true">
                            {view.depth(span) > 0 && <span />}
                          </span>
                          <span className={styles.treeNode} data-kind={span.kind} aria-hidden="true" />
                          <span className={styles.treeCopy}>
                            <strong>{t(`span.${span.kind}`)}</strong>
                            <small>{span.spanId}{span.parentSpanId ? ` · ${t("parentSpan")}: ${span.parentSpanId}` : " · root"}</small>
                          </span>
                          <span className={styles.treeStatus} data-status={span.status}>{t(`status.${span.status}`)}</span>
                          {checkpointCount > 0 && <span className={styles.treeCheckpoint}>{t("timelineMeta.checkpoints", { count: checkpointCount })}</span>}
                          <strong className={styles.treeDuration}>{duration(span.durationMs)}</strong>
                          <span className={styles.treeChevron} aria-hidden="true">›</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className={styles.empty}>{t("noSpans")}</p>}
            </section>
          )}

          {traceMode === "graph" && (
            <section className={styles.traceView} aria-labelledby={timelineId}>
              <div className={styles.traceViewHeading}>
                <div>
                  <span className={styles.sectionOverline}>{t("traceViews.graph")}</span>
                  <h3 id={timelineId}>{t("journey.title")}</h3>
                </div>
                <span>{t("traceViews.graphDescription")}</span>
              </div>
              {view.spans.length > 0 ? (
                <ol className={styles.graphRows} aria-label={t("traceViews.graphDescription")}>
                  {view.spans.map((span) => {
                    const selected = activeFocus.spanId === span.spanId;
                    return (
                      <li key={span.spanId} data-depth={view.depth(span)}>
                        <span className={styles.graphWire} aria-hidden="true" />
                        <button
                          type="button"
                          className={styles.graphNode}
                          data-selected={selected}
                          data-kind={span.kind}
                          aria-label={t("timelineRow", {
                            step: t(`span.${span.kind}`),
                            status: t(`status.${span.status}`),
                            duration: duration(span.durationMs),
                          })}
                          aria-controls={inspectorId}
                          aria-pressed={selected}
                          onClick={() => setFocus({ spanId: span.spanId })}
                        >
                          <span className={styles.graphNodeTop}>
                            <strong>{t(`span.${span.kind}`)}</strong>
                            <span data-status={span.status}>{t(`status.${span.status}`)}</span>
                          </span>
                          <code>{span.spanId}</code>
                          <span className={styles.graphNodeBottom}>
                            <small>{span.parentSpanId ? `${t("parentSpan")}: ${span.parentSpanId}` : t("traceViews.rootObservation")}</small>
                            <b>{duration(span.durationMs)}</b>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className={styles.empty}>{t("noSpans")}</p>}
            </section>
          )}

          {traceMode === "log" && (
            <section className={styles.traceView} aria-labelledby={timelineId}>
              <div className={styles.traceViewHeading}>
                <div>
                  <span className={styles.sectionOverline}>{t("traceViews.log")}</span>
                  <h3 id={timelineId}>{t("traceViews.logDescription")}</h3>
                </div>
                <span>{view.spans.length} · {t("overview.steps").toLowerCase()}</span>
              </div>
              {logSpans.length > 0 ? (
                <ol className={styles.logRows} aria-label={t("traceViews.logDescription")}>
                  {logSpans.map((span) => {
                    const selected = activeFocus.spanId === span.spanId;
                    const checkpointCount = view.checkpoints.filter((checkpoint) => checkpoint.spanId === span.spanId).length;
                    return (
                      <li key={span.spanId}>
                        <button
                          type="button"
                          data-selected={selected}
                          aria-pressed={selected}
                          aria-controls={inspectorId}
                          aria-label={t("timelineRow", {
                            step: t(`span.${span.kind}`),
                            status: t(`status.${span.status}`),
                            duration: duration(span.durationMs),
                          })}
                          onClick={() => setFocus({ spanId: span.spanId })}
                        >
                          <code>{span.startOffsetMs === null ? t("notRecorded") : `+${duration(span.startOffsetMs)}`}</code>
                          <span className={styles.logMark} data-status={span.status} aria-hidden="true" />
                          <strong>{t(`span.${span.kind}`)}</strong>
                          <span className={styles.logId}>{span.spanId}</span>
                          <span className={styles.logState} data-status={span.status}>{t(`status.${span.status}`)}</span>
                          {checkpointCount > 0 && <small>{t("timelineMeta.checkpoints", { count: checkpointCount })}</small>}
                          <b>{duration(span.durationMs)}</b>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className={styles.empty}>{t("noSpans")}</p>}
            </section>
          )}
        </div>

        <aside className={styles.inspector} aria-labelledby={inspectorId}>
          <div className={styles.inspectorTop}>
            <span className={styles.sectionOverline}>
              {t("inspectorKicker")}
            </span>
            <h3 id={inspectorId}>{inspectorTitle}</h3>
            {selectedSpan && (
              <code className={styles.inspectorId}>{selectedSpan.spanId}</code>
            )}
          </div>
          <nav className={styles.inspectorTabs} aria-label={t("traceViews.inspectorTabs")}>
            {(["preview", "json"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={inspectorMode === mode}
                aria-pressed={inspectorMode === mode}
                onClick={() => setInspectorMode(mode)}
              >
                {t(`traceViews.${mode}`)}
              </button>
            ))}
          </nav>
          {inspectorMode === "preview" ? (
            <>
          {evidenceRef && (
            <div className={styles.focusEvidence}>
              <span>{t("evidenceRef")}</span>
              <code>{evidenceRef}</code>
            </div>
          )}
          {selectedCheckpoint && (
            <section className={styles.inspectorSection}>
              <h4>{t(`stage.${selectedCheckpoint.stage}`)}</h4>
              <div
                className={styles.inspectorState}
                data-state={checkpointState(selectedCheckpoint, selectedItem)}
              >
                <span aria-hidden="true" />
                {t(
                  `evidenceState.${checkpointState(selectedCheckpoint, selectedItem)}`,
                )}
              </div>
              {selectedItem?.reason && (
                <p className={styles.reason}>
                  {t(`reason.${selectedItem.reason}`)}
                </p>
              )}
              {selectedCheckpoint.coverage !== "complete" && (
                <p className={styles.coverageNote}>
                  {t(`coverage.${selectedCheckpoint.coverage}`)}
                </p>
              )}
              {selectedItem && (
                <dl className={styles.facts}>
                  {selectedItem.rank != null && (
                    <div>
                      <dt>{t("rankLabel")}</dt>
                      <dd>{format.number(selectedItem.rank)}</dd>
                    </div>
                  )}
                  {selectedItem.citationNumber != null && (
                    <div>
                      <dt>{t("citationLabel")}</dt>
                      <dd>[{format.number(selectedItem.citationNumber)}]</dd>
                    </div>
                  )}
                  {selectedItem.versionRef && (
                    <div>
                      <dt>{t("versionRef")}</dt>
                      <dd>
                        <code>{selectedItem.versionRef}</code>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          )}
          {selectedSpan ? (
            <section className={styles.inspectorSection}>
              <h4>{t("spanDetails")}</h4>
              <dl className={styles.facts}>
                <div>
                  <dt>{t("stepStatus")}</dt>
                  <dd>{t(`status.${selectedSpan.status}`)}</dd>
                </div>
                <div>
                  <dt>{t("start")}</dt>
                  <dd>{duration(selectedSpan.startOffsetMs)}</dd>
                </div>
                <div>
                  <dt>{t("duration")}</dt>
                  <dd>{duration(selectedSpan.durationMs)}</dd>
                </div>
                {selectedSpan.parentSpanId && (
                  <div>
                    <dt>{t("parentSpan")}</dt>
                    <dd>
                      <code>{selectedSpan.parentSpanId}</code>
                    </dd>
                  </div>
                )}
                {selectedSpan.reason && (
                  <div>
                    <dt>{t("reasonLabel")}</dt>
                    <dd>{t(`reason.${selectedSpan.reason}`)}</dd>
                  </div>
                )}
              </dl>
            </section>
          ) : (
            <p className={styles.empty}>{t("noSpanTiming")}</p>
          )}
          <p className={styles.privacyNote}>{t("privacyNote")}</p>
          {retrievalSpan && retrievalSpan.spanId !== activeFocus.spanId && (
            <button
              type="button"
              className={styles.jump}
              onClick={() => {
                setFocus({
                  spanId: retrievalSpan.spanId,
                  stage: "retrieval_selected",
                });
                rowRefs.current.get(retrievalSpan.spanId)?.focus();
              }}
            >
              {t("jumpToRetrieval")}
            </button>
          )}
            </>
          ) : (
            <section className={styles.jsonInspector} aria-label={t("traceViews.json")}>
              <p>{t("traceViews.jsonUnavailable")}</p>
              <pre>{JSON.stringify(inspectorJson, null, 2)}</pre>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
