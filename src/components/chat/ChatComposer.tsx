"use client";
import { matchesNamePrefixes } from "./search-text";
import {
  buildAssistantMentionInput,
  extractAssistantMentionQuery,
  hasAssistantMentionToken,
  matchesAssistantMentionTerm,
  MAX_ASSISTANT_QUERY_LENGTH,
} from "./assistant-utils";

import Image from "next/image";
import { CloseLineIcon, PaperPlaneIcon, PlusIcon, ShootingStarIcon } from "@/icons";
import {
  CONTINUUM_AI_HANDLE,
  type ChatAssistantMentionInput,
} from "@/lib/queries/chat/useChat";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type SelectedFileData = Readonly<{ file: File; previewUrl: string | null }>;

function SelectedFile({
  selected,
  onRemove,
}: Readonly<{ selected: SelectedFileData; onRemove: () => void }>) {
  const t = useTranslations("chat");
  const { file, previewUrl } = selected;

  return (
    <li className="flex max-w-full items-center gap-2 border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt=""
          width={52}
          height={40}
          unoptimized
          className="h-10 w-[52px] shrink-0 object-cover"
        />
      ) : (
        <span aria-hidden="true" className="text-gray-400">
          ▤
        </span>
      )}
      <span className="max-w-56 truncate">{file.name}</span>
      <button
        type="button"
        aria-label={t("removeFile", { name: file.name })}
        onClick={onRemove}
        className="text-gray-500 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        ×
      </button>
    </li>
  );
}

type MentionOption =
  | Readonly<{ kind: "assistant"; id: typeof CONTINUUM_AI_HANDLE }>
  | Readonly<{ kind: "member"; userId: string; displayName: string }>;

type ChatComposerProps = Readonly<{
  disabled?: boolean;
  compact?: boolean;
  dmAssistantEnabled?: boolean;
  isSending: boolean;
  replyContext?: Readonly<{ id: string; name: string; text: string }> | null;
  onCancelReply?: () => void;
  onSend: (
    content: string,
    clientMessageId: string,
    files: readonly File[],
    mentionUserIds?: readonly string[],
    assistantMention?: ChatAssistantMentionInput,
  ) => Promise<boolean>;
  initialValue?: string;
  initialMentionUserIds?: readonly string[];
  initialAssistantMention?: boolean;
  onDraftChange?: (
    content: string,
    mentionUserIds: readonly string[],
    assistantMention?: boolean,
  ) => void;
  members?: readonly { userId: string; displayName: string }[];
  onTyping: (isTyping: boolean) => void;
}>;

export default function ChatComposer({
  disabled = false,
  compact = false,
  dmAssistantEnabled = false,
  isSending,
  replyContext = null,
  onCancelReply,
  onSend,
  onTyping,
  initialValue = "",
  initialMentionUserIds = [],
  initialAssistantMention = false,
  onDraftChange,
  members = [],
}: ChatComposerProps) {
  const t = useTranslations("chat");
  const inputId = useId();
  const listboxId = useId();
  const [value, setValue] = useState(initialValue);
  const [mentions, setMentions] = useState<string[]>([
    ...initialMentionUserIds,
  ]);
  const [assistantSelected, setAssistantSelected] = useState<boolean>(() =>
    Boolean(initialAssistantMention && hasAssistantMentionToken(initialValue)),
  );
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [dismissedMentionTerm, setDismissedMentionTerm] = useState<
    string | null
  >(null);
  const [assistantQueryError, setAssistantQueryError] = useState<
    "empty" | "tooLong" | null
  >(null);
  const isComposingRef = useRef(false);

  const mentionTerm = value.match(/(?:^|\s)@([^@\n]*)$/u)?.[1];
  const isMentionDismissed =
    mentionTerm !== undefined && dismissedMentionTerm === mentionTerm;
  const showAssistantOption =
    dmAssistantEnabled &&
    mentionTerm !== undefined &&
    !isMentionDismissed &&
    matchesAssistantMentionTerm(mentionTerm);
  const memberMatches =
    mentionTerm === undefined || isMentionDismissed
      ? []
      : members
          .filter((member) =>
            matchesNamePrefixes(member.displayName, mentionTerm),
          )
          .slice(0, 8);
  const mentionOptions: MentionOption[] = [
    ...(showAssistantOption
      ? [{ kind: "assistant" as const, id: CONTINUUM_AI_HANDLE }]
      : []),
    ...memberMatches.map((member) => ({
      kind: "member" as const,
      userId: member.userId,
      displayName: member.displayName,
    })),
  ];
  const isMentionOpen = mentionOptions.length > 0;
  const safeActiveMentionIndex = isMentionOpen
    ? Math.min(activeMentionIndex, mentionOptions.length - 1)
    : 0;
  const effectiveAssistantSelected = Boolean(
    dmAssistantEnabled && assistantSelected && hasAssistantMentionToken(value),
  );
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<SelectedFileData[]>([]);
  const [fileError, setFileError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSend = useRef<{ fingerprint: string; id: string } | null>(null);
  const previewUrls = useRef(new Set<string>());
  const fileFingerprint = files
    .map(
      ({ file }) =>
        `${file.name}:${file.size}:${file.type}:${file.lastModified}`,
    )
    .join("|");

  useEffect(() => {
    const input = textareaRef.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = value ? `${Math.max(input.scrollHeight, 36)}px` : "36px";
    }
  }, [value]);

  useEffect(() => {
    if (replyContext?.id) textareaRef.current?.focus();
  }, [replyContext?.id]);

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  function removeFile(index: number) {
    const removed = files[index];
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrls.current.delete(removed.previewUrl);
    }
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  function addIncomingFiles(incoming: readonly File[]) {
    if (incoming.length === 0 || disabled || submitting || isSending) return;

    const normalizedIncoming = incoming.map((file, idx) => {
      let ext = "";
      if (file.name && file.name.includes(".")) {
        ext = file.name.split(".").pop()?.toLowerCase() || "";
      } else if (file.type) {
        ext = file.type.split("/")[1]?.replace("+xml", "").toLowerCase() || "";
      }

      const isImage =
        Boolean(file.type?.startsWith("image/")) ||
        /^(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(ext);

      let mimeType = file.type;
      if (!mimeType || mimeType === "application/octet-stream") {
        if (/^png$/i.test(ext)) mimeType = "image/png";
        else if (/^jpe?g$/i.test(ext)) mimeType = "image/jpeg";
        else if (/^webp$/i.test(ext)) mimeType = "image/webp";
        else if (/^gif$/i.test(ext)) mimeType = "image/gif";
        else if (/^svg$/i.test(ext)) mimeType = "image/svg+xml";
        else if (/^pdf$/i.test(ext)) mimeType = "application/pdf";
      }

      const effectiveExt = ext || (isImage ? "png" : "bin");
      const prefix = isImage ? "image" : "file";
      const safeName =
        !file.name || file.name === "blob"
          ? `${prefix}-${Date.now()}-${idx + 1}.${effectiveExt}`
          : file.name;

      const fallbackType = isImage ? "image/png" : "application/octet-stream";

      return new File([file], safeName, {
        type: mimeType || file.type || fallbackType,
        lastModified: file.lastModified || Date.now(),
      });
    });

    const combined = [
      ...files,
      ...normalizedIncoming.map((file) => ({ file, previewUrl: null })),
    ].filter(
      (selected, index, all) =>
        all.findIndex(
          ({ file }) =>
            file.name === selected.file.name &&
            file.size === selected.file.size &&
            file.lastModified === selected.file.lastModified,
        ) === index,
    );

    const invalidFile = combined.some(
      ({ file }) =>
        file.size >
        (file.type.startsWith("image/") ? 10 : 25) * 1024 * 1024,
    );

    setFileError(invalidFile || combined.length > 10);
    if (!invalidFile && combined.length <= 10) {
      setFiles(
        combined.map((selected) => {
          const existing = files.find(
            ({ file }) =>
              file.name === selected.file.name &&
              file.size === selected.file.size &&
              file.lastModified === selected.file.lastModified,
          );
          if (existing) return existing;
          if (!selected.file.type.startsWith("image/")) return selected;
          const previewUrl = URL.createObjectURL(selected.file);
          previewUrls.current.add(previewUrl);
          return { ...selected, previewUrl };
        }),
      );
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedFiles: File[] = [];

    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }
    } else if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      event.preventDefault();
      addIncomingFiles(pastedFiles);
    }
  }

  function emitDraftChange(
    nextContent: string,
    nextMentionIds: readonly string[],
    nextAssistantMention: boolean,
  ) {
    if (dmAssistantEnabled || nextAssistantMention || initialAssistantMention) {
      onDraftChange?.(nextContent, nextMentionIds, nextAssistantMention);
    } else {
      onDraftChange?.(nextContent, nextMentionIds);
    }
  }

  function filterActiveMentions(
    text: string,
    ids: readonly string[],
  ): string[] {
    return ids.filter((id) => {
      const member = members.find((entry) => entry.userId === id);
      return member && text.includes(`@${member.displayName}`);
    });
  }

  function selectMentionOption(option: MentionOption) {
    if (option.kind === "assistant") {
      const nextContent = value.replace(
        /@[^@\n]*$/u,
        `@${CONTINUUM_AI_HANDLE} `,
      );
      const nextMentions = filterActiveMentions(nextContent, mentions);
      setValue(nextContent);
      setAssistantSelected(true);
      setAssistantQueryError(null);
      setDismissedMentionTerm(null);
      setActiveMentionIndex(0);
      emitDraftChange(nextContent, nextMentions, true);
      onTyping(Boolean(nextContent.trim()));
      textareaRef.current?.focus();
      return;
    }

    const nextContent = value.replace(
      /@[^@\n]*$/u,
      `@${option.displayName} `,
    );
    const nextMentions = [...new Set([...mentions, option.userId])];
    const nextAssistant =
      assistantSelected && hasAssistantMentionToken(nextContent);
    setValue(nextContent);
    setMentions(nextMentions);
    setDismissedMentionTerm(null);
    setActiveMentionIndex(0);
    emitDraftChange(nextContent, nextMentions, nextAssistant);
    onTyping(Boolean(nextContent.trim()));
    textareaRef.current?.focus();
  }

  function activateAssistantTrigger() {
    if (!dmAssistantEnabled || disabled || submitting || isSending) return;
    const nextContent = hasAssistantMentionToken(value)
      ? value
      : value.trim().length === 0
        ? `@${CONTINUUM_AI_HANDLE} `
        : `@${CONTINUUM_AI_HANDLE} ${value.trimStart()}`;
    const nextMentions = filterActiveMentions(nextContent, mentions);
    setValue(nextContent);
    setAssistantSelected(true);
    setAssistantQueryError(null);
    setDismissedMentionTerm(null);
    setActiveMentionIndex(0);
    emitDraftChange(nextContent, nextMentions, true);
    onTyping(Boolean(nextContent.trim()));
    requestAnimationFrame(() => {
      const input = textareaRef.current;
      if (!input) return;
      input.focus();
      const end = nextContent.length;
      input.setSelectionRange(end, end);
    });
  }

  function removeAssistantTrigger() {
    const nextContent = extractAssistantMentionQuery(value);
    const nextMentions = filterActiveMentions(nextContent, mentions);
    setValue(nextContent);
    setAssistantSelected(false);
    setAssistantQueryError(null);
    emitDraftChange(nextContent, nextMentions, false);
    onTyping(Boolean(nextContent.trim()));
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const composing =
      isComposingRef.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229;
    if (composing) {
      return;
    }

    if (isMentionOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMentionIndex((current) => (current + 1) % mentionOptions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMentionIndex(
          (current) =>
            (current - 1 + mentionOptions.length) % mentionOptions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const chosen = mentionOptions[safeActiveMentionIndex];
        if (chosen) {
          selectMentionOption(chosen);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedMentionTerm(mentionTerm ?? null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = value.trim();
    if ((!content && files.length === 0) || disabled || submitting || isSending)
      return;

    let assistantMentionPayload: ChatAssistantMentionInput | undefined;
    if (effectiveAssistantSelected) {
      const extractedQuery = extractAssistantMentionQuery(content);
      if (!extractedQuery) {
        setAssistantQueryError("empty");
        textareaRef.current?.focus();
        return;
      }
      if (extractedQuery.length > MAX_ASSISTANT_QUERY_LENGTH) {
        setAssistantQueryError("tooLong");
        textareaRef.current?.focus();
        return;
      }
      assistantMentionPayload = buildAssistantMentionInput(extractedQuery);
    }

    setAssistantQueryError(null);
    setSubmitting(true);
    const activeMentionIds = filterActiveMentions(value, mentions);
    const pending = pendingSend.current;
    const assistantFingerprint = assistantMentionPayload
      ? `${assistantMentionPayload.handle}:${assistantMentionPayload.query ?? ""}:${assistantMentionPayload.timezone ?? ""}`
      : "";
    const fingerprint = `${replyContext?.id ?? ""}\u0000${content}\u0000${fileFingerprint}\u0000${[...activeMentionIds].sort().join(",")}\u0000${assistantFingerprint}`;
    const clientMessageId =
      pending?.fingerprint === fingerprint ? pending.id : crypto.randomUUID();
    pendingSend.current = { fingerprint, id: clientMessageId };
    try {
      const sent = assistantMentionPayload
        ? await onSend(
            content,
            clientMessageId,
            files.map(({ file }) => file),
            activeMentionIds,
            assistantMentionPayload,
          )
        : await onSend(
            content,
            clientMessageId,
            files.map(({ file }) => file),
            activeMentionIds,
          );
      if (sent) {
        pendingSend.current = null;
        setValue("");
        setMentions([]);
        setAssistantSelected(false);
        setAssistantQueryError(null);
        setDismissedMentionTerm(null);
        setActiveMentionIndex(0);
        for (const selected of files) {
          if (selected.previewUrl) {
            URL.revokeObjectURL(selected.previewUrl);
            previewUrls.current.delete(selected.previewUrl);
          }
        }
        setFiles([]);
        setFileError(false);
        onTyping(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={
        compact
          ? "relative shrink-0 border-t border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
          : "relative shrink-0 bg-white p-3 dark:bg-gray-900"
      }
    >
      {isMentionOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("mentionSuggestions")}
          className="absolute inset-x-2 bottom-full z-30 mb-1.5 max-h-44 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {mentionOptions.map((option, index) => {
            const isActive = index === safeActiveMentionIndex;
            const optionId = `${listboxId}-option-${index}`;
            if (option.kind === "assistant") {
              return (
                <div
                  key={option.id}
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="mention-option-continuum-ai"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveMentionIndex(index)}
                    onClick={() => selectMentionOption(option)}
                    className={`flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition ${
                      isActive
                        ? "bg-brand-50 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200"
                        : "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300"
                    >
                      <ShootingStarIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
                        @{CONTINUUM_AI_HANDLE}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {t("assistantMentionDescription")}
                      </span>
                    </span>
                  </button>
                </div>
              );
            }
            return (
              <div
                key={option.userId}
                id={optionId}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveMentionIndex(index)}
                  onClick={() => selectMentionOption(option)}
                  className={`block w-full truncate rounded-lg px-3 py-1.5 text-start text-xs transition ${
                    isActive
                      ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-200"
                      : "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {option.displayName}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {dmAssistantEnabled && (
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          {effectiveAssistantSelected ? (
            <div
              data-testid="chat-composer-ai-active-pill"
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 ps-2 pe-1 py-0.5 text-xs text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <ShootingStarIcon
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="shrink-0 font-semibold">
                @{CONTINUUM_AI_HANDLE}
              </span>
              {!compact && (
                <span className="hidden truncate text-xs text-brand-600/90 sm:inline dark:text-brand-300/80">
                  · {t("assistantScopeHint")}
                </span>
              )}
              <button
                type="button"
                aria-label={t("removeAssistantMention")}
                onClick={removeAssistantTrigger}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:bg-brand-500/25"
              >
                <CloseLineIcon className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled || submitting || isSending}
              data-testid="chat-composer-ai-trigger"
              aria-label={t("askContinuumAiAction")}
              onClick={activateAssistantTrigger}
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-gray-200/90 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
            >
              <ShootingStarIcon
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-brand-500 dark:text-brand-400"
              />
              <span className="truncate">@{CONTINUUM_AI_HANDLE}</span>
            </button>
          )}
        </div>
      )}
      {replyContext && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-s-2 border-brand-400 bg-gray-50 px-2.5 py-1.5 dark:bg-gray-800/70">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {t("replyingTo", { name: replyContext.name })}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {replyContext.text}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("cancelReply")}
            onClick={onCancelReply}
            className="shrink-0 px-1.5 text-sm text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>
      )}
      {files.length > 0 && (
        <ul
          className="mb-2 flex flex-wrap gap-1.5"
          aria-label={t("selectedFiles")}
        >
          {files.map((selected, index) => (
            <SelectedFile
              key={`${selected.file.name}-${selected.file.lastModified}-${index}`}
              selected={selected}
              onRemove={() => removeFile(index)}
            />
          ))}
        </ul>
      )}
      <div
        className={
          compact
            ? "flex min-w-0 items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 focus-within:border-brand-400 dark:border-gray-700 dark:bg-gray-950"
            : "flex min-w-0 items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand-400 dark:border-gray-700 dark:bg-gray-950"
        }
      >
        <label
          title={t("attachFiles")}
          className={
            compact
              ? "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-600 focus-within:outline-2 focus-within:outline-brand-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
              : "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-600 focus-within:outline-2 focus-within:outline-brand-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
          }
        >
          <PlusIcon width={20} height={20} className="h-4.5 w-4.5" />
          <span className="sr-only">{t("attachFiles")}</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            disabled={disabled || submitting || isSending}
            className="sr-only"
            onChange={(event) => {
              const incoming = Array.from(event.currentTarget.files ?? []);
              addIncomingFiles(incoming);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="sr-only" htmlFor={inputId}>
          {t("messagePlaceholder")}
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          rows={1}
          maxLength={8000}
          value={value}
          disabled={disabled || submitting || isSending}
          placeholder={t("messagePlaceholder")}
          aria-controls={isMentionOpen ? listboxId : undefined}
          aria-activedescendant={
            isMentionOpen
              ? `${listboxId}-option-${safeActiveMentionIndex}`
              : undefined
          }
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            const nextMentions = filterActiveMentions(nextValue, mentions);
            const nextAssistant =
              assistantSelected && hasAssistantMentionToken(nextValue);
            setValue(nextValue);
            if (nextAssistant !== assistantSelected) {
              setAssistantSelected(nextAssistant);
            }
            setAssistantQueryError(null);
            setActiveMentionIndex(0);
            if (dismissedMentionTerm !== null) {
              setDismissedMentionTerm(null);
            }
            emitDraftChange(nextValue, nextMentions, nextAssistant);
            onTyping(Boolean(nextValue.trim()));
          }}
          onBlur={() => onTyping(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={
            compact
              ? "max-h-28 min-h-8 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-xs leading-5 text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0 disabled:cursor-not-allowed dark:text-gray-100 dark:placeholder:text-gray-400"
              : "max-h-36 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0 disabled:cursor-not-allowed dark:text-gray-100 dark:placeholder:text-gray-400"
          }
        />
        <button
          type="submit"
          disabled={
            disabled ||
            submitting ||
            isSending ||
            (!value.trim() && files.length === 0)
          }
          title={t(submitting || isSending ? "sending" : "send")}
          aria-label={t("send")}
          className={
            compact
              ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              : "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          <PaperPlaneIcon width={18} height={18} className="h-4 w-4" />
          {!compact && (
            <span className="hidden sm:inline">
              {t(submitting || isSending ? "sending" : "send")}
            </span>
          )}
        </button>
      </div>
      {assistantQueryError && (
        <p
          role="alert"
          className="mt-1.5 text-xs text-error-600 dark:text-error-400"
        >
          {t(
            assistantQueryError === "tooLong"
              ? "assistantQueryTooLong"
              : "assistantQueryEmpty",
          )}
        </p>
      )}
      {fileError && (
        <p
          role="alert"
          className="mt-2 text-xs text-error-600 dark:text-error-400"
        >
          {t("fileLimitError")}
        </p>
      )}
    </form>
  );
}
