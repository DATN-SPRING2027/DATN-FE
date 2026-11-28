import type {
  RagTraceCheckpoint,
  RagTraceDetail,
  RagTraceEvidence,
  RagTraceSpan,
  RagTraceStage,
} from "./ragTrace.types";

type EvidenceState =
  "present" | "removed" | "not_observed" | "incomplete" | "not_recorded";

interface EvidenceStop {
  stage: RagTraceStage;
  state: EvidenceState;
  checkpoint?: RagTraceCheckpoint;
  item?: RagTraceEvidence;
  sequence: number | undefined;
}

const stages: readonly RagTraceStage[] = [
  "retrieval_candidates",
  "retrieval_selected",
  "tool_pack",
  "model_input",
  "final_citation",
];

export function createTraceView(detail: RagTraceDetail) {
  const spans = [...detail.spans].sort((a, b) => a.sequence - b.sequence);
  const spanById = new Map(spans.map((span) => [span.spanId, span]));
  const order = (checkpoint: RagTraceCheckpoint) =>
    spanById.get(checkpoint.spanId)?.sequence ?? Number.MAX_SAFE_INTEGER;
  const checkpoints = [...detail.checkpoints].sort(
    (a, b) => order(a) - order(b),
  );
  const evidence = new Set<string>();
  let firstRemoved: { spanId: string; unitRef: string } | undefined;
  for (const checkpoint of checkpoints) {
    for (const item of checkpoint.items) {
      evidence.add(item.unitRef);
      if (item.disposition === "removed" && !firstRemoved) {
        firstRemoved = { spanId: checkpoint.spanId, unitRef: item.unitRef };
      }
    }
  }

  const timingEnd = Math.max(
    detail.trace.durationMs ?? 0,
    ...spans.map((span) =>
      span.startOffsetMs === null
        ? 0
        : span.startOffsetMs + (span.durationMs ?? 0),
    ),
  );

  function depth(span: RagTraceSpan): number {
    const seen = new Set([span.spanId]);
    let parentId = span.parentSpanId;
    while (parentId && !seen.has(parentId)) {
      const parent = spanById.get(parentId);
      if (!parent) break;
      seen.add(parentId);
      parentId = parent.parentSpanId;
    }
    return seen.size - 1;
  }

  function evidenceStops(unitRef: string): EvidenceStop[] {
    return stages.flatMap((stage) => {
      const atStage = checkpoints.filter(
        (checkpoint) => checkpoint.stage === stage,
      );
      if (stage === "retrieval_candidates" && atStage.length === 0) return [];
      const observed = atStage
        .map((checkpoint) => ({
          checkpoint,
          item: checkpoint.items.find((item) => item.unitRef === unitRef),
        }))
        .findLast(({ item }) => item !== undefined);
      const checkpoint = observed?.checkpoint ?? atStage.at(-1);
      const item = observed?.item;
      const state: EvidenceState =
        item?.disposition ??
        (!checkpoint || checkpoint.coverage === "not_recorded"
          ? "not_recorded"
          : checkpoint.coverage === "complete"
            ? "not_observed"
            : "incomplete");
      return [
        {
          stage,
          state,
          checkpoint,
          item,
          sequence: checkpoint && spanById.get(checkpoint.spanId)?.sequence,
        },
      ];
    });
  }

  return {
    spans,
    checkpoints,
    evidence: [...evidence],
    timingEnd,
    depth,
    evidenceStops,
    initialEvidence: firstRemoved?.unitRef ?? evidence.values().next().value,
    initialSpan:
      (firstRemoved && spanById.get(firstRemoved.spanId)) ??
      spans.find((span) => span.status === "failed") ??
      spans.find((span) => span.kind !== "request") ??
      spans[0],
  };
}

export function connectsEvidence(previous: EvidenceStop, next: EvidenceStop) {
  return (
    previous.state === "present" &&
    (next.state === "present" || next.state === "removed") &&
    previous.sequence !== undefined &&
    next.sequence !== undefined &&
    previous.sequence <= next.sequence
  );
}
