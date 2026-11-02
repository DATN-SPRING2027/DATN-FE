import type {
  ChatConversation,
  ChatMessage,
  ChatPage,
  ChatParticipant,
} from "@/lib/queries/chat/useChat";

export type FloatingConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting";

export function getConversationPeer(
  conversation: ChatConversation,
  actorId: string,
): ChatParticipant | undefined {
  if (conversation.type !== "DIRECT") return undefined;
  return conversation.members.find((member) => member.userId !== actorId);
}

export function getConversationDisplayName(
  conversation: ChatConversation | undefined,
  actorId: string,
): string {
  if (!conversation) return "";
  if (conversation.type === "ROOM") return conversation.title ?? "";
  return getConversationPeer(conversation, actorId)?.displayName ?? "";
}

export function mergeChatMessage(
  page: ChatPage<ChatMessage> | undefined,
  message: ChatMessage,
): ChatPage<ChatMessage> {
  const existing = page?.data ?? [];
  const replaced = existing.some((item) => item.id === message.id)
    ? existing.map((item) => (item.id === message.id ? message : item))
    : [...existing, message];
  return {
    data: replaced.sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    ),
    nextCursor: page?.nextCursor ?? null,
  };
}

export function isChatMessagePacket(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "conversationId" in value &&
    typeof value.conversationId === "string" &&
    "senderId" in value &&
    typeof value.senderId === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "replyTo" in value &&
    (value.replyTo === null ||
      (typeof value.replyTo === "object" &&
        value.replyTo !== null &&
        "id" in value.replyTo &&
        typeof value.replyTo.id === "string" &&
        "senderName" in value.replyTo &&
        typeof value.replyTo.senderName === "string" &&
        "preview" in value.replyTo &&
        typeof value.replyTo.preview === "string" &&
        "deleted" in value.replyTo &&
        typeof value.replyTo.deleted === "boolean"))
  );
}

export function hasParticipantDelivered(
  participant: ChatParticipant,
  message: ChatMessage,
): boolean {
  if (!participant.lastDeliveredMessageId || !participant.lastDeliveredAt) {
    return false;
  }
  const deliveredAt = Date.parse(participant.lastDeliveredAt);
  const messageAt = Date.parse(message.createdAt);
  return (
    deliveredAt > messageAt ||
    (deliveredAt === messageAt &&
      participant.lastDeliveredMessageId.localeCompare(message.id) >= 0)
  );
}

export function formatCompactConversationTime(isoString: string | null): string {
  if (!isoString) return "";
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

