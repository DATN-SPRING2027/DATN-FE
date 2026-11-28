"use client";
import MessageContent from "./MessageContent";

import {
  isAssistantMessage,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import { MoreDotIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AssistantBubbleBody,
  AssistantTriggerStatusCard,
} from "./AssistantMessageCard";
import ChatAttachments from "./ChatAttachments";

export default function ChatMessageBubble({
  message,
  mine,
  showSender,
  groupStart,
  groupEnd,
  highlighted,
  compact = false,
  receipt,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onOpenContext,
  onForward,
  onPin,
  onReceipts,
  onReport,
  onRetryAssistant,
  conversationImages,
}: {
  message: ChatMessage;
  mine: boolean;
  showSender: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  highlighted: boolean;
  compact?: boolean;
  receipt?: string;
  onOpenContext?: (messageId: string) => void;
  onForward?: () => void;
  onPin?: () => void;
  onReceipts?: () => void;
  onReport?: () => void;
  onRetryAssistant?: (triggerMessage: ChatMessage) => Promise<boolean>;
  onReply: () => void;
  onEdit: (content: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onReaction: (emoji: string, active: boolean) => Promise<void>;
  conversationImages?: readonly ChatAttachment[];
}) {
  const t = useTranslations("chat");
  const isAssistant = isAssistantMessage(message);
  const effectiveMine = mine && !isAssistant;
  const allowForward = !isAssistant ? onForward : undefined;
  const allowReceipts = !isAssistant ? onReceipts : undefined;
  const isInsufficient = message.assistantStatus === "INSUFFICIENT_EVIDENCE";
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickingReaction, setPickingReaction] = useState(false);
  const [pending, setPending] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const popupOpen = menu || pickingReaction || confirmDelete;
  useLayoutEffect(() => {
    const panel = popover.current;
    const anchor = trigger.current;
    if (!popupOpen || !panel || !anchor) return;
    const bounds = anchor.getBoundingClientRect();
    const margin = 8;
    const left = effectiveMine ? bounds.right - panel.offsetWidth : bounds.left;
    const below = bounds.bottom + margin;
    const top =
      below + panel.offsetHeight <= window.innerHeight - margin
        ? below
        : bounds.top - panel.offsetHeight - margin;
    panel.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - panel.offsetWidth - margin))}px`;
    panel.style.top = `${Math.max(margin, top)}px`;
    panel.style.visibility = "visible";
  }, [popupOpen, menu, pickingReaction, confirmDelete, effectiveMine]);
  useEffect(() => {
    if (!menu && !pickingReaction && !confirmDelete) return;
    const close = () => {
      setMenu(false);
      setPickingReaction(false);
      setConfirmDelete(false);
    };
    const pointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !row.current?.contains(event.target) &&
        !popover.current?.contains(event.target)
      )
        close();
    };
    const scroll = (event: Event) => {
      if (
        event.target instanceof Node &&
        popover.current?.contains(event.target)
      )
        return;
      close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [menu, pickingReaction, confirmDelete]);
  const mutate = async (action: () => Promise<boolean>) => {
    if (pending) return;
    setPending(true);
    try {
      if (await action()) {
        setEditing(false);
        setConfirmDelete(false);
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <div
      id={`chat-message-${message.id}`}
      data-message-id={message.id}
      data-author-type={isAssistant ? "ASSISTANT" : "USER"}
      tabIndex={-1}
      className={`flex scroll-mt-4 outline-none ${effectiveMine ? "justify-end" : "justify-start"} ${groupStart ? "pt-4" : "pt-1"}`}
    >
      <div
        ref={row}
        className={`group relative flex flex-col ${
          isAssistant
            ? compact
              ? "w-full max-w-[96%] items-start"
              : "w-full max-w-[94%] items-start sm:max-w-[82%]"
            : `max-w-[85%] sm:max-w-[75%] ${effectiveMine ? "items-end" : "items-start"}`
        }`}
      >
        {!isAssistant && showSender && groupStart && (
          <span className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {message.senderName}
          </span>
        )}
        {isAssistant ? (
          <div
            className={`relative w-full min-w-0 rounded-2xl rounded-es-md border px-3.5 py-3 shadow-theme-xs ${
              isInsufficient
                ? "border-gray-200/90 bg-gray-50/95 text-gray-900 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100"
                : "border-brand-200/80 bg-brand-25/90 text-gray-900 dark:border-brand-500/25 dark:bg-brand-950/35 dark:text-gray-100"
            } ${highlighted ? "ring-2 ring-warning-500 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
          >
            <AssistantBubbleBody
              message={message}
              compact={compact}
              onOpenContext={onOpenContext}
              actionButton={
                !message.deletedAt ? (
                  <button
                    ref={trigger}
                    type="button"
                    aria-label={t("messageActions")}
                    aria-expanded={menu}
                    onClick={() => {
                      setMenu(!menu);
                      setConfirmDelete(false);
                      setPickingReaction(false);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-100/70 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-brand-500/20 dark:hover:text-gray-100"
                  >
                    <MoreDotIcon className="h-4 w-4" />
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div
            className={`relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${effectiveMine ? "rounded-ee-md bg-brand-500 text-white" : "rounded-es-md bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"} ${highlighted ? "ring-2 ring-warning-500 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
          >
            {editing ? (
              <form
                className="w-60 max-w-full space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate(() => onEdit(draft.trim()));
                }}
              >
                <textarea
                  autoFocus
                  aria-label={t("editMessage")}
                  value={draft}
                  maxLength={8000}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-20 w-full resize-y border-0 bg-transparent text-sm outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditing(false)}
                    className="min-h-9 rounded-lg px-2 text-xs hover:bg-black/10 focus-visible:outline-2"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !draft.trim()}
                    className="min-h-9 rounded-lg bg-white/20 px-3 text-xs font-semibold focus-visible:outline-2 disabled:opacity-50"
                  >
                    {t("save")}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {message.replyTo && (
                  <button
                    type="button"
                    onClick={() => onOpenContext?.(message.replyTo!.id)}
                    aria-label={t("viewMessageContext")}
                    className={`mb-2 border-s-2 ps-2 text-start ${effectiveMine ? "border-white/60 text-white/90" : "border-brand-400 text-gray-700 dark:text-gray-300"}`}
                  >
                    <p className="text-xs font-semibold">
                      {message.replyTo.senderName}
                    </p>
                    <p className="line-clamp-2 text-xs break-words">
                      {message.replyTo.deleted
                        ? t("messageDeleted")
                        : message.replyTo.preview || t("attachment")}
                    </p>
                  </button>
                )}
                {message.forwardedFrom && (
                  <p className="mb-1 text-xs opacity-80">
                    {t("forwardedFrom", {
                      name: message.forwardedFrom.senderName,
                    })}
                  </p>
                )}
                {message.isPinned && (
                  <p className="mb-1 text-xs opacity-80">{t("pinnedMessages")}</p>
                )}
                {Boolean(message.deletedAt || message.content) && (
                  <MessageContent
                    content={
                      message.deletedAt ? t("messageDeleted") : message.content
                    }
                  />
                )}
                {!message.deletedAt && (
                  <ChatAttachments
                    conversationId={message.conversationId}
                    attachments={message.attachments ?? []}
                    conversationImages={conversationImages}
                  />
                )}
                {message.editedAt && !message.deletedAt && (
                  <span className="mt-1 block text-xs opacity-90">
                    {t("edited")}
                  </span>
                )}
              </>
            )}
            {!message.deletedAt && !editing && (
              <button
                ref={trigger}
                type="button"
                aria-label={t("messageActions")}
                aria-expanded={menu}
                onClick={() => {
                  setMenu(!menu);
                  setConfirmDelete(false);
                  setPickingReaction(false);
                }}
                className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-500 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 dark:text-gray-300 dark:hover:bg-gray-800 ${effectiveMine ? "end-full me-1" : "start-full ms-1"} ${menu ? "!opacity-100" : ""}`}
              >
                <MoreDotIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {popupOpen &&
          createPortal(
            <div
              ref={popover}
              style={{ visibility: "hidden" }}
              className="fixed z-60 max-h-[calc(100dvh-1rem)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white text-gray-800 shadow-theme-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {menu && (
                <div
                  role="group"
                  aria-label={t("messageActions")}
                  className="p-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setPickingReaction(true);
                    }}
                    className="block min-h-10 w-full rounded-lg px-3 text-start text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {t("react")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onReply();
                    }}
                    className="block min-h-10 w-full rounded-lg px-3 text-start text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {t("replyMessage")}
                  </button>
                  {(
                    [
                      [allowForward, "forwardMessage"],
                      [onPin, message.isPinned ? "unpinMessage" : "pinMessage"],
                      [allowReceipts, "messageReceipts"],
                      [onReport, "reportMessage"],
                    ] as const
                  ).map(([action, label]) =>
                    action ? (
                      <button
                        type="button"
                        key={label}
                        className="block min-h-10 w-full rounded-lg px-3 text-start text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          setMenu(false);
                          action();
                        }}
                      >
                        {t(label)}
                      </button>
                    ) : null,
                  )}
                  {effectiveMine && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenu(false);
                          setDraft(message.content);
                          setEditing(true);
                        }}
                        className="block min-h-10 w-full rounded-lg px-3 text-start text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        {t("editMessage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenu(false);
                          setConfirmDelete(true);
                        }}
                        className="block min-h-10 w-full rounded-lg px-3 text-start text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-gray-800"
                      >
                        {t("deleteMessage")}
                      </button>
                    </>
                  )}
                </div>
              )}
              {pickingReaction && (
                <div className="flex p-1">
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={t("reactWith", { emoji })}
                      onClick={() => {
                        setPickingReaction(false);
                        void onReaction(emoji, true);
                      }}
                      className="h-10 w-10 rounded-lg hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {confirmDelete && (
                <div
                  role="group"
                  aria-label={t("confirmDeleteMessage")}
                  className="space-y-2 p-3 text-sm text-gray-800 dark:text-gray-100"
                >
                  <p>{t("confirmDeleteMessage")}</p>
                  <div className="flex gap-3">
                    <button
                      disabled={pending}
                      type="button"
                      onClick={() => void mutate(onDelete)}
                      className="min-h-9 font-semibold text-error-600 dark:text-error-400"
                    >
                      {t("confirmDelete")}
                    </button>
                    <button
                      disabled={pending}
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-9 text-gray-700 dark:text-gray-200"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )}
        {!message.deletedAt && message.reactions?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                aria-label={t("reactionSummary", {
                  emoji: reaction.emoji,
                  count: reaction.count,
                })}
                aria-pressed={reaction.reactedByMe}
                onClick={() =>
                  void onReaction(reaction.emoji, !reaction.reactedByMe)
                }
                className={`min-h-8 rounded-full border px-2 text-xs focus-visible:outline-2 focus-visible:outline-brand-500 ${reaction.reactedByMe ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}
        {!isAssistant && groupEnd && (
          <time
            dateTime={message.createdAt}
            className="mt-1 px-1 text-xs text-gray-600 tabular-nums dark:text-gray-400"
          >
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
        {!isAssistant && receipt && (
          <span className="mt-0.5 px-1 text-xs text-gray-600 dark:text-gray-400">
            {receipt}
          </span>
        )}
        {!isAssistant && !message.deletedAt && message.assistantState && (
          <AssistantTriggerStatusCard
            message={message}
            assistantState={message.assistantState}
            mine={effectiveMine}
            compact={compact}
            onRetry={onRetryAssistant}
          />
        )}
      </div>
    </div>
  );
}
