import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import translations from "@/messages/en.json";
import {
  chatApi,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import ChatWorkspace from "./ChatWorkspace";

vi.mock("@/icons", () => ({
  ChatIcon: () => null,
  GroupIcon: () => null,
  SearchIcon: () => null,
  InfoIcon: () => null,
  MoreDotIcon: () => null,
  PaperPlaneIcon: () => null,
  PlusIcon: () => null,
}));
const auth = vi.hoisted(() => ({
  data: { id: "actor", organizationId: "organization" },
  refetch: vi.fn(),
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => auth,
}));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    TestSocket.instances.push(this);
  }
  connected() {
    this.onmessage?.({ data: JSON.stringify({ event: "connected" }) });
  }
}

afterEach(() => {
  cleanup();
  TestSocket.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});

it("refreshes conversations and reconciles missed messages when the socket connects again", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  });
  const receipt = {
    avatarUrl: null,
    lastReadMessageId: null,
    lastReadAt: null,
    lastDeliveredMessageId: null,
    lastDeliveredAt: null,
  };
  const conversation: ChatConversation = {
    id: "conversation",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: null,
    lastMessagePreview: "",
    lastMessageSenderId: null,
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    members: [
      { userId: "actor", displayName: "Actor", role: "OWNER", ...receipt },
      { userId: "peer", displayName: "Peer", role: "MEMBER", ...receipt },
    ],
  };
  const message = (id: string, content: string): ChatMessage => ({
    id,
    content,
    conversationId: "conversation",
    senderId: "peer",
    senderName: "Peer",
    senderAvatarUrl: null,
    createdAt: `2026-10-21T10:00:${id.padStart(2, "0")}.000Z`,
    editedAt: null,
    deletedAt: null,
    replyToMessageId: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  });
  const conversations = vi
    .spyOn(chatApi, "conversations")
    .mockResolvedValue({ data: [conversation], nextCursor: null });
  const history = vi.spyOn(chatApi, "messages").mockResolvedValue({
    data: [message("1", "Before disconnect")],
    nextCursor: null,
  });
  vi.spyOn(chatApi, "wsTicket").mockResolvedValue({
    ticket: "test",
    expiresInSeconds: 30,
  });
  vi.spyOn(chatApi, "markDelivered").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "markRead").mockResolvedValue(undefined);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={translations}>
        <ChatWorkspace />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Before disconnect");
  await waitFor(() => expect(TestSocket.instances).toHaveLength(1));
  act(() => TestSocket.instances[0].connected());
  await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
  const listCallsBeforeReconnect = conversations.mock.calls.length;
  history.mockResolvedValue({
    data: [message("3", "Arrived while offline")],
    nextCursor: "missed-page",
  });
  vi.spyOn(chatApi, "olderMessages").mockResolvedValue({
    data: [
      message("1", "Edited while offline"),
      message("2", "Missed intermediate message"),
    ],
    nextCursor: null,
  });
  act(() => TestSocket.instances[0].connected());
  await screen.findByText("Arrived while offline");
  expect(screen.getByText("Edited while offline")).toBeInTheDocument();
  expect(screen.getByText("Missed intermediate message")).toBeInTheDocument();
  expect(screen.queryByText("Before disconnect")).not.toBeInTheDocument();
  expect(conversations.mock.calls.length).toBeGreaterThan(
    listCallsBeforeReconnect,
  );
  client.clear();
});
