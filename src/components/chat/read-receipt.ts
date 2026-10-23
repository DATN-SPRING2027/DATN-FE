import type { ChatMessage, ChatParticipant } from "@/lib/queries/chat/useChat";

export function hasReadMessage(
  participant: ChatParticipant,
  message: ChatMessage,
): boolean {
  if (!participant.lastReadMessageId || !participant.lastReadAt) return false;
  const readAt = Date.parse(participant.lastReadAt);
  const messageAt = Date.parse(message.createdAt);
  return (
    readAt > messageAt ||
    (readAt === messageAt &&
      participant.lastReadMessageId.localeCompare(message.id) >= 0)
  );
}
