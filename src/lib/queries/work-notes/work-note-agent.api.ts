import { apiClient } from "@/lib/api-client";
import { csrfHeaders, type TaskNote, type WorkNotesPage } from "./useWorkNotes";
import type { AssessmentView } from "./work-note-assessment.types";
export type AgentOperation =
  | "grammar"
  | "clarify"
  | "shorten"
  | "restructure"
  | "tone"
  | "handover"
  | "title"
  | "custom";
export type SelectionAnchor = { start: number; end: number; quote: string };
export type AgentSuggestion = {
  id: string;
  scope: "whole_note" | "selection";
  operation: AgentOperation;
  baseRevision: number;
  replacementText: string | null;
  suggestedTitle: string | null;
  changeSummary: readonly string[];
  selection?: SelectionAnchor;
};
export type AgentQuestion = {
  id: string;
  text: string;
  reason: string;
  options: readonly string[];
};
export type AgentDraft = {
  id: string;
  taskId: string;
  noteId: string | null;
  workflow: "TASK_NOTE" | "PROJECT_DOCUMENT" | "WORK_REPORT";
  resourceId?: string | null;
  context?: Record<string, unknown>;
  baseContentHash?: string;
  baseNoteVersion: number;
  revision: number;
  title: string;
  contentMarkdown: string;
  expiresAt: string;
  hasAppliedRewrite: boolean;
  conversation: readonly { role: "user" | "assistant"; content: string }[];
  pendingQuestion: AgentQuestion | null;
  suggestion: AgentSuggestion | null;
  assessment?: AssessmentView | null;
};
export type AgentResponse = {
  status: "ANSWER" | "CLARIFICATION_REQUIRED" | "SUGGESTION_READY";
  message: string;
  suggestion: AgentSuggestion | null;
  questions: readonly AgentQuestion[];
  uncertainties: readonly string[];
  sourceRevision: number;
};
export type AgentMessageInput = {
  operationId: string;
  expectedRevision: number;
  operation: AgentOperation;
  scope: "whole_note" | "selection";
  instruction: string;
  includeWholeNoteContext: boolean;
  selection?: SelectionAnchor;
  replyToQuestionId?: string;
  questionDisposition?: "answered" | "skipped";
  answer?: string;
};
type RevisionOperation = { operationId: string; expectedRevision: number };
const root = (p: string) =>
  `/capture/projects/${encodeURIComponent(p)}/work-note-drafts`;
const draftPath = (p: string, id: string) =>
  `${root(p)}/${encodeURIComponent(id)}`;
const mutate = <T>(path: string, method: string, value: unknown) =>
  apiClient<T>(path, {
    method,
    headers: csrfHeaders(),
    body: JSON.stringify(value),
  });
export const agentApi = {
  resume: (p: string, task: string, note?: string, signal?: AbortSignal) =>
    apiClient<AgentDraft | null>(
      `${root(p)}?${new URLSearchParams({ taskId: task, ...(note ? { noteId: note } : {}) })}`,
      { signal },
    ),
  create: (
    p: string,
    value: { operationId: string; taskId: string; noteId?: string },
  ) => mutate<AgentDraft>(root(p), "POST", value),
  update: (
    p: string,
    id: string,
    value: RevisionOperation & { title: string; contentMarkdown: string },
  ) => mutate<AgentDraft>(draftPath(p, id), "PATCH", value),
  message: (p: string, id: string, value: AgentMessageInput) =>
    mutate<AgentResponse>(`${draftPath(p, id)}/agent/messages`, "POST", value),
  apply: (
    p: string,
    id: string,
    suggestion: string,
    value: RevisionOperation & {
      action:
        "replace_body" | "replace_selection" | "insert_after" | "replace_title";
      applyTitle: boolean;
    },
  ) =>
    mutate<AgentDraft>(
      `${draftPath(p, id)}/agent/suggestions/${encodeURIComponent(suggestion)}/apply`,
      "POST",
      value,
    ),
  reset: (p: string, id: string, value: RevisionOperation) =>
    mutate<AgentDraft>(`${draftPath(p, id)}/reset-chat`, "POST", value),
  discard: (
    p: string,
    id: string,
    value: { expectedRevision: number; discardConfirmed: true },
  ) => mutate<void>(draftPath(p, id), "DELETE", value),
  save: (
    p: string,
    id: string,
    value: RevisionOperation & { discardOriginalConfirmed: boolean },
  ) =>
    mutate<Omit<TaskNote, "accomplishments" | "approach" | "reason">>(
      `${draftPath(p, id)}/save`,
      "POST",
      value,
    ),
  versions: (p: string, task: string, note: string, page = 1) =>
    apiClient<
      WorkNotesPage<{
        versionNumber: number;
        title: string;
        contentMarkdown: string;
        createdAt: string;
      }>
    >(
      `/capture/projects/${encodeURIComponent(p)}/tasks/${encodeURIComponent(task)}/notes/${encodeURIComponent(note)}/versions?page=${page}&pageSize=20`,
    ),
  restore: (
    p: string,
    task: string,
    note: string,
    value: {
      operationId: string;
      expectedVersion: number;
      versionNumber: number;
      expectedContentHash?: string;
    },
  ) =>
    mutate<TaskNote>(
      `/capture/projects/${encodeURIComponent(p)}/tasks/${encodeURIComponent(task)}/notes/${encodeURIComponent(note)}/restore`,
      "POST",
      value,
    ),
};

export type EditorSourceIdentity =
  | {
      workflow: "PROJECT_DOCUMENT";
      resourceId?: string;
      documentType?: import("./useWorkNotes").DocumentType;
    }
  | { workflow: "WORK_REPORT"; resourceId: string };
type EditorWireDraft = Omit<
  AgentDraft,
  "taskId" | "noteId" | "baseNoteVersion"
> & { baseVersion: number };
function normalizeEditorDraft(d: EditorWireDraft): AgentDraft {
  return {
    ...d,
    taskId: "",
    noteId: d.resourceId ?? null,
    baseNoteVersion: d.baseVersion,
  };
}
/** Workflow routing only. Source authority and period identity remain on the backend. */
export function editorAgentApi(source: EditorSourceIdentity) {
  const base = (p: string) =>
    `/capture/projects/${encodeURIComponent(p)}/editor-drafts`;
  const path = (p: string, id: string) =>
    `${base(p)}/${encodeURIComponent(id)}`;
  const update = async (
    p: string,
    id: string,
    v: Parameters<typeof agentApi.update>[2],
  ) =>
    normalizeEditorDraft(
      await mutate<EditorWireDraft>(path(p, id), "PATCH", v),
    );
  return {
    ...agentApi,
    resume: async (
      p: string,
      _task: string,
      _note?: string,
      signal?: AbortSignal,
    ) => {
      const query = new URLSearchParams({
        workflow: source.workflow,
        ...(source.resourceId
          ? { resourceId: source.resourceId }
          : source.workflow === "PROJECT_DOCUMENT"
            ? { documentType: source.documentType ?? "OTHER" }
            : {}),
      });
      const d = await apiClient<EditorWireDraft | null>(`${base(p)}?${query}`, {
        signal,
      });
      return d ? normalizeEditorDraft(d) : null;
    },
    create: async (p: string, v: Parameters<typeof agentApi.create>[1]) =>
      normalizeEditorDraft(
        await mutate<EditorWireDraft>(base(p), "POST", {
          operationId: v.operationId,
          workflow: source.workflow,
          ...(source.workflow === "WORK_REPORT"
            ? { reportId: source.resourceId }
            : source.resourceId
              ? { documentId: source.resourceId }
              : { documentType: source.documentType ?? "OTHER" }),
        }),
      ),
    update,
    message: (p: string, id: string, v: AgentMessageInput) =>
      mutate<AgentResponse>(`${path(p, id)}/agent/messages`, "POST", v),
    apply: async (
      p: string,
      id: string,
      suggestion: string,
      v: Parameters<typeof agentApi.apply>[3],
    ) =>
      normalizeEditorDraft(
        await mutate<EditorWireDraft>(
          `${path(p, id)}/agent/suggestions/${encodeURIComponent(suggestion)}/apply`,
          "POST",
          v,
        ),
      ),
    reset: async (p: string, id: string, v: RevisionOperation) =>
      normalizeEditorDraft(
        await mutate<EditorWireDraft>(`${path(p, id)}/reset-chat`, "POST", v),
      ),
    discard: (
      p: string,
      id: string,
      v: Parameters<typeof agentApi.discard>[2],
    ) => mutate<void>(path(p, id), "DELETE", v),
    save: (p: string, id: string, v: Parameters<typeof agentApi.save>[2]) =>
      mutate<unknown>(`${path(p, id)}/save`, "POST", v),
    versions: (p: string, _task: string, id: string, page = 1) =>
      apiClient<Awaited<ReturnType<typeof agentApi.versions>>>(
        `${base(p)}/sources/${source.workflow}/${encodeURIComponent(id)}/versions?page=${page}&pageSize=20`,
      ),
    restore: (
      p: string,
      _task: string,
      id: string,
      v: Parameters<typeof agentApi.restore>[3],
    ) =>
      mutate<unknown>(
        `${base(p)}/sources/${source.workflow}/${encodeURIComponent(id)}/restore`,
        "POST",
        v,
      ),
  };
}
