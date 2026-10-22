import type { ChatMessage } from "@/lib/queries/chat/useChat";

export function preserveLocalReactions(
  incoming: ChatMessage,
  previous: ChatMessage | undefined,
): ChatMessage {
  return {
    ...incoming,
    reactions: incoming.deletedAt
      ? []
      : incoming.reactions.map((reaction) => ({
          ...reaction,
          reactedByMe:
            previous?.reactions.find((item) => item.emoji === reaction.emoji)
              ?.reactedByMe ?? false,
        })),
  };
}
