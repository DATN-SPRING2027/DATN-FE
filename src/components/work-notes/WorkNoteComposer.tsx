"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeftRight,
  Bold,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FileText,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Maximize2,
  Pencil,
  Redo2,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Underline,
  Undo2,
  Wand2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { CloseIcon } from "@/icons";
import type {
  AgentOperation,
  AgentResponse,
  SelectionAnchor,
  EditorSourceIdentity,
} from "@/lib/queries/work-notes/work-note-agent.api";
import type { TaskNoteAiChatSourceInput } from "@/lib/queries/work-notes/useWorkNotes";
import { useWorkNoteComposer } from "./useWorkNoteComposer";
import WorkNoteAgentChat from "./WorkNoteAgentChat";
import WorkNoteAssessment from "./WorkNoteAssessment";
import WorkNoteHistory from "./WorkNoteHistory";
import WorkNoteContext from "./WorkNoteContext";
import WorkNoteSelectionAssistant, {
  computeTextareaSelectionPoint,
  type SelectionAnchorPoint,
} from "./WorkNoteSelectionAssistant";
import { sourceSelection, reconcileTextareaEdit } from "./textarea-source";

type AssistantTab = "chat" | "suggestions" | "context";

export default function WorkNoteComposer({
  projectId,
  taskId = "",
  noteId,
  onClose,
  onSaved,
  source,
  initialFields,
  aiChatSource,
  startFreshDraft = false,
  variant = "modal",
  onPanelOpenChange,
  onConfirmationChange,
  dismissSignal = 0,
}: {
  projectId: string;
  taskId?: string;
  noteId?: string;
  onClose: (persistedFields?: {
    title: string;
    contentMarkdown: string;
  }) => void;
  onSaved: (result?: unknown) => void;
  source?: EditorSourceIdentity;
  initialFields?: { title: string; contentMarkdown: string };
  aiChatSource?: TaskNoteAiChatSourceInput;
  startFreshDraft?: boolean;
  variant?: "modal" | "inline";
  onPanelOpenChange?: (open: boolean) => void;
  onConfirmationChange?: (open: boolean) => void;
  dismissSignal?: number;
}) {
  const t = useTranslations("workNotes.agent");
  const editor = useWorkNoteComposer(
    projectId,
    taskId,
    noteId,
    onSaved,
    source,
    initialFields,
    aiChatSource,
    startFreshDraft,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelToggle, setPanelToggle] = useState<boolean | null>(null);
  const [assistantTab, setAssistantTab] = useState<AssistantTab>("chat");
  const [toolbarAiOpen, setToolbarAiOpen] = useState(false);
  const [blockStyle, setBlockStyle] = useState<"normal" | "h1" | "h2" | "h3">(
    "normal",
  );
  const [instruction, setInstruction] = useState(""),
    [selection, setSelection] = useState<SelectionAnchor | null>(null),
    [selectionPromptQuote, setSelectionPromptQuote] = useState<string | null>(
      null,
    ),
    [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "save" | "discard" | "restore" | null
  >(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const section = useRef<HTMLElement>(null),
    body = useRef<HTMLTextAreaElement>(null),
    chatInput = useRef<HTMLTextAreaElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    toolbarAiRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [selectionPoint, setSelectionPoint] = useState<SelectionAnchorPoint>({
    top: 8,
    left: 8,
    boxWidth: 320,
  });
  const [selectionBadgeReady, setSelectionBadgeReady] = useState(false);
  const [appliedHighlight, setAppliedHighlight] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const highlightBackdropRef = useRef<HTMLDivElement>(null);
  const pointerSelectingRef = useRef(false);
  const lastPointerReleaseRef = useRef<{
    clientX: number;
    clientY: number;
    at: number;
  } | null>(null);
  const confirmPanel = useRef<HTMLDivElement>(null);
  const retryAction = useRef<(() => Promise<unknown>) | null>(null);

  useEffect(() => {
    if (!toolbarAiOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (
        toolbarAiRef.current &&
        !toolbarAiRef.current.contains(event.target as Node)
      ) {
        setToolbarAiOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [toolbarAiOpen]);

  useEffect(() => {
    if (!confirmation) return;
    const composerSection = section.current;
    confirmPanel.current?.querySelector("button")?.focus();
    return () =>
      composerSection
        ?.querySelector<HTMLElement>("footer button:last-child")
        ?.focus();
  }, [confirmation]);

  const d = editor.draft,
    fields = editor.fields,
    suggestion = d?.suggestion ?? editor.response?.suggestion;

  useEffect(() => {
    if (!editor.error) retryAction.current = null;
  }, [editor.error]);

  const activeSuggestion =
    suggestion && dismissed !== suggestion.id ? suggestion : null;
  const assessmentEnabled =
    !source &&
    (!d || d.workflow === "TASK_NOTE") &&
    process.env.NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED === "true";
  // Collapsed by default; automatically opens if resumed draft already has a waiting proposal, question, or assessment.
  const hasPendingAiOutput = Boolean(
    activeSuggestion ||
      d?.pendingQuestion ||
      (assessmentEnabled && d?.assessment),
  );
  const panelOpen = panelToggle ?? hasPendingAiOutput;

  useEffect(() => {
    onPanelOpenChange?.(panelOpen);
  }, [onPanelOpenChange, panelOpen]);

  useEffect(() => {
    onConfirmationChange?.(Boolean(confirmation));
    if (!confirmation) return;
    confirmPanel.current
      ?.querySelector<HTMLElement>("button:not([disabled])")
      ?.focus();
  }, [confirmation, onConfirmationChange]);

  useEffect(() => {
    if (!appliedHighlight) return;
    const timer = setTimeout(() => setAppliedHighlight(null), 5000);
    return () => clearTimeout(timer);
  }, [appliedHighlight]);

  useEffect(() => {
    if (variant !== "modal") return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, [variant]);

  async function run(action: () => Promise<unknown>) {
    retryAction.current = null;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      retryAction.current = action;
      editor.setError(e instanceof Error ? e.message : t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    const persisted = editor.draft ? await editor.persist() : null;
    onClose(
      persisted
        ? {
            title: persisted.title,
            contentMarkdown: persisted.contentMarkdown,
          }
        : (fields ?? undefined),
    );
  }

  async function requestAssessment(
    action: () => Promise<unknown>,
    revealProposal = false,
  ) {
    retryAction.current = null;
    try {
      await action();
      if (revealProposal) {
        setDismissed(null);
        setPanelToggle(true);
        setAssistantTab("chat");
      }
    } catch (error) {
      retryAction.current = () => requestAssessment(action, revealProposal);
      editor.setError(
        error instanceof Error ? error.message : t("requestFailed"),
      );
    }
  }

  const dismissStepRef = useRef<() => void>(() => undefined);
  dismissStepRef.current = () => {
    if (confirmation) setConfirmation(null);
    else if (toolbarAiOpen) setToolbarAiOpen(false);
    else if (panelOpen) setPanelToggle(false);
    else void run(close);
  };
  const lastDismissSignalRef = useRef(dismissSignal);
  useEffect(() => {
    if (dismissSignal === lastDismissSignalRef.current) return;
    lastDismissSignalRef.current = dismissSignal;
    dismissStepRef.current();
  }, [dismissSignal]);

  function trap(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const items = (
      confirmation ? confirmPanel.current : section.current
    )?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
    );
    if (!items?.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearSelectionUi() {
    setSelection(null);
    setSelectionBadgeReady(false);
    setSelectionPromptQuote(null);
  }

  const contentMarkdown = fields?.contentMarkdown;
  const syncSelection = useCallback(
    (
      pointerClient?: { clientX: number; clientY: number } | null,
      revealBadge = true,
    ) => {
      const element = body.current;
      if (!element) return;
      const { selectionStart: start, selectionEnd: end } = element;
      const next =
        contentMarkdown !== undefined
          ? sourceSelection(contentMarkdown, start, end)
          : null;
      setSelection(next);
      if (!next || !next.quote.trim()) {
        setSelectionBadgeReady(false);
        return;
      }
      if (revealBadge) {
        const recentRelease = lastPointerReleaseRef.current;
        const effectivePointer =
          pointerClient ??
          (recentRelease && Date.now() - recentRelease.at <= 80
            ? {
                clientX: recentRelease.clientX,
                clientY: recentRelease.clientY,
              }
            : null);
        setSelectionPoint(
          computeTextareaSelectionPoint(
            element,
            element.selectionEnd,
            effectivePointer,
          ),
        );
        setSelectionBadgeReady(true);
      }
    },
    [contentMarkdown],
  );

  useEffect(() => {
    function finishPointerSelection(event: MouseEvent | PointerEvent) {
      if (!pointerSelectingRef.current) return;
      pointerSelectingRef.current = false;
      const coords = { clientX: event.clientX, clientY: event.clientY };
      lastPointerReleaseRef.current = { ...coords, at: Date.now() };
      syncSelection(coords, true);
    }
    window.addEventListener("pointerup", finishPointerSelection);
    window.addEventListener("mouseup", finishPointerSelection);
    return () => {
      window.removeEventListener("pointerup", finishPointerSelection);
      window.removeEventListener("mouseup", finishPointerSelection);
    };
  }, [syncSelection]);

  function openAiChatForSelection() {
    if (selection && selection.quote.trim()) {
      setSelectionPromptQuote(selection.quote.trim());
    }
    setSelectionBadgeReady(false);
    setPanelToggle(true);
    setAssistantTab("chat");
  }

  function applyInlineMarkdown(
    prefix: string,
    suffix = prefix,
    placeholder = "text",
  ) {
    const element = body.current;
    if (!element || !fields) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const current = element.value;
    const chosen = current.slice(start, end) || placeholder;
    const nextValue =
      current.slice(0, start) + prefix + chosen + suffix + current.slice(end);
    editor.change({
      ...fields,
      contentMarkdown: reconcileTextareaEdit(fields.contentMarkdown, nextValue),
    });
    setAppliedHighlight(null);
    clearSelectionUi();
    const caretStart = start + prefix.length;
    const caretEnd = caretStart + chosen.length;
    setTimeout(() => {
      element.focus();
      element.setSelectionRange(caretStart, caretEnd);
    }, 0);
  }

  function applyLinePrefix(prefix: string, stripHeading = false) {
    const element = body.current;
    if (!element || !fields) return;
    const current = element.value;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const lineStart = current.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIdx = current.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? current.length : lineEndIdx;
    const block = current.slice(lineStart, lineEnd);
    const updated = block
      .split("\n")
      .map((line) => {
        if (stripHeading) {
          const clean = line.replace(/^#{1,6}\s+/, "");
          return prefix ? `${prefix}${clean}` : clean;
        }
        return line.startsWith(prefix)
          ? line.slice(prefix.length)
          : `${prefix}${line}`;
      })
      .join("\n");
    const nextValue =
      current.slice(0, lineStart) + updated + current.slice(lineEnd);
    editor.change({
      ...fields,
      contentMarkdown: reconcileTextareaEdit(fields.contentMarkdown, nextValue),
    });
    setAppliedHighlight(null);
    clearSelectionUi();
    setTimeout(() => {
      element.focus();
      element.setSelectionRange(lineStart, lineStart + updated.length);
    }, 0);
  }

  async function requestAgent(
    action: () => Promise<AgentResponse | undefined>,
  ) {
    retryAction.current = null;
    setPanelToggle(true);
    setAssistantTab("chat");
    const result = await action();
    if (result) {
      setDismissed(null);
      setSelectionPromptQuote(null);
      if (result.status === "CLARIFICATION_REQUIRED") {
        setTimeout(() => chatInput.current?.focus(), 0);
      }
    } else {
      retryAction.current = () => requestAgent(action);
    }
    return result;
  }

  async function send(
    operation: AgentOperation,
    custom?: string,
    disposition?: "answered" | "skipped",
    scopeOverride?: "whole_note" | "selection",
  ) {
    const question = d?.pendingQuestion;
    const hasNoteContent = Boolean(fields?.contentMarkdown.trim());
    const effectiveSelection =
      scopeOverride === "whole_note" || !hasNoteContent
        ? null
        : (selection ??
          (activeSuggestion?.scope === "selection"
            ? activeSuggestion.selection
            : null) ??
          null);
    const typedText = custom === undefined ? instruction : null;
    const outgoingText =
      disposition === "skipped" ? t("skip") : (custom ?? instruction);
    if (typedText !== null) {
      setInstruction("");
    }
    setSelectionPromptQuote(null);
    setSelectionBadgeReady(false);
    const result = await requestAgent(() =>
      editor.send({
        operation,
        scope: effectiveSelection ? "selection" : "whole_note",
        instruction: outgoingText,
        includeWholeNoteContext: false,
        ...(effectiveSelection ? { selection: effectiveSelection } : {}),
        ...(question && disposition
          ? {
              replyToQuestionId: question.id,
              questionDisposition: disposition,
              ...(disposition === "answered" ? { answer: outgoingText } : {}),
            }
          : {}),
      }),
    );
    if (!result && typedText !== null) {
      setInstruction((curr) => curr || typedText);
    }
    return result;
  }

  function applyProposalAction(
    targetSuggestion: NonNullable<typeof suggestion>,
    action:
      "replace_body" | "replace_selection" | "insert_after" | "replace_title",
    applyTitle: boolean,
    edited: string | null,
  ) {
    if (!fields) return;
    const beforeMarkdown = fields.contentMarkdown;
    const anchor = targetSuggestion.selection;
    let nextHighlight: { start: number; end: number } | null = null;
    if (
      anchor &&
      (action === "replace_selection" || action === "insert_after")
    ) {
      const rawPrefix = beforeMarkdown.slice(
        0,
        action === "insert_after" ? anchor.end : anchor.start,
      );
      const domStart = rawPrefix.replace(/\r\n?/g, "\n").length;
      const inserted = (
        edited ??
        targetSuggestion.replacementText ??
        ""
      ).replace(/\r\n?/g, "\n");
      if (inserted.length > 0) {
        nextHighlight = { start: domStart, end: domStart + inserted.length };
      }
    }

    void run(async () => {
      const next = await editor.apply(targetSuggestion, action, applyTitle);
      if (edited !== null) {
        if (action === "replace_title") {
          editor.change(
            { title: edited, contentMarkdown: next.contentMarkdown },
            false,
          );
        } else {
          const contentMarkdown = anchor
            ? action === "insert_after"
              ? beforeMarkdown.slice(0, anchor.end) +
                edited +
                beforeMarkdown.slice(anchor.end)
              : beforeMarkdown.slice(0, anchor.start) +
                edited +
                beforeMarkdown.slice(anchor.end)
            : edited;
          editor.change({ title: next.title, contentMarkdown }, false);
        }
      }
      clearSelectionUi();
      setAppliedHighlight(nextHighlight);
    });
  }

  const textTools: readonly {
    operation: AgentOperation;
    key:
      "grammar" | "clarify" | "shorten" | "restructure" | "tone" | "handover";
    Icon: typeof BookOpen;
  }[] = [
    { operation: "grammar", key: "grammar", Icon: BookOpen },
    { operation: "clarify", key: "clarify", Icon: Wand2 },
    { operation: "shorten", key: "shorten", Icon: ArrowLeftRight },
    { operation: "restructure", key: "restructure", Icon: Maximize2 },
    { operation: "tone", key: "tone", Icon: SlidersHorizontal },
    { operation: "handover", key: "handover", Icon: RotateCw },
  ];

  const aiRequestBusy = editor.agentBusy || busy || !!confirmation;
  const hasNoteContent = Boolean(fields?.contentMarkdown.trim());
  const hasActiveSelection = Boolean(selection?.quote.trim());
  const aiActionDisabled = aiRequestBusy || !hasNoteContent;

  const suggestGridTools: readonly {
    id: string;
    operation: AgentOperation;
    labelKey:
      | "grammar"
      | "clarify"
      | "shorten"
      | "professional"
      | "expand"
      | "adjustTone";
    promptKey:
      | "grammar"
      | "clarify"
      | "shorten"
      | "tone"
      | "restructure"
      | "adjustTone";
    Icon: typeof BookOpen;
  }[] = [
    {
      id: "grammar",
      operation: "grammar",
      labelKey: "grammar",
      promptKey: "grammar",
      Icon: BookOpen,
    },
    {
      id: "clarify",
      operation: "clarify",
      labelKey: "clarify",
      promptKey: "clarify",
      Icon: Pencil,
    },
    {
      id: "shorten",
      operation: "shorten",
      labelKey: "shorten",
      promptKey: "shorten",
      Icon: ArrowLeftRight,
    },
    {
      id: "professional",
      operation: "tone",
      labelKey: "professional",
      promptKey: "tone",
      Icon: Briefcase,
    },
    {
      id: "expand",
      operation: "restructure",
      labelKey: "expand",
      promptKey: "restructure",
      Icon: Maximize2,
    },
    {
      id: "adjustTone",
      operation: "tone",
      labelKey: "adjustTone",
      promptKey: "adjustTone",
      Icon: SlidersHorizontal,
    },
  ];

  const wholeNoteTools: readonly {
    id: string;
    operation: AgentOperation;
    titleKey:
      | "improveAllTitle"
      | "summarizeTitle"
      | "suggestAdditionsTitle"
      | "rewriteByPurposeTitle"
      | "convertFormatTitle";
    descKey:
      | "improveAllDesc"
      | "summarizeDesc"
      | "suggestAdditionsDesc"
      | "rewriteByPurposeDesc"
      | "convertFormatDesc";
    prompt: string;
    allowEmptyNote?: boolean;
    badgeClass: string;
    Icon: typeof Wand2;
  }[] = [
    {
      id: "improveAll",
      operation: "clarify",
      titleKey: "improveAllTitle",
      descKey: "improveAllDesc",
      prompt: t("wholeNotePrompts.improveAll"),
      badgeClass:
        "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
      Icon: Wand2,
    },
    {
      id: "summarize",
      operation: "shorten",
      titleKey: "summarizeTitle",
      descKey: "summarizeDesc",
      prompt: t("wholeNotePrompts.summarize"),
      badgeClass:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      Icon: FileText,
    },
    {
      id: "suggestAdditions",
      operation: "custom",
      titleKey: "suggestAdditionsTitle",
      descKey: "suggestAdditionsDesc",
      prompt: t("wholeNotePrompts.suggestAdditions"),
      allowEmptyNote: true,
      badgeClass:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      Icon: ListChecks,
    },
    {
      id: "rewriteByPurpose",
      operation: "handover",
      titleKey: "rewriteByPurposeTitle",
      descKey: "rewriteByPurposeDesc",
      prompt: t("wholeNotePrompts.rewriteByPurpose"),
      badgeClass:
        "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      Icon: Target,
    },
    {
      id: "convertFormat",
      operation: "restructure",
      titleKey: "convertFormatTitle",
      descKey: "convertFormatDesc",
      prompt: t("wholeNotePrompts.convertFormat"),
      badgeClass:
        "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
      Icon: List,
    },
  ];

  const statusText = editor.query.isPending
    ? t("loading")
    : editor.query.isError
      ? t("loadFailed")
      : editor.agentBusy
        ? t(editor.assessmentBusy ? "checkingInformation" : "thinking")
        : editor.saving
          ? t("saving")
          : editor.dirty
            ? t("unsaved")
            : t("autoSaveReady");

  const isInline = variant === "inline";

  const headerElement = (
    <header className="flex shrink-0 items-center gap-3 border-b border-gray-200/80 px-4 py-3 sm:px-5 dark:border-gray-800">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
      >
        <FileText className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id="agent-composer-title"
          className="truncate text-base font-bold text-gray-900 sm:text-lg dark:text-gray-100"
        >
          {t(
            source
              ? source.workflow === "PROJECT_DOCUMENT"
                ? "documentEditorTitle"
                : "reportEditorTitle"
              : noteId
                ? "editTitle"
                : "title",
          )}
        </h2>
        <p className="inline-flex max-w-full items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">
            {source
              ? t(
                  source.workflow === "PROJECT_DOCUMENT"
                    ? "documentContext"
                    : "reportContext",
                )
              : t("context", { task: taskId.slice(-6) })}
          </span>
          {!source && (
            <ExternalLink
              className="size-3 shrink-0 text-gray-400"
              aria-hidden="true"
            />
          )}
        </p>
      </div>
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="worknote-ai-panel"
        onClick={() => {
          const nextOpen = !panelOpen;
          setPanelToggle(nextOpen);
          if (nextOpen && selection && selection.quote.trim()) {
            setSelectionPromptQuote(selection.quote.trim());
            setSelectionBadgeReady(false);
          }
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          panelOpen
            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200"
            : "border-gray-200 bg-white text-brand-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300"
        }`}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        <span>{t("agent")}</span>
      </button>
      <button
        ref={closeButton}
        type="button"
        aria-label={t("close")}
        onClick={() => void run(close)}
        disabled={busy}
        className="shrink-0 rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <CloseIcon className="size-5 fill-current" />
      </button>
    </header>
  );

  const errorBanner = (editor.error || editor.query.isError) && (
    <div
      role="alert"
      className="mx-4 mt-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700 sm:mx-6 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
    >
      <span>
        {editor.error ||
          (editor.query.error instanceof Error
            ? editor.query.error.message
            : t("loadFailed"))}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || editor.agentBusy || editor.saving}
        onClick={() => {
          const retry = retryAction.current;
          void run(
            retry ??
              (async () => {
                if (d) {
                  await editor.persist();
                  editor.setError("");
                } else await editor.query.refetch();
              }),
          );
        }}
      >
        {t("retry")}
      </Button>
    </div>
  );

  const composerSection = (
      <section
        ref={section}
        role={isInline ? "region" : "dialog"}
        aria-modal={isInline ? undefined : "true"}
        aria-labelledby="agent-composer-title"
        onKeyDown={isInline ? undefined : trap}
        className={
          isInline
            ? "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            : "relative mx-auto flex h-dvh w-full max-w-7xl flex-col overflow-hidden bg-white text-gray-900 shadow-2xl sm:my-[3dvh] sm:h-[94dvh] sm:rounded-2xl sm:border sm:border-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        }
      >
        <div className="contents" inert={!!confirmation}>
          {(!isInline || !fields) && (
            <>
              {headerElement}
              {errorBanner}
            </>
          )}

          {/* Main Adaptive Body: 1-Column when AI Panel Collapsed, 2-Column Split when AI Panel Open */}
          {!fields ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {editor.query.isPending && (
                <Loader2
                  className="size-4 animate-spin text-brand-500"
                  aria-hidden="true"
                />
              )}
              <span>{statusText}</span>
            </div>
          ) : (
            <div
              className={`grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden ${
                panelOpen
                  ? isInline
                    ? "lg:grid-cols-[minmax(0,1fr)_375px] xl:grid-cols-[minmax(0,1fr)_400px]"
                    : "lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]"
                  : ""
              }`}
            >
              {/* LEFT COLUMN: Editor + Task Information Check + Pinned Footer (6) */}
              <div className="flex min-h-0 min-w-0 flex-col">
                {isInline && (
                  <>
                    {headerElement}
                    {errorBanner}
                  </>
                )}
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {t("noteSectionTitle")}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t("noteSectionSubtitle")}
                    </p>
                  </div>

                  {/* Region (2): Title Input */}
                  <label className="block shrink-0">
                    <span className="sr-only">{t("noteTitle")}</span>
                    <input
                      value={fields.title}
                      placeholder={t("noteTitlePlaceholder")}
                      maxLength={
                        source?.workflow === "PROJECT_DOCUMENT" ? 240 : 300
                      }
                      disabled={!!confirmation || busy}
                      onChange={(e) =>
                        editor.change({ ...fields, title: e.target.value })
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-lg font-bold text-gray-900 shadow-2xs transition-colors outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </label>

                  {/* Unified Rich-Toolbar Editor Card */}
                  <div className="relative flex min-h-80 flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-2xs transition-colors focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-900">
                    {/* Region (3): Formatting + Improve with AI Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50/70 px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-800/50">
                      <button
                        type="button"
                        aria-label={t("undo")}
                        title={t("undo")}
                        disabled={
                          !editor.canUndo ||
                          !!confirmation ||
                          busy ||
                          editor.saving ||
                          editor.agentBusy
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (
                            busy ||
                            editor.saving ||
                            editor.agentBusy ||
                            !!confirmation
                          ) {
                            return;
                          }
                          editor.undo();
                        }}
                        className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-200/70 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Undo2 className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("redo")}
                        title={t("redo")}
                        disabled={
                          !editor.canRedo ||
                          !!confirmation ||
                          busy ||
                          editor.saving ||
                          editor.agentBusy
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (
                            busy ||
                            editor.saving ||
                            editor.agentBusy ||
                            !!confirmation
                          ) {
                            return;
                          }
                          editor.undo(true);
                        }}
                        className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-200/70 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Redo2 className="size-4" aria-hidden="true" />
                      </button>

                      <span
                        aria-hidden="true"
                        className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"
                      />

                      <select
                        aria-label={t("formatBlockStyle")}
                        value={blockStyle}
                        disabled={!!confirmation || busy}
                        onChange={(e) => {
                          const value = e.target.value as
                            "normal" | "h1" | "h2" | "h3";
                          setBlockStyle(value);
                          const prefix =
                            value === "h1"
                              ? "# "
                              : value === "h2"
                                ? "## "
                                : value === "h3"
                                  ? "### "
                                  : "";
                          applyLinePrefix(prefix, true);
                        }}
                        className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200/60 focus:border-brand-400 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <option value="normal" className="dark:bg-gray-900">
                          {t("formatNormal")}
                        </option>
                        <option value="h1" className="dark:bg-gray-900">
                          {t("formatHeading1")}
                        </option>
                        <option value="h2" className="dark:bg-gray-900">
                          {t("formatHeading2")}
                        </option>
                        <option value="h3" className="dark:bg-gray-900">
                          {t("formatHeading3")}
                        </option>
                      </select>

                      <span
                        aria-hidden="true"
                        className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"
                      />

                      <button
                        type="button"
                        aria-label={t("formatBold")}
                        title={t("formatBold")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyInlineMarkdown("**", "**", "bold")}
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Bold className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("formatItalic")}
                        title={t("formatItalic")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyInlineMarkdown("*", "*", "italic")}
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Italic className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("formatUnderline")}
                        title={t("formatUnderline")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          applyInlineMarkdown("<u>", "</u>", "underlined")
                        }
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Underline className="size-3.5" aria-hidden="true" />
                      </button>

                      <span
                        aria-hidden="true"
                        className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"
                      />

                      <button
                        type="button"
                        aria-label={t("formatBulletList")}
                        title={t("formatBulletList")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLinePrefix("- ")}
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <List className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("formatNumberedList")}
                        title={t("formatNumberedList")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLinePrefix("1. ")}
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <ListOrdered className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("formatChecklist")}
                        title={t("formatChecklist")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLinePrefix("- [ ] ")}
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <ListChecks className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("formatLink")}
                        title={t("formatLink")}
                        disabled={!!confirmation || busy}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          applyInlineMarkdown("[", "](https://)", "link")
                        }
                        className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-200/70 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Link2 className="size-3.5" aria-hidden="true" />
                      </button>

                      {/* Right-aligned Improve with AI dropdown */}
                      <div ref={toolbarAiRef} className="relative ms-auto">
                        <button
                          type="button"
                          aria-expanded={toolbarAiOpen}
                          disabled={aiActionDisabled}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setToolbarAiOpen((v) => !v)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/70 bg-brand-50/60 px-2.5 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100/70 disabled:opacity-40 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                        >
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          <span>{t("improveWithAgent")}</span>
                          <ChevronDown className="size-3" aria-hidden="true" />
                        </button>
                        {toolbarAiOpen && (
                          <div className="absolute end-0 z-30 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                            {textTools.map(({ operation, key, Icon }) => (
                              <button
                                key={operation}
                                type="button"
                                disabled={aiActionDisabled}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setToolbarAiOpen(false);
                                  void send(operation, t(`prompts.${key}`));
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
                              >
                                <Icon
                                  className="size-3.5 shrink-0 text-gray-400"
                                  aria-hidden="true"
                                />
                                <span>{t(`quick.${key}`)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Region (4): Textarea + Compact Floating Selection AI Badge (No overlapping popups) */}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      {appliedHighlight &&
                        (() => {
                          const normalizedContent =
                            fields.contentMarkdown.replace(/\r\n?/g, "\n");
                          if (
                            appliedHighlight.start < 0 ||
                            appliedHighlight.end <= appliedHighlight.start ||
                            appliedHighlight.end > normalizedContent.length
                          ) {
                            return null;
                          }
                          return (
                            <div
                              ref={highlightBackdropRef}
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-xl p-4 font-sans text-sm leading-7 break-words whitespace-pre-wrap text-transparent select-none"
                            >
                              <span>
                                {normalizedContent.slice(
                                  0,
                                  appliedHighlight.start,
                                )}
                              </span>
                              <mark
                                data-testid="applied-selection-highlight"
                                className="rounded-xs bg-success-100/95 py-0.5 text-transparent ring-2 ring-success-200/75 dark:bg-success-500/25 dark:ring-success-500/30"
                              >
                                {normalizedContent.slice(
                                  appliedHighlight.start,
                                  appliedHighlight.end,
                                )}
                              </mark>
                              <span>
                                {normalizedContent.slice(appliedHighlight.end)}
                                {normalizedContent.endsWith("\n") ? "\n" : ""}
                              </span>
                            </div>
                          );
                        })()}
                      <label
                        htmlFor="worknote-composer-content"
                        className="sr-only"
                      >
                        {t("content")}
                      </label>
                      <textarea
                        id="worknote-composer-content"
                        ref={body}
                        value={fields.contentMarkdown}
                        placeholder={t("contentPlaceholder")}
                        maxLength={30000}
                        disabled={!!confirmation || busy}
                        rows={11}
                        onPointerDown={() => {
                          pointerSelectingRef.current = true;
                          setSelectionBadgeReady(false);
                        }}
                        onMouseDown={() => {
                          pointerSelectingRef.current = true;
                          setSelectionBadgeReady(false);
                        }}
                        onChange={(e) => {
                          editor.change({
                            ...fields,
                            contentMarkdown: reconcileTextareaEdit(
                              fields.contentMarkdown,
                              e.target.value,
                            ),
                          });
                          setAppliedHighlight(null);
                          clearSelectionUi();
                        }}
                        onSelect={() =>
                          syncSelection(null, !pointerSelectingRef.current)
                        }
                        onScroll={() => {
                          if (highlightBackdropRef.current && body.current) {
                            highlightBackdropRef.current.scrollTop =
                              body.current.scrollTop;
                          }
                          if (!selectionBadgeReady || !body.current) {
                            return;
                          }
                          setSelectionPoint(
                            computeTextareaSelectionPoint(
                              body.current,
                              body.current.selectionEnd,
                              null,
                            ),
                          );
                        }}
                        onKeyUp={(e) => {
                          if (
                            !pointerSelectingRef.current &&
                            (e.key.startsWith("Arrow") ||
                              e.key === "Home" ||
                              e.key === "End" ||
                              e.key === "PageUp" ||
                              e.key === "PageDown")
                          ) {
                            syncSelection(null, true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            (e.ctrlKey || e.metaKey) &&
                            e.shiftKey &&
                            e.key.toLowerCase() === "a"
                          ) {
                            e.preventDefault();
                            syncSelection(null, false);
                            const el = body.current;
                            if (el && el.selectionStart !== el.selectionEnd) {
                              const currentSel = sourceSelection(
                                fields.contentMarkdown,
                                el.selectionStart,
                                el.selectionEnd,
                              );
                              if (currentSel?.quote.trim()) {
                                setSelectionPromptQuote(
                                  currentSel.quote.trim(),
                                );
                              }
                            }
                            setPanelToggle(true);
                            setAssistantTab("chat");
                            setTimeout(() => chatInput.current?.focus(), 0);
                          }
                        }}
                        className="relative z-10 min-h-72 w-full flex-1 resize-y rounded-b-xl border-0 bg-transparent p-4 font-sans text-sm leading-7 text-gray-900 outline-none focus:ring-0 dark:text-gray-100"
                      />
                      {!confirmation &&
                        selection &&
                        selection.quote.trim() &&
                        selectionBadgeReady && (
                          <WorkNoteSelectionAssistant
                            selection={selection}
                            point={selectionPoint}
                            disabled={busy || editor.agentBusy}
                            onActivate={openAiChatForSelection}
                          />
                        )}
                    </div>
                  </div>

                  {/* Character Count + Live Auto-Save Status Row */}
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {t("characterCount", {
                        count: fields.contentMarkdown.length,
                        max: 30000,
                      })}
                    </span>
                    <div
                      role="status"
                      aria-live="polite"
                      className="inline-flex items-center gap-1.5 font-medium"
                    >
                      {editor.agentBusy || editor.saving ? (
                        <Loader2
                          className="size-3.5 animate-spin text-brand-500"
                          aria-hidden="true"
                        />
                      ) : !editor.dirty && !editor.query.isError ? (
                        <CheckCircle2
                          className="size-3.5 text-success-500"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{statusText}</span>
                    </div>
                  </div>

                  {/* Uncertainties when no inline proposal card is active */}
                  {!activeSuggestion &&
                    !!editor.response?.uncertainties.length && (
                      <ul className="rounded-xl border border-warning-200 bg-warning-50/60 p-3 text-xs text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                        {editor.response.uncertainties.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    )}

                  {/* Version History */}
                  {historyOpen && d?.noteId && (
                    <WorkNoteHistory
                      api={editor.historyApi}
                      workflow={d.workflow}
                      projectId={projectId}
                      taskId={taskId}
                      noteId={d.noteId}
                      disabled={
                        busy ||
                        editor.dirty ||
                        d.hasAppliedRewrite ||
                        d.baseNoteVersion < 1
                      }
                      onRestore={(version) => {
                        setRestoreVersion(version);
                        setConfirmation("restore");
                      }}
                    />
                  )}
                </div>

                {/* Region (6): Left-Column Pinned Final Action Bar */}
                <footer className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-gray-200/80 bg-white px-4 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
                  <button
                    type="button"
                    disabled={!d || busy || editor.saving}
                    onClick={() => setConfirmation("discard")}
                    className="rounded-xl border border-error-200 bg-white px-4 py-2 text-sm font-semibold text-error-600 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-error-500/30 dark:bg-gray-900 dark:text-error-400 dark:hover:bg-error-500/10"
                  >
                    {t("discard")}
                  </button>
                  <span className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("retention")}
                  </span>
                  {d?.noteId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryOpen((v) => !v)}
                    >
                      {t("history")}
                    </Button>
                  )}
                  {!source && (
                    <button
                      type="button"
                      disabled={!d || editor.saving || busy || !!confirmation}
                      onClick={() => void run(() => editor.persist())}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {t("saveAsDraft")}
                    </button>
                  )}
                  <Button
                    size="sm"
                    disabled={
                      !fields.title.trim() ||
                      !fields.contentMarkdown.trim() ||
                      editor.saving ||
                      busy ||
                      !!confirmation
                    }
                    onClick={() =>
                      d?.hasAppliedRewrite
                        ? setConfirmation("save")
                        : void run(() => editor.save(false))
                    }
                  >
                    {t(source ? "saveDraft" : "save")}
                  </Button>
                </footer>
              </div>

              {/* Region (7): Collapsible Right-Hand AI Chat Panel */}
              {panelOpen && (
                <aside
                  id="worknote-ai-panel"
                  aria-label={t("assistantTitle")}
                  className="flex min-h-[460px] flex-col border-t border-gray-200/90 bg-white lg:min-h-0 lg:border-t-0 lg:border-s dark:border-gray-800 dark:bg-gray-900"
                >
                  {/* Panel Header + Collapse Button [⌃] */}
                  <div className="flex shrink-0 items-start gap-2.5 px-4 pt-4 pb-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {t("assistantTitle")}
                        </h3>
                        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          {t("assistantBadge")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                          assistantTab === "chat"
                            ? "assistantSubtitle"
                            : "assistantSuggestionsSubtitle",
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t("collapsePanel")}
                      title={t("collapsePanel")}
                      onClick={() => setPanelToggle(false)}
                      className="rounded-xl border border-gray-200 bg-white p-1.5 text-gray-600 shadow-2xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Region (8): 3-Tab Segmented Switcher (Trò chuyện | Gợi ý | Ngữ cảnh công việc) */}
                  <div className="mx-4 mb-3 flex shrink-0 items-stretch gap-1 rounded-xl bg-gray-100/90 px-1.5 pt-1 dark:bg-gray-800">
                    {(
                      [
                        ["chat", "tabChat"],
                        ["suggestions", "tabSuggestions"],
                        ["context", "tabTaskContext"],
                      ] as const
                    ).map(([tabKey, labelKey]) => (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setAssistantTab(tabKey)}
                        className={`flex-1 border-b-2 px-2 pt-1.5 pb-2 text-center text-xs whitespace-nowrap transition-all ${
                          assistantTab === tabKey
                            ? "rounded-t-lg border-brand-600 bg-white font-bold text-brand-600 shadow-2xs dark:border-brand-400 dark:bg-gray-900 dark:text-brand-300"
                            : "border-transparent font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>

                  {assessmentEnabled && (
                    <div className="max-h-[48%] shrink-0 overflow-y-auto border-b border-gray-100 px-4 pb-3 dark:border-gray-800">
                      <WorkNoteAssessment
                        key={d?.assessment?.id ?? "new-assessment"}
                        value={d?.assessment}
                        stale={
                          editor.dirty ||
                          (!!d?.assessment &&
                            d.assessment.sourceRevision !== d.revision)
                        }
                        busy={
                          busy ||
                          editor.agentBusy ||
                          editor.saving ||
                          !!confirmation ||
                          !d
                        }
                        onAssess={(purpose) =>
                          void requestAssessment(() => editor.assess(purpose))
                        }
                        onReply={(disposition, answer) =>
                          void requestAssessment(() =>
                            editor.replyAssessment(disposition, answer),
                          )
                        }
                        onRewrite={() =>
                          void requestAssessment(editor.rewriteAssessment, true)
                        }
                        onCorrect={(target, text) =>
                          void requestAssessment(() =>
                            editor.correctAssessment(target, text),
                          )
                        }
                        onReset={(purpose, carry) =>
                          void requestAssessment(() =>
                            editor.resetAssessment(purpose, carry),
                          )
                        }
                        onValidate={() =>
                          void requestAssessment(editor.validateAssessment)
                        }
                        onFeedback={(category) =>
                          void requestAssessment(() =>
                            editor.feedbackAssessment(category),
                          )
                        }
                      />
                    </div>
                  )}

                  {/* TAB 1: TRÒ CHUYỆN (Regions 9, 10, 11) */}
                  {assistantTab === "chat" && (
                    <WorkNoteAgentChat
                      draft={d}
                      before={fields}
                      selectionPromptQuote={selectionPromptQuote}
                      suggestion={activeSuggestion}
                      suggestionStale={
                        !!activeSuggestion &&
                        (editor.dirty ||
                          activeSuggestion.baseRevision !== d?.revision)
                      }
                      uncertainties={editor.response?.uncertainties}
                      busy={busy || !!confirmation}
                      thinking={editor.agentBusy}
                      pendingUserMessage={editor.pendingMessage}
                      message={instruction}
                      onMessage={setInstruction}
                      onQuickOption={(operation, promptText) =>
                        void send(operation, promptText)
                      }
                      onSend={(text, disposition) =>
                        void send("custom", text, disposition)
                      }
                      onApplySuggestion={(action, applyTitle, edited) => {
                        if (activeSuggestion) {
                          applyProposalAction(
                            activeSuggestion,
                            action,
                            applyTitle,
                            edited,
                          );
                        }
                      }}
                      onDismissSuggestion={() => {
                        if (activeSuggestion) {
                          setDismissed(activeSuggestion.id);
                          editor.setResponse(null);
                        }
                      }}
                      onRegenerateSuggestion={() =>
                        void requestAgent(editor.regenerate)
                      }
                      onReset={() => void run(editor.reset)}
                      inputRef={chatInput}
                    />
                  )}

                  {/* TAB 2: GỢI Ý */}
                  {assistantTab === "suggestions" && (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                      {/* Section 1: Chỉnh sửa văn bản (2x3 Grid) */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {t("suggestSectionTextEdit")}
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          {suggestGridTools.map(
                            ({ id, operation, labelKey, promptKey, Icon }) => (
                              <button
                                key={id}
                                type="button"
                                disabled={aiActionDisabled}
                                title={
                                  !hasNoteContent
                                    ? t("emptyNoteToolHint")
                                    : undefined
                                }
                                onClick={() =>
                                  void send(operation, t(`prompts.${promptKey}`))
                                }
                                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-2.5 py-3 text-center text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/45 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                              >
                                <Icon
                                  className="size-4 text-gray-600 dark:text-gray-300"
                                  aria-hidden="true"
                                />
                                <span className="leading-snug">
                                  {t(`suggestGrid.${labelKey}`)}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Section 2: Làm việc với toàn bộ ghi chú */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {t("suggestSectionWholeNote")}
                        </h4>
                        <div className="space-y-2">
                          {wholeNoteTools.map(
                            ({
                              id,
                              operation,
                              titleKey,
                              descKey,
                              prompt,
                              allowEmptyNote,
                              badgeClass,
                              Icon,
                            }) => {
                              const rowDisabled =
                                aiRequestBusy ||
                                (!allowEmptyNote && !hasNoteContent);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  disabled={rowDisabled}
                                  title={
                                    !allowEmptyNote && !hasNoteContent
                                      ? t("emptyNoteToolHint")
                                      : undefined
                                  }
                                  onClick={() =>
                                    void send(
                                      operation,
                                      prompt,
                                      undefined,
                                      "whole_note",
                                    )
                                  }
                                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 text-start shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/35 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}
                                  >
                                    <Icon
                                      className="size-4"
                                      aria-hidden="true"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-bold text-gray-900 dark:text-gray-100">
                                      {t(`wholeNoteActions.${titleKey}`)}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                      {t(`wholeNoteActions.${descKey}`)}
                                    </span>
                                  </span>
                                  <ChevronRight
                                    className="size-4 shrink-0 text-gray-400"
                                    aria-hidden="true"
                                  />
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {/* Section 3: Làm việc với đoạn được chọn */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {t("suggestSectionSelection")}
                        </h4>
                        <button
                          type="button"
                          disabled={aiRequestBusy || !hasActiveSelection}
                          title={
                            !hasActiveSelection
                              ? t("selectionAnalyzeEmptyHint")
                              : undefined
                          }
                          onClick={() =>
                            void send("custom", t("selectionAnalyzePrompt"))
                          }
                          className="flex w-full items-center gap-3 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 text-start shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/35 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                        >
                          <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
                          >
                            <Sparkles className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-gray-900 dark:text-gray-100">
                              {t("selectionAnalyzeTitle")}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                              {t("selectionAnalyzeDesc")}
                            </span>
                          </span>
                          <ChevronRight
                            className="size-4 shrink-0 text-gray-400"
                            aria-hidden="true"
                          />
                        </button>
                        {!hasActiveSelection && (
                          <p className="px-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {t("selectionAnalyzeEmptyHint")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: NGỮ CẢNH TASK */}
                  {assistantTab === "context" && (
                    <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-4">
                      {!source ? (
                        <WorkNoteContext
                          projectId={projectId}
                          taskId={taskId}
                          selection={selection}
                          fullContext={false}
                        />
                      ) : (
                        <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-600 shadow-2xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                          <p>
                            {t(
                              source.workflow === "PROJECT_DOCUMENT"
                                ? "documentContext"
                                : "reportContext",
                            )}
                            {source.workflow === "WORK_REPORT" &&
                            typeof d?.context?.periodStart === "string" &&
                            typeof d.context.periodEnd === "string"
                              ? ` ${d.context.periodStart.slice(0, 10)} – ${d.context.periodEnd.slice(0, 10)}`
                              : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal Overlay */}
        {confirmation && (
          <div
            ref={confirmPanel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="agent-confirm-title"
            onKeyDown={(e) => {
              trap(e);
              if (e.key === "Tab") e.stopPropagation();
            }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
              <h3 id="agent-confirm-title" className="text-lg font-bold">
                {t(
                  confirmation === "save"
                    ? "confirmOriginal"
                    : confirmation === "restore"
                      ? "confirmRestoreTitle"
                      : "confirmDiscard",
                )}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(
                  confirmation === "save"
                    ? "confirmOriginalBody"
                    : confirmation === "restore"
                      ? "confirmRestore"
                      : "confirmDiscardBody",
                )}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmation(null)}
                >
                  {t("keepEditing")}
                </Button>
                <Button
                  size="sm"
                  disabled={busy || editor.saving}
                  onClick={() =>
                    void run(async () => {
                      if (confirmation === "save") await editor.save(true);
                      else if (
                        confirmation === "restore" &&
                        restoreVersion !== null
                      ) {
                        await editor.restore(restoreVersion);
                      } else {
                        await editor.discard();
                        onClose();
                      }
                      setConfirmation(null);
                    })
                  }
                >
                  {t(
                    confirmation === "save"
                      ? "confirmSave"
                      : confirmation === "restore"
                        ? "confirmRestoreAction"
                        : "discard",
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
  );

  if (isInline) {
    return composerSection;
  }

  return (
    <Modal
      isOpen
      isFullscreen
      showCloseButton={false}
      onClose={() => dismissStepRef.current()}
    >
      {composerSection}
    </Modal>
  );
}
