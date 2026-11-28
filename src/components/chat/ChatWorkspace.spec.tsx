import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import translations from "@/messages/en.json";
import {
  chatApi,
  CONTINUUM_AI_SENDER_ID,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import { chatFeatures } from "@/lib/queries/chat/features";
import ChatWorkspace from "./ChatWorkspace";

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
  vi.spyOn(chatApi, "candidates").mockResolvedValue({ data: [] });
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

it("displays organization members with email and online status in the sidebar and compose dialog without requiring a search query", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(chatApi, "conversations").mockResolvedValue({
    data: [],
    nextCursor: null,
  });
  vi.spyOn(chatApi, "candidates").mockResolvedValue({
    data: [
      {
        id: "member-1",
        fullName: "Nguyễn Văn A",
        email: "nguyenvana@datn.edu.vn",
        avatarUrl: null,
        isOnline: true,
      },
    ],
  });
  const createDirect = vi
    .spyOn(chatApi, "createDirect")
    .mockResolvedValue({ id: "direct-1", type: "DIRECT" });
  vi.spyOn(chatApi, "messages").mockResolvedValue({
    data: [],
    nextCursor: null,
  });
  vi.spyOn(chatApi, "wsTicket").mockResolvedValue({
    ticket: "test",
    expiresInSeconds: 30,
  });
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

  await screen.findByText("Nguyễn Văn A");
  expect(screen.getByText("nguyenvana@datn.edu.vn")).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "New message" })[0]);
  expect(screen.getAllByText("Nguyễn Văn A").length).toBeGreaterThanOrEqual(2);
  expect(
    screen.getAllByText("nguyenvana@datn.edu.vn").length,
  ).toBeGreaterThanOrEqual(2);

  fireEvent.click(
    screen.getAllByRole("button", { name: "Start chat with Nguyễn Văn A" })[0],
  );
  await waitFor(() =>
    expect(createDirect).toHaveBeenCalledWith("member-1", expect.anything()),
  );
  client.clear();
});

it("handles @continuumAI sending, live WS assistant.status updates, off-page source jump, and source mutation invalidation in DIRECT chat", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  });
  Element.prototype.scrollIntoView = vi.fn();

  const receipt = {
    avatarUrl: null,
    lastReadMessageId: null,
    lastReadAt: null,
    lastDeliveredMessageId: null,
    lastDeliveredAt: null,
  };
  const dmConv: ChatConversation = {
    id: "dm-1",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: "2026-11-28T08:00:00.000Z",
    lastMessagePreview: "Chốt PAY-123",
    lastMessageSenderId: "peer",
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    capabilities: { dmAssistantEnabled: true },
    members: [
      { userId: "actor", displayName: "Actor", role: "OWNER", ...receipt },
      { userId: "peer", displayName: "Lan Tran", role: "MEMBER", ...receipt },
    ],
  };

  let currentMessages: ChatMessage[] = [
    {
      id: "trigger-1",
      conversationId: "dm-1",
      senderId: "actor",
      senderName: "Actor",
      senderAvatarUrl: null,
      content: "@continuumAI Deadline PAY-123 là khi nào?",
      createdAt: "2026-11-28T08:01:00.000Z",
      assistantMention: {
        handle: "continuumAI",
        query: "Deadline PAY-123 là khi nào?",
        timezone: "Asia/Ho_Chi_Minh",
      },
      assistantState: {
        jobId: "job-1",
        status: "PENDING",
        failureCode: null,
        responseMessageId: null,
        updatedAt: "2026-11-28T08:01:00.000Z",
      },
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      replyTo: null,
      attachments: [],
      reactions: [],
    },
  ];

  const aiReplyActive: ChatMessage = {
    id: "ai-reply-1",
    conversationId: "dm-1",
    senderId: CONTINUUM_AI_SENDER_ID,
    senderName: "Continuum AI",
    senderAvatarUrl: null,
    authorType: "ASSISTANT",
    triggerMessageId: "trigger-1",
    assistantStatus: "COMPLETED",
    assistantFailureCode: null,
    assistantMeta: {
      handle: "continuumAI",
      queryMode: "KEYWORD",
      partialCoverage: false,
      coverageNote: null,
      sourceState: "FRESH",
    },
    sourceReferences: [
      {
        refId: "M1",
        messageId: "offpage-source-1",
        senderName: "Lan Tran",
        createdAt: "2026-11-10T08:00:00.000Z",
        quoteSnippet: "PAY-123 chốt hạn 29/11.",
        status: "ACTIVE",
      },
    ],
    content: "Deadline của PAY-123 là 29/11 [M1].",
    createdAt: "2026-11-28T08:01:05.000Z",
    editedAt: null,
    deletedAt: null,
    replyToMessageId: "trigger-1",
    replyTo: null,
    attachments: [],
    reactions: [],
  };

  vi.spyOn(chatApi, "conversations").mockResolvedValue({
    data: [dmConv],
    nextCursor: null,
    capabilities: { dmAssistantEnabled: true },
  });
  vi.spyOn(chatFeatures, "conversation").mockResolvedValue(dmConv);
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "",
    mentionUserIds: [],
    assistantMention: false,
    updatedAt: null,
  });
  vi.spyOn(chatFeatures, "saveDraft").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "candidates").mockResolvedValue({ data: [] });
  const messagesSpy = vi
    .spyOn(chatApi, "messages")
    .mockImplementation(async () => ({
      data: currentMessages,
      nextCursor: null,
    }));
  const messageContextSpy = vi
    .spyOn(chatApi, "messageContext")
    .mockResolvedValue({
      data: [
        {
          id: "offpage-source-1",
          conversationId: "dm-1",
          senderId: "peer",
          senderName: "Lan Tran",
          senderAvatarUrl: null,
          content: "PAY-123 chốt hạn 29/11.",
          createdAt: "2026-11-10T08:00:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
          attachments: [],
          reactions: [],
        },
      ],
      nextCursor: null,
    });
  vi.spyOn(chatApi, "wsTicket").mockResolvedValue({
    ticket: "test",
    expiresInSeconds: 30,
  });
  vi.spyOn(chatApi, "markDelivered").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "markRead").mockResolvedValue(undefined);
  const sendSpy = vi.spyOn(chatApi, "sendMessage").mockImplementation(
    async (_cid, input) => ({
      id: "trigger-2",
      conversationId: "dm-1",
      senderId: "actor",
      senderName: "Actor",
      senderAvatarUrl: null,
      content: input.content,
      createdAt: "2026-11-28T08:02:00.000Z",
      assistantMention: input.assistantMention
        ? {
            handle: "continuumAI",
            query: input.assistantMention.query ?? "",
            timezone: input.assistantMention.timezone ?? "Asia/Ho_Chi_Minh",
          }
        : null,
      assistantState: input.assistantMention
        ? {
            jobId: "job-2",
            status: "PENDING",
            failureCode: null,
            responseMessageId: null,
            updatedAt: "2026-11-28T08:02:00.000Z",
          }
        : null,
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      replyTo: null,
      attachments: [],
      reactions: [],
    }),
  );

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

  // Trigger starts in PENDING state
  expect(
    await screen.findByTestId("assistant-trigger-status-pending"),
  ).toBeInTheDocument();
  await waitFor(() => expect(TestSocket.instances).toHaveLength(1));
  const socket = TestSocket.instances[0]!;
  const callsBeforeConnect = messagesSpy.mock.calls.length;
  act(() => socket.connected());
  await waitFor(() =>
    expect(messagesSpy.mock.calls.length).toBeGreaterThan(callsBeforeConnect),
  );

  // WS assistant.status transitions PENDING -> PROCESSING
  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "assistant.status",
        data: {
          conversationId: "dm-1",
          triggerMessageId: "trigger-1",
          jobId: "job-1",
          status: "PROCESSING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T08:01:02.000Z",
        },
      }),
    });
  });
  expect(
    await screen.findByTestId("assistant-trigger-status-processing"),
  ).toBeInTheDocument();

  // WS assistant.status COMPLETED without cached reply invalidates & loads the AI bubble
  currentMessages = [
    {
      ...currentMessages[0]!,
      assistantState: {
        jobId: "job-1",
        status: "COMPLETED",
        failureCode: null,
        responseMessageId: "ai-reply-1",
        updatedAt: "2026-11-28T08:01:05.000Z",
      },
    },
    aiReplyActive,
  ];
  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "assistant.status",
        data: {
          conversationId: "dm-1",
          triggerMessageId: "trigger-1",
          jobId: "job-1",
          status: "COMPLETED",
          failureCode: null,
          responseMessageId: "ai-reply-1",
          updatedAt: "2026-11-28T08:01:05.000Z",
        },
      }),
    });
  });
  expect(
    await screen.findByTestId("assistant-message-card"),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId("assistant-trigger-status-processing"),
  ).not.toBeInTheDocument();

  // Receiving message.updated invalidates messages and shows "Source edited" badge
  currentMessages = [
    currentMessages[0]!,
    {
      ...aiReplyActive,
      assistantMeta: {
        ...aiReplyActive.assistantMeta!,
        sourceState: "HAS_EDITED",
      },
      sourceReferences: [
        { ...aiReplyActive.sourceReferences![0]!, status: "EDITED" },
      ],
    },
  ];
  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "message.updated",
        data: {
          id: "offpage-source-1",
          conversationId: "dm-1",
          senderId: "peer",
          senderName: "Lan Tran",
          senderAvatarUrl: null,
          content: "PAY-123 chốt hạn mới 30/11.",
          createdAt: "2026-11-10T08:00:00.000Z",
          editedAt: "2026-11-28T08:01:10.000Z",
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
          attachments: [],
          reactions: [],
        },
      }),
    });
  });
  expect(
    await screen.findByTestId("assistant-source-edited-badge"),
  ).toBeInTheDocument();

  // Clicking the off-page source chip calls aroundMessageId context query!
  fireEvent.click(screen.getByTestId("assistant-source-chip-M1"));
  await waitFor(() =>
    expect(messageContextSpy).toHaveBeenCalledWith(
      "dm-1",
      "offpage-source-1",
      expect.anything(),
    ),
  );
  expect(
    await screen.findByText("Viewing message context"),
  ).toBeInTheDocument();

  // Back to latest & send a new @continuumAI mention via the quick trigger pill
  fireEvent.click(
    screen.getByRole("button", { name: "Back to latest messages" }),
  );
  fireEvent.click(await screen.findByTestId("chat-composer-ai-trigger"));
  const composerInput = screen.getByPlaceholderText("Write a message…");
  fireEvent.change(composerInput, {
    target: { value: "@continuumAI Hôm qua bàn gì?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(sendSpy).toHaveBeenCalledWith(
      "dm-1",
      expect.objectContaining({
        content: "@continuumAI Hôm qua bàn gì?",
        assistantMention: {
          handle: "continuumAI",
          query: "Hôm qua bàn gì?",
          timezone: expect.any(String),
        },
      }),
    ),
  );
  client.clear();
});
