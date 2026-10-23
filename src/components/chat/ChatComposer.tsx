"use client";
import { matchesNamePrefixes } from "./search-text";

import Image from "next/image";
import { PaperPlaneIcon, PlusIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

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

type ChatComposerProps = Readonly<{
  disabled?: boolean;
  isSending: boolean;
  replyContext?: Readonly<{ id: string; name: string; text: string }> | null;
  onCancelReply?: () => void;
  onSend: (
    content: string,
    clientMessageId: string,
    files: readonly File[],
    mentionUserIds?: readonly string[],
  ) => Promise<boolean>;
  initialValue?: string;
  initialMentionUserIds?: readonly string[];
  onDraftChange?: (content: string, mentionUserIds: readonly string[]) => void;
  members?: readonly { userId: string; displayName: string }[];
  onTyping: (isTyping: boolean) => void;
}>;

export default function ChatComposer({
  disabled = false,
  isSending,
  replyContext = null,
  onCancelReply,
  onSend,
  onTyping,
  initialValue = "",
  initialMentionUserIds = [],
  onDraftChange,
  members = [],
}: ChatComposerProps) {
  const t = useTranslations("chat");
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [mentions, setMentions] = useState<string[]>([
    ...initialMentionUserIds,
  ]);
  const mentionTerm = value.match(/(?:^|\s)@([^@\n]*)$/u)?.[1];
  const mentionMatches =
    mentionTerm === undefined
      ? []
      : members
          .filter((member) =>
            matchesNamePrefixes(member.displayName, mentionTerm),
          )
          .slice(0, 8);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = value.trim();
    if ((!content && files.length === 0) || disabled || submitting || isSending)
      return;
    setSubmitting(true);
    const activeMentionIds = mentions.filter((id) => {
      const member = members.find((entry) => entry.userId === id);
      return member && value.includes(`@${member.displayName}`);
    });
    const pending = pendingSend.current;
    const fingerprint = `${replyContext?.id ?? ""}\u0000${content}\u0000${fileFingerprint}\u0000${[...activeMentionIds].sort().join(",")}`;
    const clientMessageId =
      pending?.fingerprint === fingerprint ? pending.id : crypto.randomUUID();
    pendingSend.current = { fingerprint, id: clientMessageId };
    try {
      if (
        await onSend(
          content,
          clientMessageId,
          files.map(({ file }) => file),
          activeMentionIds,
        )
      ) {
        pendingSend.current = null;
        setValue("");
        setMentions([]);
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
      className="shrink-0 bg-white p-3 dark:bg-gray-900"
    >
      {mentionMatches.length > 0 && (
        <div
          role="group"
          aria-label={t("mentionMember")}
          className="mb-2 max-h-40 overflow-auto rounded-xl border border-gray-200 p-1 dark:border-gray-700"
        >
          {mentionMatches.map((member) => (
            <button
              type="button"
              key={member.userId}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                const content = value.replace(
                  /@[^@\n]*$/u,
                  `@${member.displayName} `,
                );
                setValue(content);
                onDraftChange?.(content, [
                  ...new Set([...mentions, member.userId]),
                ]);
                setMentions((current) => [
                  ...new Set([...current, member.userId]),
                ]);
                textareaRef.current?.focus();
              }}
            >
              {member.displayName}
            </button>
          ))}
        </div>
      )}
      {replyContext && (
        <div className="mb-3 flex items-start justify-between gap-3 border-s-2 border-brand-400 bg-gray-50 px-3 py-2 dark:bg-gray-900">
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
            className="shrink-0 px-2 text-sm text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>
      )}
      {files.length > 0 && (
        <ul
          className="mb-3 flex flex-wrap gap-2"
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
      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-brand-400 dark:border-gray-700 dark:bg-gray-950">
        <label
          title={t("attachFiles")}
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-600 focus-within:outline-2 focus-within:outline-brand-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <PlusIcon width={20} height={20} className="h-5 w-5" />
          <span className="sr-only">{t("attachFiles")}</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            disabled={disabled || submitting || isSending}
            className="sr-only"
            onChange={(event) => {
              const incoming = Array.from(event.currentTarget.files ?? []);
              const combined = [
                ...files,
                ...incoming.map((file) => ({ file, previewUrl: null })),
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
                    if (!selected.file.type.startsWith("image/"))
                      return selected;
                    const previewUrl = URL.createObjectURL(selected.file);
                    previewUrls.current.add(previewUrl);
                    return { ...selected, previewUrl };
                  }),
                );
              }
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
          onChange={(event) => {
            setValue(event.target.value);
            onDraftChange?.(
              event.target.value,
              mentions.filter((id) => {
                const member = members.find((entry) => entry.userId === id);
                return (
                  member &&
                  event.target.value.includes(`@${member.displayName}`)
                );
              }),
            );
            onTyping(Boolean(event.target.value.trim()));
          }}
          onBlur={() => onTyping(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-36 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0 disabled:cursor-not-allowed dark:text-gray-100 dark:placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={
            disabled ||
            submitting ||
            isSending ||
            (!value.trim() && files.length === 0)
          }
          aria-label={t("send")}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PaperPlaneIcon width={18} height={18} className="h-4.5 w-4.5" />
          <span className="hidden sm:inline">
            {t(submitting || isSending ? "sending" : "send")}
          </span>
        </button>
      </div>
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
