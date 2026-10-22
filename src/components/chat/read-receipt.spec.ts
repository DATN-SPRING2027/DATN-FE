import { describe, expect, it } from "vitest";
import { hasReadMessage } from "./read-receipt";
import type { ChatMessage, ChatParticipant } from "@/lib/queries/chat/useChat";

const participant: ChatParticipant = {
  userId: "reader",
  displayName: "Reader",
  avatarUrl: null,
  role: "MEMBER",
  lastReadMessageId: "000000000000000000000002",
  lastReadAt: "2026-01-01T10:00:00.000Z",
  lastDeliveredMessageId: null,
  lastDeliveredAt: null,
};

function message(id: string, createdAt: string): ChatMessage {
  return {
    id,
    conversationId: "conversation",
    senderId: "sender",
    senderName: "Sender",
    senderAvatarUrl: null,
    content: "hello",
    createdAt,
    editedAt: null,
    deletedAt: null,
    replyToMessageId: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  };
}

describe("hasReadMessage", () => {
  it("compares ObjectId order when messages share a timestamp", () => {
    expect(
      hasReadMessage(
        participant,
        message("000000000000000000000001", "2026-01-01T10:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      hasReadMessage(
        participant,
        message("000000000000000000000003", "2026-01-01T10:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("does not count a read cursor before the message or without an id", () => {
    expect(
      hasReadMessage(
        participant,
        message("000000000000000000000001", "2026-01-01T10:01:00.000Z"),
      ),
    ).toBe(false);
    expect(
      hasReadMessage(
        { ...participant, lastReadMessageId: null },
        message("000000000000000000000001", "2026-01-01T10:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
