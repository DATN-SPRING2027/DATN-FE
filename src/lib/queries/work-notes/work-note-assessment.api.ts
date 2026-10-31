import { apiClient } from "@/lib/api-client";
import { csrfHeaders } from "./useWorkNotes";
import type { AgentResponse } from "./work-note-agent.api";
import type {
  AssessmentView,
  AssessmentInput,
  AssessmentReply,
  AssessmentCorrection,
  AssessmentReset,
  AssessmentMutation,
} from "./work-note-assessment.types";
export type AssessmentFeedbackCategory = NonNullable<
  AssessmentView["feedback"]
>[number]["category"];
const root = (projectId: string, draftId: string) =>
  `/capture/projects/${encodeURIComponent(projectId)}/work-note-drafts/${encodeURIComponent(draftId)}/agent/assessments`;
const mutate = <T>(path: string, value: unknown) =>
  apiClient<T>(path, {
    method: "POST",
    headers: csrfHeaders(),
    body: JSON.stringify(value),
  });
const path = (p: string, d: string, a: string, action: string) =>
  `${root(p, d)}/${encodeURIComponent(a)}/${action}`;
export const assessmentApi = {
  assess: (p: string, d: string, value: AssessmentInput) =>
    mutate<AssessmentView>(root(p, d), value),
  reply: (p: string, d: string, a: string, value: AssessmentReply) =>
    mutate<AssessmentView>(path(p, d, a, "replies"), value),
  rewrite: (p: string, d: string, a: string, value: AssessmentMutation) =>
    mutate<AgentResponse>(path(p, d, a, "rewrite"), value),
  correct: (p: string, d: string, a: string, value: AssessmentCorrection) =>
    mutate<AssessmentView>(path(p, d, a, "corrections"), value),
  reset: (p: string, d: string, a: string, value: AssessmentReset) =>
    mutate<AssessmentView>(path(p, d, a, "reset"), value),
  validateAuthor: (
    p: string,
    d: string,
    a: string,
    value: AssessmentMutation,
  ) => mutate<AssessmentView>(path(p, d, a, "validate-author"), value),
  feedback: (
    p: string,
    d: string,
    a: string,
    value: AssessmentMutation & { category: AssessmentFeedbackCategory },
  ) => mutate<AssessmentView>(path(p, d, a, "feedback"), value),
};
