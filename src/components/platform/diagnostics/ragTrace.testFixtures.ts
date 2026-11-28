import type { RagTraceDetail } from "./ragTrace.types";

export const trimmedTrace: RagTraceDetail = {
  schemaVersion: 1,
  trace: {
    traceId: "trace_fixture_trimmed",
    requestId: "req_fixture_trimmed",
    runId: "run_fixture_trimmed",
    startedAt: "2026-11-27T00:01:00Z",
    runtimeState: "completed",
    answerStatus: "no_answer",
    captureState: "partial",
    durationMs: 1000,
    firstTextMs: null,
  },
  spans: [
    {
      spanId: "retrieve",
      parentSpanId: "request",
      sequence: 2,
      kind: "retrieval",
      startOffsetMs: 100,
      durationMs: 400,
      status: "completed",
    },
    {
      spanId: "request",
      parentSpanId: null,
      sequence: 0,
      kind: "request",
      startOffsetMs: 0,
      durationMs: 1000,
      status: "completed",
    },
    {
      spanId: "route",
      parentSpanId: "request",
      sequence: 1,
      kind: "routing",
      startOffsetMs: 0,
      durationMs: 100,
      status: "completed",
    },
    {
      spanId: "rank",
      parentSpanId: "retrieve",
      sequence: 3,
      kind: "ranking",
      startOffsetMs: 200,
      durationMs: 100,
      status: "completed",
    },
    {
      spanId: "pack",
      parentSpanId: "request",
      sequence: 4,
      kind: "evidence_pack",
      startOffsetMs: 500,
      durationMs: 125,
      status: "completed",
    },
    {
      spanId: "input",
      parentSpanId: "request",
      sequence: 5,
      kind: "model_input",
      startOffsetMs: 625,
      durationMs: 125,
      status: "completed",
    },
    {
      spanId: "gen",
      parentSpanId: "request",
      sequence: 6,
      kind: "generation",
      startOffsetMs: 750,
      durationMs: 250,
      status: "completed",
      reason: "insufficient_evidence",
    },
  ],
  checkpoints: [
    {
      spanId: "retrieve",
      stage: "retrieval_selected",
      coverage: "complete",
      items: [
        {
          unitRef: "E-42",
          disposition: "present",
          rank: 1,
          versionRef: "V-03",
        },
        { unitRef: "E-17", disposition: "present", rank: 2 },
      ],
    },
    {
      spanId: "pack",
      stage: "tool_pack",
      coverage: "complete",
      items: [
        { unitRef: "E-42", disposition: "present" },
        { unitRef: "E-17", disposition: "removed", reason: "context_budget" },
      ],
    },
    {
      spanId: "input",
      stage: "model_input",
      coverage: "complete",
      items: [
        {
          unitRef: "E-42",
          disposition: "removed",
          reason: "context_window_trim",
        },
      ],
    },
    {
      spanId: "gen",
      stage: "final_citation",
      coverage: "not_recorded",
      items: [],
    },
  ],
};

export const answeredTrace: RagTraceDetail = {
  ...trimmedTrace,
  trace: {
    ...trimmedTrace.trace,
    traceId: "trace_fixture_answered",
    requestId: "req_fixture_answered",
    runId: "run_fixture_answered",
    answerStatus: "answered",
    captureState: "recorded",
    firstTextMs: 930,
  },
  spans: trimmedTrace.spans.map((span) =>
    span.kind === "generation" ? { ...span, reason: undefined } : span,
  ),
  checkpoints: [
    {
      spanId: "retrieve",
      stage: "retrieval_candidates",
      coverage: "complete",
      items: [{ unitRef: "E-90", disposition: "present" }],
    },
    {
      spanId: "retrieve",
      stage: "retrieval_selected",
      coverage: "complete",
      items: [{ unitRef: "E-90", disposition: "present", rank: 1 }],
    },
    {
      spanId: "pack",
      stage: "tool_pack",
      coverage: "complete",
      items: [{ unitRef: "E-90", disposition: "present" }],
    },
    {
      spanId: "input",
      stage: "model_input",
      coverage: "complete",
      items: [{ unitRef: "E-90", disposition: "present" }],
    },
    {
      spanId: "gen",
      stage: "final_citation",
      coverage: "complete",
      items: [{ unitRef: "E-90", disposition: "present", citationNumber: 2 }],
    },
  ],
};
