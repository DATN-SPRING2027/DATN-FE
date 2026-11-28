import { expect, it } from "vitest";
import type { ChatMessage } from "@/lib/queries/chat/useChat";
import { sameMessageGroup } from "./message-layout";

it("groups only consecutive messages from one sender within two minutes", () => {
  const first = {
    senderId: "a",
    createdAt: "2026-10-21T10:00:00Z",
    deletedAt: null,
  } as ChatMessage;
  const next = { ...first, createdAt: "2026-10-21T10:01:59Z" };
  expect(sameMessageGroup(first, next)).toBe(true);
  expect(sameMessageGroup(first, { ...next, senderId: "b" })).toBe(false);
  expect(
    sameMessageGroup(first, { ...next, createdAt: "2026-10-21T10:02:01Z" }),
  ).toBe(false);
  expect(sameMessageGroup(first, { ...next, deletedAt: next.createdAt })).toBe(
    false,
  );
  expect(sameMessageGroup(undefined, first)).toBe(false);
});

it("never groups Continuum AI assistant messages with human or sibling assistant messages", () => {
  const human = {
    senderId: "a",
    authorType: "USER",
    createdAt: "2026-10-21T10:00:00Z",
    deletedAt: null,
  } as ChatMessage;
  const assistant = {
    senderId: "assistant:continuum_ai",
    authorType: "ASSISTANT",
    createdAt: "2026-10-21T10:00:05Z",
    deletedAt: null,
  } as ChatMessage;
  expect(sameMessageGroup(human, assistant)).toBe(false);
  expect(sameMessageGroup(assistant, human)).toBe(false);
  expect(sameMessageGroup(assistant, { ...assistant, createdAt: "2026-10-21T10:00:10Z" })).toBe(
    false,
  );
});
