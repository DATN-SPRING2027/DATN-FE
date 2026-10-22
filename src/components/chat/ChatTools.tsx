"use client";

import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  chatApi,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
  useChatCandidatesQuery,
} from "@/lib/queries/chat/useChat";
import { chatFeatures } from "@/lib/queries/chat/features";
import { apiClient } from "@/lib/api-client";
import ChatDialog from "./ChatDialog";
import ChatAttachments from "./ChatAttachments";
import MessageContent from "./MessageContent";
import HighlightedText from "./HighlightedText";

export type ChatToolMode =
  | "tools"
  | "search"
  | "library"
  | "forward"
  | "receipts"
  | "report"
  | "archived";
const control =
  "w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700";
const button =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800";
export const conversationLabel = (
  conversation: ChatConversation,
  actorId: string,
) =>
  conversation.type === "ROOM"
    ? (conversation.title ?? "")
    : (conversation.members.find((member) => member.userId !== actorId)
        ?.displayName ?? "");

export default function ChatTools({
  mode,
  organizationId,
  actorId,
  conversation,
  message,
  onClose,
  onModeChange,
  onOpenMessage,
  onOpenConversation,
}: {
  mode: ChatToolMode;
  organizationId: string;
  actorId: string;
  conversation?: ChatConversation;
  message?: ChatMessage;
  onClose: () => void;
  onModeChange?: (mode: ChatToolMode) => void;
  onOpenMessage: (message: ChatMessage) => void;
  onOpenConversation: (conversation: ChatConversation) => void;
}) {
  const t = useTranslations("chat");
  const client = useQueryClient();
  const cid = conversation?.id ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [senderSearch, setSenderSearch] = useState("");
  const [senderId, setSenderId] = useState("");
  const [senderTerm, setSenderTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSenderTerm(senderSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [senderSearch]);
  const senderCandidates = useChatCandidatesQuery(
    organizationId,
    senderId ? "" : senderTerm,
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("");
  const [onlyCurrent, setOnlyCurrent] = useState(Boolean(cid));
  const [libraryKind, setLibraryKind] = useState("IMAGE");
  const [reason, setReason] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const forwardId = useRef(crypto.randomUUID());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const key = ["chat", organizationId, "tools"];
  const prefs = useQuery({
    queryKey: [...key, "preferences", cid],
    queryFn: () => chatFeatures.preferences(cid),
    enabled: mode === "tools" && Boolean(cid),
    retry: false,
  });
  const receipts = useQuery({
    queryKey: [...key, "receipts", cid, message?.id],
    queryFn: () => chatFeatures.receipts(cid, message!.id),
    enabled: mode === "receipts" && Boolean(cid && message),
    retry: false,
  });
  const results = useInfiniteQuery({
    queryKey: [
      ...key,
      mode,
      cid,
      debounced,
      senderId,
      from,
      to,
      kind,
      onlyCurrent,
      libraryKind,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      mode === "library"
        ? chatFeatures.library(cid, libraryKind, pageParam, signal)
        : chatFeatures.search(
            {
              q: debounced,
              conversationId: onlyCurrent ? cid : undefined,
              senderId: senderId || undefined,
              from: from
                ? new Date(`${from}T00:00:00`).toISOString()
                : undefined,
              to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
              kind: kind || undefined,
              cursor: pageParam,
            },
            signal,
          ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled:
      mode === "library"
        ? Boolean(cid)
        : mode === "search" && debounced.length >= 2,
    retry: false,
  });
  const conversations = useInfiniteQuery({
    queryKey: [
      ...key,
      mode === "archived" ? "archived" : "forward-targets",
      debounced,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      mode === "archived"
        ? apiClient<ChatPage<ChatConversation>>(
            `/chat/conversations?archived=true&limit=40${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
            { signal, cache: "no-store" },
          )
        : chatApi.conversations(pageParam, signal, debounced),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: mode === "forward" || mode === "archived",
    retry: false,
  });
  const mutate = async (action: () => Promise<unknown>, close = false) => {
    if (pending) return;
    setPending(true);
    setError(false);
    setSaved(false);
    try {
      await action();
      await client.invalidateQueries({ queryKey: ["chat", organizationId] });
      setSaved(true);
      if (close) onClose();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  const title = {
    tools: "conversationTools",
    search: "advancedSearch",
    library: "sharedLibrary",
    forward: "forwardMessage",
    receipts: "messageReceipts",
    report: "reportMessage",
    archived: "archivedConversations",
  }[mode];
  const rows = results.data?.pages.flatMap((page) => page.data) ?? [];
  const peer = conversation?.members.find(
    (member) => member.userId !== actorId,
  );
  const owner =
    conversation?.type === "ROOM" &&
    conversation.members.some(
      (member) => member.userId === actorId && member.role === "OWNER",
    );
  return (
    <ChatDialog
      side={mode !== "forward" && mode !== "report"}
      title={t(title)}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="space-y-4 text-sm text-gray-800 dark:text-gray-200">
        {mode === "tools" && (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["library", "sharedLibrary"],
                  ["search", "advancedSearch"],
                  ["report", "reportMessage"],
                ] as const
              ).map(([next, label]) => (
                <button
                  key={next}
                  className={button}
                  onClick={() => onModeChange?.(next)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            {prefs.isLoading && <p role="status">{t("loadingOperation")}</p>}
            {prefs.isError && <p role="alert">{t("messageActionError")}</p>}
            {prefs.data && (
              <fieldset disabled={pending} className="space-y-3">
                {(["isPinned", "isArchived", "markedUnread"] as const).map(
                  (field) => (
                    <label key={field} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={prefs.data[field]}
                        onChange={(event) =>
                          void mutate(() =>
                            chatFeatures.setPreferences(cid, {
                              [field]: event.target.checked,
                            }),
                          )
                        }
                      />
                      {t(field)}
                    </label>
                  ),
                )}
                <label className="block space-y-1">
                  <span>{t("notificationMode")}</span>
                  <select
                    className={control}
                    value={prefs.data.notificationMode}
                    onChange={(event) =>
                      void mutate(() =>
                        chatFeatures.setPreferences(cid, {
                          notificationMode: event.target.value as
                            "ALL" | "MENTIONS" | "NONE",
                        }),
                      )
                    }
                  >
                    <option value="ALL">{t("allMessages")}</option>
                    <option value="MENTIONS">{t("mentionsOnly")}</option>
                    <option value="NONE">{t("muteNotifications")}</option>
                  </select>
                </label>
              </fieldset>
            )}
            {owner && (
              <section className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="font-semibold">{t("roomAdministration")}</h3>
                {conversation.members
                  .filter((member) => member.userId !== actorId)
                  .map((member) => (
                    <label
                      key={member.userId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{member.displayName}</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={pending}
                          checked={member.role === "MANAGER"}
                          onChange={(event) =>
                            void mutate(() =>
                              chatFeatures.manager(
                                cid,
                                member.userId,
                                event.target.checked,
                              ),
                            )
                          }
                        />
                        {t("manager")}
                      </span>
                    </label>
                  ))}
                <label className="block space-y-1">
                  <span>{t("transferOwnership")}</span>
                  <select
                    className={control}
                    value={newOwner}
                    onChange={(event) => setNewOwner(event.target.value)}
                  >
                    <option value="">{t("chooseMember")}</option>
                    {conversation.members
                      .filter((member) => member.userId !== actorId)
                      .map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                {newOwner && (
                  <div className="space-y-2 rounded-lg border border-warning-300 p-3">
                    <p>{t("transferOwnershipWarning")}</p>
                    <button
                      className={button}
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          () => chatFeatures.ownership(cid, newOwner),
                          true,
                        )
                      }
                    >
                      {t("confirmTransfer")}
                    </button>
                  </div>
                )}
              </section>
            )}
            {conversation?.type === "DIRECT" && peer && (
              <section className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  className={button}
                  disabled={pending}
                  onClick={() =>
                    void mutate(() => chatFeatures.block(peer.userId, true))
                  }
                >
                  {t("blockContact")}
                </button>
                <button
                  className={button}
                  disabled={pending}
                  onClick={() =>
                    void mutate(() => chatFeatures.block(peer.userId, false))
                  }
                >
                  {t("unblockContact")}
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t("blockScope")}
                </p>
              </section>
            )}
          </>
        )}
        {mode === "search" && (
          <>
            <label className="block space-y-1">
              <span>{t("messageSearchLabel")}</span>
              <input
                className={control}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {cid && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyCurrent}
                  onChange={(event) => setOnlyCurrent(event.target.checked)}
                />
                {t("onlyThisConversation")}
              </label>
            )}
            <div className="block space-y-1">
              <span>{t("sender")}</span>
              {onlyCurrent && conversation ? (
                <select
                  aria-label={t("sender")}
                  className={control}
                  value={senderId}
                  onChange={(event) => setSenderId(event.target.value)}
                >
                  <option value="">{t("anySender")}</option>
                  {conversation.members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    aria-label={t("sender")}
                    className={control}
                    placeholder={t("searchPeople")}
                    value={senderSearch}
                    onChange={(event) => {
                      setSenderSearch(event.target.value);
                      setSenderId("");
                    }}
                  />
                  {senderId && (
                    <button
                      className={button}
                      onClick={() => {
                        setSenderId("");
                        setSenderSearch("");
                      }}
                    >
                      {t("clearSearch")}
                    </button>
                  )}
                  {!senderId &&
                    senderCandidates.data?.data.map((person) => (
                      <button
                        key={person.id}
                        className={button}
                        onClick={() => {
                          setSenderId(person.id);
                          setSenderSearch(person.fullName);
                        }}
                      >
                        {person.fullName}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                {t("fromDate")}
                <input
                  className={control}
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                {t("toDate")}
                <input
                  className={control}
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span>{t("contentType")}</span>
              <select
                className={control}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="">{t("allTypes")}</option>
                <option value="IMAGE">{t("images")}</option>
                <option value="DOCUMENT">{t("documents")}</option>
                <option value="LINK">{t("links")}</option>
              </select>
            </label>
            {debounced.length < 2 && <p>{t("searchMessagesHint")}</p>}
          </>
        )}
        {mode === "library" && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t("contentType")}
          >
            {(["IMAGE", "DOCUMENT", "LINK", "PIN"] as const).map((item) => (
              <button
                key={item}
                className={button}
                aria-pressed={libraryKind === item}
                onClick={() => setLibraryKind(item)}
              >
                {t(
                  {
                    IMAGE: "images",
                    DOCUMENT: "documents",
                    LINK: "links",
                    PIN: "pinnedMessages",
                  }[item],
                )}
              </button>
            ))}
          </div>
        )}
        {(mode === "search" || mode === "library") && (
          <>
            {results.isFetching && <p role="status">{t("loadingOperation")}</p>}
            {results.isError && <p role="alert">{t("searchMessagesError")}</p>}
            {results.isSuccess && !rows.length && (
              <p>{t("noMessageMatches")}</p>
            )}
            {rows.map((result) => (
              <article
                key={result.id}
                className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {result.senderName} ·{" "}
                  {new Date(result.createdAt).toLocaleString()}
                </p>
                {mode === "search" ? (
                  <HighlightedText text={result.content} query={debounced} />
                ) : (
                  <MessageContent content={result.content} />
                )}
                <ChatAttachments
                  conversationId={result.conversationId}
                  attachments={result.attachments}
                />
                <button
                  className={button}
                  onClick={() => onOpenMessage(result)}
                >
                  {t("viewMessageContext")}
                </button>
              </article>
            ))}
            {results.hasNextPage && (
              <button
                className={button}
                disabled={results.isFetchingNextPage}
                onClick={() => void results.fetchNextPage()}
              >
                {t("loadMoreConversations")}
              </button>
            )}
          </>
        )}
        {(mode === "forward" || mode === "archived") && (
          <>
            {mode === "forward" && (
              <label className="block space-y-1">
                <span>{t("searchConversations")}</span>
                <input
                  type="search"
                  className={control}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            )}
            {conversations.isLoading && <p role="status">{t("loadingOperation")}</p>}
            {conversations.isError && (
              <p role="alert">{t("messageActionError")}</p>
            )}
            {conversations.isSuccess &&
              !conversations.data.pages.some((page) => page.data.length) && (
                <p>{t("noConversationMatches")}</p>
              )}
            {conversations.data?.pages
              .flatMap((page) => page.data)
              .map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 break-words">
                    {conversationLabel(target, actorId)}
                  </span>
                  {mode === "forward" ? (
                    <button
                      className={button}
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          () =>
                            chatFeatures.forward(
                              target.id,
                              message!.conversationId,
                              message!.id,
                              forwardId.current,
                            ),
                          true,
                        )
                      }
                    >
                      {t("forwardMessage")}
                    </button>
                  ) : (
                    <span className="flex gap-1">
                      <button
                        className={button}
                        onClick={() => onOpenConversation(target)}
                      >
                        {t("openConversation")}
                      </button>
                      <button
                        className={button}
                        disabled={pending}
                        onClick={() =>
                          void mutate(() =>
                            chatFeatures.setPreferences(target.id, {
                              isArchived: false,
                            }),
                          )
                        }
                      >
                        {t("restoreConversation")}
                      </button>
                    </span>
                  )}
                </div>
              ))}
            {conversations.hasNextPage && (
              <button
                className={button}
                disabled={conversations.isFetchingNextPage}
                onClick={() => void conversations.fetchNextPage()}
              >
                {t("loadMoreConversations")}
              </button>
            )}
          </>
        )}
        {mode === "receipts" && (
          <>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t("receiptTimeHint")}
            </p>
            {receipts.isLoading && <p role="status">{t("loadingOperation")}</p>}
            {receipts.isError && <p role="alert">{t("messageActionError")}</p>}
            {receipts.data?.data.map((member) => (
              <div
                key={member.userId}
                className="space-y-1 border-b border-gray-200 pb-3 dark:border-gray-700"
              >
                <p className="font-medium">{member.displayName}</p>
                <p>
                  {t("delivered")}:{" "}
                  {member.deliveredAt
                    ? new Date(member.deliveredAt).toLocaleString()
                    : member.delivered
                      ? t("timeUnavailable")
                      : "—"}
                </p>
                <p>
                  {t("seen")}:{" "}
                  {member.readAt
                    ? new Date(member.readAt).toLocaleString()
                    : member.read
                      ? t("timeUnavailable")
                      : "—"}
                </p>
              </div>
            ))}
          </>
        )}
        {mode === "report" && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                () => chatFeatures.report(cid, reason, message?.id),
                true,
              );
            }}
          >
            <label className="block space-y-1">
              <span>{t("reportReason")}</span>
              <textarea
                className={control}
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button className={button} disabled={pending || !reason.trim()}>
              {t("submitReport")}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-error-600">
            {t("messageActionError")}
          </p>
        )}
        {saved && (
          <p role="status" className="text-success-600">
            {t("changesSaved")}
          </p>
        )}
      </div>
    </ChatDialog>
  );
}
