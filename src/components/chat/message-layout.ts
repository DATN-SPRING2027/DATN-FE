import type { ChatMessage } from "@/lib/queries/chat/useChat";

export function sameMessageGroup(
  previous: ChatMessage | undefined,
  next: ChatMessage | undefined,
): boolean {
  if (
    !previous ||
    !next ||
    previous.deletedAt ||
    next.deletedAt ||
    previous.senderId !== next.senderId
  )
    return false;
  const gap = Date.parse(next.createdAt) - Date.parse(previous.createdAt);
  return gap >= 0 && gap <= 120_000;
}
