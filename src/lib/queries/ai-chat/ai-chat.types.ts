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
  replyToMessageId?: string;
  regeneratedFromMessageId?: string;
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
  replyToMessageId?: string;
  regeneratedFromMessageId?: string;
}>;

export type AiChatFailedEventData = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
  messageId?: string;
  replyToMessageId?: string;
  regeneratedFromMessageId?: string;
}>;

export type AiChatStreamEvent =
  | Readonly<{ event: "started"; data: AiChatStartedEventData }>
  | Readonly<{ event: "step"; data: AiChatRetrievalStep }>
  | Readonly<{ event: "delta"; data: AiChatDeltaEventData }>
  | Readonly<{ event: "completed"; data: AiChatCompletedEventData }>
  | Readonly<{ event: "failed"; data: AiChatFailedEventData }>;

export type AiAnswerRating = "LIKE" | "DISLIKE";

export type AiDislikeReasonCategory =
  | "INACCURATE"
  | "OUTDATED"
  | "IRRELEVANT_CITATION"
  | "INCOMPLETE"
  | "OTHER";

export type AiAnswerFeedbackInput =
  | Readonly<{
      rating: "LIKE";
    }>
  | Readonly<{
      rating: "DISLIKE";
      reasonCategory: AiDislikeReasonCategory;
      reasonText?: string;
    }>;

export type AiAnswerFeedback = Readonly<{
  messageId: string;
  rating: AiAnswerRating;
  reasonCategory?: AiDislikeReasonCategory;
  reasonText?: string;
  updatedAt: string;
}>;

export type AiOwnAnswerFeedback = Readonly<{
  feedback: AiAnswerFeedback | null;
}>;

export type AiAnswerShare = Readonly<{
  id: string;
  projectId: string;
  messageId: string;
  createdAt: string;
}>;

export type AiPublicAnswer = Readonly<{
  id: string;
  content: string;
  citations: readonly AiChatCitation[];
}>;

export type AiSharedQuestion = Readonly<{
  content: string;
}>;

export type AiSharedAnswer = Readonly<{
  share: AiAnswerShare;
  question: AiSharedQuestion;
  answer: AiPublicAnswer;
}>;
