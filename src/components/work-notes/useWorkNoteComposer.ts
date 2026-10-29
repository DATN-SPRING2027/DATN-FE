"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
export function useWorkNoteComposer(
  projectId: string,
  taskId: string,
  noteId: string | undefined,
  onSaved: (result?: unknown) => void,
  source?: EditorSourceIdentity,
) {
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
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await api.resume(projectId, taskId, noteId, signal)) ??
      api.create(projectId, {
        operationId: createOperation,
        taskId,
        ...(noteId ? { noteId } : {}),
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [local, setLocal] = useState<Fields | null>(null);
  const localRef = useRef<Fields | null>(null);
  const [saving, setSaving] = useState(false),
    [agentBusy, setAgentBusy] = useState(false),
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
  const lastRequest = useRef<Omit<
    AgentMessageInput,
    "operationId" | "expectedRevision"
  > | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
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
    setSaving(true);
    const operationId = updateRequest.current.operationId;
    const request = api
      .update(projectId, d.id, {
        operationId,
        expectedRevision: d.revision,
        ...value,
      })
      .then((next) => {
        cache(next);
        if (JSON.stringify(localRef.current) === JSON.stringify(value)) {
          localRef.current = null;
          setLocal(null);
        }
        updateRequest.current = null;
        return next;
      })
      .finally(() => {
        pending.current = null;
        setSaving(false);
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
  const autosave = useEffectEvent(() => {
    void persist().catch((e) =>
      setError(e instanceof Error ? e.message : "Autosave failed"),
    );
  });
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => autosave(), 600);
    return () => clearTimeout(timer);
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
    setError("");
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
        suggestion: result.suggestion,
        pendingQuestion: result.questions[0] ?? null,
        conversation: [
          ...current.conversation,
          { role: "user", content: input.answer ?? input.instruction },
          { role: "assistant", content: result.message },
        ],
      });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent unavailable");
    } finally {
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
      alive.current = false;
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
    const d = server();
    await api.discard(projectId, d.id, {
      expectedRevision: d.revision,
      discardConfirmed: true,
    });
    client.removeQueries({ queryKey: key, exact: true });
    localRef.current = null;
    setLocal(null);
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
            instruction:
              "Provide another proposal while preserving source meaning, language and uncertainty.",
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
    await api.discard(projectId, d.id, {
      expectedRevision: d.revision,
      discardConfirmed: true,
    });
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
    undo,
    canUndo: historyCount >= 0 && undoRef.current.length > 0,
    canRedo: historyCount >= 0 && redoRef.current.length > 0,
  };
}
