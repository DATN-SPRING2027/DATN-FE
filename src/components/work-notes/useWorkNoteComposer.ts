"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import {
  assessmentApi,
  type AssessmentFeedbackCategory,
} from "@/lib/queries/work-notes/work-note-assessment.api";
import type {
  AssessmentPurpose,
  AssessmentView,
} from "@/lib/queries/work-notes/work-note-assessment.types";
import {
  agentApi,
  editorAgentApi,
  type EditorSourceIdentity,
  type AgentDraft,
  type AgentMessageInput,
  type AgentResponse,
  type AgentSuggestion,
} from "@/lib/queries/work-notes/work-note-agent.api";

type Fields = { title: string; contentMarkdown: string };
type AssessmentAction =
  | { kind: "assess"; purpose: AssessmentPurpose }
  | {
      kind: "reply";
      disposition: "answered" | "unknown" | "skipped";
      answer?: string;
    }
  | { kind: "correct"; targetClaimOrGapId: string; correctionText: string }
  | { kind: "reset"; newPurpose: AssessmentPurpose; carryAnswerIds: string[] }
  | { kind: "feedback"; category: AssessmentFeedbackCategory }
  | { kind: "rewrite" | "validateAuthor" };
export function useWorkNoteComposer(
  projectId: string,
  taskId: string,
  noteId: string | undefined,
  onSaved: (result?: unknown) => void,
  source?: EditorSourceIdentity,
) {
  const t = useTranslations("workNotes.agent");
  const ta = useTranslations("workNotes.assessment");
  const client = useQueryClient();
  const api = source ? editorAgentApi(source) : agentApi;
  const key = [
    "worknote-agent-draft",
    projectId,
    source?.workflow ?? "TASK_NOTE",
    source?.resourceId ??
      (source?.workflow === "PROJECT_DOCUMENT"
        ? (source.documentType ?? "OTHER")
        : taskId),
    noteId ?? "new",
  ];
  const [createOperation] = useState(() => crypto.randomUUID());
  const [closed, setClosed] = useState(false);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await api.resume(projectId, taskId, noteId, signal)) ??
      api.create(projectId, {
        operationId: createOperation,
        taskId,
        ...(noteId ? { noteId } : {}),
      }),
    enabled: !closed,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [local, setLocal] = useState<Fields | null>(null);
  const localRef = useRef<Fields | null>(null);
  const [saving, setSaving] = useState(false),
    [agentBusy, setAgentBusy] = useState(false),
    [pendingMessage, setPendingMessage] = useState<string | null>(null),
    [error, setError] = useState("");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const undoRef = useRef<Fields[]>([]),
    redoRef = useRef<Fields[]>([]);
  const pending = useRef<Promise<AgentDraft> | null>(null);
  const updateRequest = useRef<{
    signature: string;
    operationId: string;
  } | null>(null);
  const saveRequest = useRef<{ signature: string; operationId: string } | null>(
    null,
  );
  const restoreRequest = useRef<{
    signature: string;
    operationId: string;
  } | null>(null);
  const alive = useRef(true);
  const closedDraft = useRef(false);
  const discarding = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editEpoch = useRef(0);
  const assessmentPending = useRef(false);
  const assessmentOperation = useRef<{
    signature: string;
    operationId: string;
  } | null>(null);
  const lastRequest = useRef<Omit<
    AgentMessageInput,
    "operationId" | "expectedRevision"
  > | null>(null);
  function server() {
    const d = client.getQueryData<AgentDraft>(key);
    if (!d) throw Error("Draft unavailable");
    return d;
  }
  const fields =
    local ??
    (query.data
      ? { title: query.data.title, contentMarkdown: query.data.contentMarkdown }
      : null);
  const dirty =
    !!fields &&
    !!query.data &&
    (fields.title !== query.data.title ||
      fields.contentMarkdown !== query.data.contentMarkdown);
  function setFields(value: Fields, remember = true) {
    editEpoch.current++;
    if (remember) {
      const current = localRef.current ?? server();
      undoRef.current.push({
        title: current.title,
        contentMarkdown: current.contentMarkdown,
      });
      undoRef.current = undoRef.current.slice(-100);
      redoRef.current = [];
    }
    localRef.current = value;
    setLocal(value);
    setHistoryCount((c) => c + 1);
    setError("");
  }
  function cache(d: AgentDraft) {
    client.setQueryData(key, d);
  }
  async function persist(): Promise<AgentDraft> {
    if (pending.current) {
      await pending.current;
      return persist();
    }
    const d = server(),
      value = localRef.current;
    if (
      !value ||
      (d.title === value.title && d.contentMarkdown === value.contentMarkdown)
    )
      return d;
    const signature = JSON.stringify([d.id, d.revision, value]);
    if (updateRequest.current?.signature !== signature)
      updateRequest.current = { signature, operationId: crypto.randomUUID() };
    if (alive.current) setSaving(true);
    const operationId = updateRequest.current.operationId;
    const request = api
      .update(projectId, d.id, {
        operationId,
        expectedRevision: d.revision,
        ...value,
      })
      .then((next) => {
        if (!closedDraft.current) cache(next);
        if (JSON.stringify(localRef.current) === JSON.stringify(value)) {
          localRef.current = null;
          if (alive.current) setLocal(null);
        }
        updateRequest.current = null;
        return next;
      })
      .finally(() => {
        pending.current = null;
        if (alive.current) setSaving(false);
      });
    pending.current = request;
    return request;
  }
  async function flush(): Promise<AgentDraft> {
    const d = await persist();
    const v = localRef.current;
    if (v && (d.title !== v.title || d.contentMarkdown !== v.contentMarkdown))
      return flush();
    return d;
  }
  const flushOnUnmount = useEffectEvent(() => {
    if (closedDraft.current) {
      client.removeQueries({ queryKey: key, exact: true });
      return;
    }
    if (
      !discarding.current &&
      localRef.current &&
      client.getQueryData<AgentDraft>(key)
    ) {
      void flush().catch(() => undefined);
    }
  });
  useEffect(() => {
    alive.current = true;
    closedDraft.current = false;
    discarding.current = false;
    return () => {
      alive.current = false;
      flushOnUnmount();
    };
  }, []);
  const autosave = useEffectEvent(() => {
    if (closedDraft.current || discarding.current) return;
    void persist().catch((e) => {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Autosave failed");
    });
  });
  useEffect(() => {
    if (!dirty || closedDraft.current || discarding.current) return;
    const timer = setTimeout(() => {
      autosaveTimer.current = null;
      autosave();
    }, 600);
    autosaveTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (autosaveTimer.current === timer) autosaveTimer.current = null;
    };
  }, [dirty, local]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);
  async function send(
    input: Omit<AgentMessageInput, "operationId" | "expectedRevision">,
  ) {
    if (!input.replyToQuestionId) lastRequest.current = input;
    const outgoingContent = input.answer ?? input.instruction;
    setError("");
    setPendingMessage(outgoingContent);
    setAgentBusy(true);
    try {
      const d = await flush();
      const result = await api.message(projectId, d.id, {
        operationId: crypto.randomUUID(),
        expectedRevision: d.revision,
        ...input,
      });
      if (!alive.current) return;
      const current = server();
      if (current.revision !== result.sourceRevision || localRef.current)
        throw Error("The draft changed. Regenerate the proposal.");
      setResponse(result);
      cache({
        ...current,
        ...(current.assessment
          ? {
              assessment: {
                ...current.assessment,
                state: "stale",
                allowedActions: ["reset", "manual", "feedback"],
              },
            }
          : {}),
        suggestion: result.suggestion,
        pendingQuestion: result.questions[0] ?? null,
        conversation: [
          ...current.conversation,
          { role: "user", content: outgoingContent },
          { role: "assistant", content: result.message },
        ],
      });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent unavailable");
    } finally {
      setPendingMessage(null);
      setAgentBusy(false);
    }
  }
  async function apply(
    suggestion: AgentSuggestion,
    action:
      "replace_body" | "replace_selection" | "insert_after" | "replace_title",
    applyTitle: boolean,
  ) {
    setError("");
    const d = server();
    if (localRef.current || suggestion.baseRevision !== d.revision)
      throw Error("The draft changed. Regenerate the proposal.");
    const previous = { title: d.title, contentMarkdown: d.contentMarkdown };
    const next = await api.apply(projectId, d.id, suggestion.id, {
      operationId: crypto.randomUUID(),
      expectedRevision: d.revision,
      action,
      applyTitle,
    });
    undoRef.current.push(previous);
    redoRef.current = [];
    setHistoryCount((c) => c + 1);
    cache(next);
    setResponse(null);
    return next;
  }
  async function assessmentAction(
    input: AssessmentAction,
  ): Promise<AssessmentView | AgentResponse> {
    if (source || assessmentPending.current) throw Error(ta("unavailable"));
    assessmentPending.current = true;
    setAgentBusy(true);
    setError("");
    try {
      const d = await flush();
      const a = d.assessment;
      if (input.kind !== "assess" && !a) throw Error(ta("missingAssessment"));
      const signature = JSON.stringify([
        d.id,
        d.revision,
        a?.id,
        a?.revision,
        input,
      ]);
      if (assessmentOperation.current?.signature !== signature)
        assessmentOperation.current = {
          signature,
          operationId: crypto.randomUUID(),
        };
      const base = {
        operationId: assessmentOperation.current.operationId,
        expectedRevision: d.revision,
      };
      const mutation = {
        ...base,
        expectedAssessmentRevision: a?.revision ?? 0,
      };
      const epoch = editEpoch.current;
      let result: AssessmentView | AgentResponse;
      switch (input.kind) {
        case "assess":
          result = await assessmentApi.assess(projectId, d.id, {
            ...base,
            purpose: input.purpose,
          });
          break;
        case "reply": {
          if (!a?.nextQuestion) throw Error(ta("missingQuestion"));
          result = await assessmentApi.reply(projectId, d.id, a.id, {
            ...mutation,
            gapId: a.nextQuestion.gapId,
            questionId: a.nextQuestion.id,
            disposition: input.disposition,
            ...(input.disposition === "answered"
              ? { answer: input.answer }
              : {}),
          });
          break;
        }
        case "correct":
          result = await assessmentApi.correct(projectId, d.id, a!.id, {
            ...mutation,
            targetClaimOrGapId: input.targetClaimOrGapId,
            correctionText: input.correctionText,
          });
          break;
        case "reset":
          result = await assessmentApi.reset(projectId, d.id, a!.id, {
            ...mutation,
            newPurpose: input.newPurpose,
            carryAnswerIds: input.carryAnswerIds,
          });
          break;
        case "feedback":
          result = await assessmentApi.feedback(projectId, d.id, a!.id, {
            ...mutation,
            category: input.category,
          });
          break;
        case "validateAuthor":
          result = await assessmentApi.validateAuthor(
            projectId,
            d.id,
            a!.id,
            mutation,
          );
          break;
        case "rewrite":
          result = await assessmentApi.rewrite(
            projectId,
            d.id,
            a!.id,
            mutation,
          );
          break;
      }
      if (!alive.current) return result;
      const refreshed =
        input.kind === "rewrite"
          ? await agentApi.resume(projectId, taskId, noteId)
          : null;
      if (!alive.current) return result;
      if (input.kind === "rewrite" && !refreshed)
        throw Error(ta("missingAssessment"));
      const current = server();
      const changed =
        current.revision !== result.sourceRevision ||
        (refreshed !== null && refreshed.revision !== result.sourceRevision) ||
        !!localRef.current ||
        epoch !== editEpoch.current;
      const nextAssessment =
        "schemaVersion" in result ? result : refreshed?.assessment;
      if (changed && input.kind !== "feedback") {
        if (nextAssessment)
          cache({
            ...current,
            assessment: {
              ...nextAssessment,
              state: "stale",
              allowedActions: ["reset", "manual", "feedback"],
            },
          });
        throw Error(ta("draftChanged"));
      }
      if ("schemaVersion" in result) {
        const clearsProposal =
          input.kind !== "feedback" && input.kind !== "validateAuthor";
        cache({
          ...current,
          assessment: result,
          ...(clearsProposal
            ? { pendingQuestion: null, suggestion: null }
            : {}),
        });
        if (clearsProposal) setResponse(null);
      } else {
        cache({
          ...current,
          assessment: nextAssessment ?? a,
          suggestion: result.suggestion,
          pendingQuestion: null,
        });
        setResponse(result);
      }
      assessmentOperation.current = null;
      return result;
    } catch (e) {
      if (alive.current && e instanceof ApiError && e.status === 409) {
        const current = client.getQueryData<AgentDraft>(key);
        if (current?.assessment)
          cache({
            ...current,
            assessment: {
              ...current.assessment,
              state: "stale",
              allowedActions: ["reset", "manual", "feedback"],
              authorValidated: false,
              signals: {
                ...current.assessment.signals,
                authorValidated: false,
              },
            },
          });
      }
      setError(e instanceof Error ? e.message : ta("requestFailed"));
      throw e;
    } finally {
      assessmentPending.current = false;
      setAgentBusy(false);
    }
  }
  async function save(confirmed: boolean) {
    setError("");
    setSaving(true);
    try {
      const d = await flush();
      setSaving(true);
      const signature = JSON.stringify([d.id, d.revision, confirmed]);
      if (saveRequest.current?.signature !== signature)
        saveRequest.current = { signature, operationId: crypto.randomUUID() };
      const saved = await api.save(projectId, d.id, {
        operationId: saveRequest.current.operationId,
        expectedRevision: d.revision,
        discardOriginalConfirmed: confirmed,
      });
      closedDraft.current = true;
      alive.current = false;
      setClosed(true);
      await client.cancelQueries({ queryKey: key, exact: true });
      client.removeQueries({ queryKey: key, exact: true });
      await client.invalidateQueries({ queryKey: ["work-notes", projectId] });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      throw e;
    } finally {
      setSaving(false);
    }
  }
  async function discard() {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    discarding.current = true;
    try {
      if (pending.current) {
        await pending.current.catch(() => undefined);
      }
      const d = server();
      closedDraft.current = true;
      setClosed(true);
      await client.cancelQueries({ queryKey: key, exact: true });
      await api.discard(projectId, d.id, {
        expectedRevision: d.revision,
        discardConfirmed: true,
      });
      alive.current = false;
      client.removeQueries({ queryKey: key, exact: true });
      localRef.current = null;
      setLocal(null);
    } catch (e) {
      closedDraft.current = false;
      discarding.current = false;
      setClosed(false);
      throw e;
    }
  }
  async function reset() {
    const d = await flush();
    cache(
      await api.reset(projectId, d.id, {
        operationId: crypto.randomUUID(),
        expectedRevision: d.revision,
      }),
    );
    setResponse(null);
  }
  async function regenerate() {
    const d = server(),
      suggestion = d.suggestion;
    const input =
      lastRequest.current ??
      (suggestion
        ? {
            operation: suggestion.operation,
            scope: suggestion.scope,
            instruction: t("regeneratePrompt"),
            includeWholeNoteContext: false,
            ...(suggestion.selection
              ? { selection: suggestion.selection }
              : {}),
          }
        : null);
    if (input) return send(input);
  }
  async function restore(versionNumber: number) {
    const d = server();
    if (localRef.current || d.hasAppliedRewrite)
      throw Error("Save or discard draft changes before restoring history.");
    const signature = JSON.stringify([
      d.noteId,
      d.baseNoteVersion,
      versionNumber,
    ]);
    if (restoreRequest.current?.signature !== signature)
      restoreRequest.current = { signature, operationId: crypto.randomUUID() };
    await api.restore(projectId, taskId, d.noteId!, {
      operationId: restoreRequest.current.operationId,
      expectedVersion: d.baseNoteVersion,
      versionNumber,
      ...(source ? { expectedContentHash: d.baseContentHash } : {}),
    });
    closedDraft.current = true;
    setClosed(true);
    await client.cancelQueries({ queryKey: key, exact: true });
    await api.discard(projectId, d.id, {
      expectedRevision: d.revision,
      discardConfirmed: true,
    });
    alive.current = false;
    client.removeQueries({ queryKey: key, exact: true });
    await client.invalidateQueries({ queryKey: ["work-notes", projectId] });
    onSaved();
  }
  function undo(redo = false) {
    const source = redo ? redoRef : undoRef,
      destination = redo ? undoRef : redoRef;
    const value = source.current.pop();
    if (!value) return;
    const current = localRef.current ?? server();
    destination.current.push({
      title: current.title,
      contentMarkdown: current.contentMarkdown,
    });
    setFields(value, false);
    setResponse(null);
  }
  return {
    query,
    historyApi: api,
    draft: query.data,
    fields,
    dirty,
    saving,
    agentBusy,
    pendingMessage,
    assessmentBusy: assessmentPending.current,
    error,
    setError,
    response,
    setResponse,
    change: setFields,
    persist: flush,
    send,
    apply,
    save,
    discard,
    reset,
    regenerate,
    restore,
    assess: (purpose: AssessmentPurpose) =>
      assessmentAction({ kind: "assess", purpose }),
    replyAssessment: (
      disposition: "answered" | "unknown" | "skipped",
      answer?: string,
    ) => assessmentAction({ kind: "reply", disposition, answer }),
    rewriteAssessment: () => assessmentAction({ kind: "rewrite" }),
    correctAssessment: (targetClaimOrGapId: string, correctionText: string) =>
      assessmentAction({ kind: "correct", targetClaimOrGapId, correctionText }),
    resetAssessment: (
      newPurpose: AssessmentPurpose,
      carryAnswerIds: string[],
    ) => assessmentAction({ kind: "reset", newPurpose, carryAnswerIds }),
    validateAssessment: () => assessmentAction({ kind: "validateAuthor" }),
    feedbackAssessment: (category: AssessmentFeedbackCategory) =>
      assessmentAction({ kind: "feedback", category }),
    undo,
    canUndo: historyCount >= 0 && undoRef.current.length > 0,
    canRedo: historyCount >= 0 && redoRef.current.length > 0,
  };
}
