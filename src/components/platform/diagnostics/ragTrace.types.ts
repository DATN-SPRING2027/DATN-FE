// Projection from platform-rag-trace-draft.openapi.yaml (proposed, v1).
export type RagTraceRuntimeState =
  "running" | "completed" | "failed" | "cancelled" | "interrupted";

export type RagTraceReason =
  | "insufficient_evidence"
  | "empty_evidence"
  | "weak_evidence"
  | "context_budget"
  | "context_window_trim"
  | "timeout"
  | "fallback"
  | "provider_error"
  | "citation_validation"
  | "other";

export type RagTraceStage =
  | "retrieval_candidates"
  | "retrieval_selected"
  | "tool_pack"
  | "model_input"
  | "final_citation";

export type RagTraceCoverage =
  "complete" | "partial" | "truncated" | "not_recorded";

export type RagTraceEvidence = Readonly<{
  unitRef: string;
  versionRef?: string | null;
  rank?: number | null;
  citationNumber?: number | null;
}> &
  (
    | Readonly<{ disposition: "present"; reason?: RagTraceReason }>
    | Readonly<{ disposition: "removed"; reason: RagTraceReason }>
  );

export interface RagTraceCheckpoint {
  readonly spanId: string;
  readonly stage: RagTraceStage;
  readonly coverage: RagTraceCoverage;
  readonly items: readonly RagTraceEvidence[];
}

export interface RagTraceSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly sequence: number;
  readonly kind:
    | "request"
    | "authorization"
    | "routing"
    | "retrieval"
    | "ranking"
    | "tool"
    | "evidence_pack"
    | "model_input"
    | "generation"
    | "citation";
  readonly startOffsetMs: number | null;
  readonly durationMs: number | null;
  readonly status: RagTraceRuntimeState;
  readonly reason?: RagTraceReason;
}

export interface RagTraceSummary {
  readonly traceId: string;
  readonly requestId: string;
  readonly runId: string | null;
  readonly startedAt: string;
  readonly runtimeState: RagTraceRuntimeState;
  readonly answerStatus: "answered" | "no_answer" | null;
  readonly captureState: "recorded" | "partial" | "truncated";
  readonly durationMs: number | null;
  readonly firstTextMs: number | null;
}

export interface RagTraceDetail {
  readonly schemaVersion: 1;
  readonly trace: RagTraceSummary;
  readonly spans: readonly RagTraceSpan[];
  readonly checkpoints: readonly RagTraceCheckpoint[];
}
