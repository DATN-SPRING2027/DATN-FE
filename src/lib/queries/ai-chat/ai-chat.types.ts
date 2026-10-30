export type AiChatThread = Readonly<{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}>;

export type AiChatCitation = Readonly<{
  number: number;
  sourceId: string;
  sourceName?: string;
  documentId: string;
  documentName?: string;
  versionNo?: number;
  heading?: string;
  snippet?: string;
  label?: string;
  pageFrom?: number;
  pageTo?: number;
  mapped?: boolean;
  claimLevel?: "claim" | "run";
}>;

export type AiChatSessionCitation = Readonly<{
  ref: string;
  source: "selected_group" | "recent_continuity";
  groupId: string | null;
  turnIds: readonly string[];
  turnRange?: readonly [number, number];
  summaryExcerpt: string;
  mapped?: boolean;
  claimLevel?: "claim" | "run";
}>;

export type AiChatRetrievalStep = Readonly<{
  kind: "session_context" | "tool" | "thinking" | "answer";
  label: string;
  durationMs: number;
  count?: number;
  mode?: string;
}>;

export type AiChatMessage = Readonly<{
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "ok" | "failed" | "cancelled";
  errorCode?: string;
  citations: readonly AiChatCitation[];
  sessionCitations: readonly AiChatSessionCitation[];
  retrievalSteps: readonly AiChatRetrievalStep[];
  createdAt: string;
}>;

export type AiChatMessagePage = Readonly<{
  items: readonly AiChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

export type AiChatStartedEventData = Readonly<{
  runId: string;
  threadId: string;
  userMessageId?: string;
}>;

export type AiChatDeltaEventData = Readonly<{
  text: string;
}>;

export type AiChatCompletedEventData = Readonly<{
  messageId: string;
  content: string;
  answerStatus: "answered" | "no_answer";
  citations: readonly AiChatCitation[];
  sessionCitations: readonly AiChatSessionCitation[];
  retrievalSteps: readonly AiChatRetrievalStep[];
}>;

export type AiChatFailedEventData = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
  messageId?: string;
}>;

export type AiChatStreamEvent =
  | Readonly<{ event: "started"; data: AiChatStartedEventData }>
  | Readonly<{ event: "step"; data: AiChatRetrievalStep }>
  | Readonly<{ event: "delta"; data: AiChatDeltaEventData }>
  | Readonly<{ event: "completed"; data: AiChatCompletedEventData }>
  | Readonly<{ event: "failed"; data: AiChatFailedEventData }>;
