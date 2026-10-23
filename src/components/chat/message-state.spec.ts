import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/queries/chat/useChat";
import { preserveLocalReactions } from "./message-state";

const message: ChatMessage = {
  id: "message",
  conversationId: "conversation",
  senderId: "sender",
  senderName: "Sender",
  senderAvatarUrl: null,
  content: "hello",
  createdAt: "2026-01-01T10:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  replyTo: null,
  attachments: [],
  reactions: [{ emoji: "👍", count: 2, reactedByMe: true }],
};

describe("preserveLocalReactions", () => {
  it("updates aggregate counts without copying another user's reacted state", () => {
    const updated = preserveLocalReactions(
      {
        ...message,
        reactions: [{ emoji: "👍", count: 3, reactedByMe: false }],
      },
      message,
    );

    expect(updated.reactions).toEqual([
      { emoji: "👍", count: 3, reactedByMe: true },
    ]);
  });

  it("clears reactions from a deleted message", () => {
    expect(
      preserveLocalReactions(
        { ...message, deletedAt: "2026-01-01T10:01:00.000Z", reactions: [] },
        message,
      ).reactions,
    ).toEqual([]);
  });
});
