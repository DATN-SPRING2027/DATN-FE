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
import { ApiError } from "@/lib/api-client";
import {
  chatApi,
  chatKeys,
  CONTINUUM_AI_SENDER_ID,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import { chatFeatures } from "@/lib/queries/chat/features";
import { clearAssistantStateTombstones } from "./assistant-utils";
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
  clearAssistantStateTombstones();
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

it("enforces monotonic assistantState against late WS PENDING and terminal WS events arriving before POST resolves in Full Chat", async () => {
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
  const dmConv: ChatConversation = {
    id: "dm-mono",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: "2026-11-28T08:00:00.000Z",
    lastMessagePreview: "Ready",
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

  const triggerCompleted: ChatMessage = {
    id: "trigger-mono-1",
    conversationId: "dm-mono",
    senderId: "actor",
    senderName: "Actor",
    senderAvatarUrl: null,
    content: "@continuumAI Status check",
    createdAt: "2026-11-28T08:01:00.000Z",
    assistantState: {
      jobId: "job-mono-1",
      status: "PROCESSING",
      failureCode: null,
      responseMessageId: null,
      updatedAt: "2026-11-28T08:01:01.000Z",
    },
    editedAt: null,
    deletedAt: null,
    replyToMessageId: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  };
  const aiReply: ChatMessage = {
    id: "ai-mono-1",
    conversationId: "dm-mono",
    senderId: CONTINUUM_AI_SENDER_ID,
    senderName: "Continuum AI",
    senderAvatarUrl: null,
    authorType: "ASSISTANT",
    triggerMessageId: "trigger-mono-1",
    assistantStatus: "COMPLETED",
    assistantFailureCode: null,
    assistantMeta: {
      handle: "continuumAI",
      queryMode: "KEYWORD",
      partialCoverage: false,
      coverageNote: null,
      sourceState: "FRESH",
    },
    sourceReferences: [],
    content: "All tasks are on track.",
    createdAt: "2026-11-28T08:01:05.000Z",
    editedAt: null,
    deletedAt: null,
    replyToMessageId: "trigger-mono-1",
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
  vi.spyOn(chatApi, "messages").mockResolvedValue({
    data: [triggerCompleted, aiReply],
    nextCursor: null,
  });
  vi.spyOn(chatApi, "wsTicket").mockResolvedValue({
    ticket: "test",
    expiresInSeconds: 30,
  });
  vi.spyOn(chatApi, "markDelivered").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "markRead").mockResolvedValue(undefined);

  let resolvePost!: (msg: ChatMessage) => void;
  vi.spyOn(chatApi, "sendMessage").mockImplementation(
    () =>
      new Promise<ChatMessage>((resolve) => {
        resolvePost = resolve;
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

  expect(
    await screen.findByTestId("assistant-trigger-status-processing"),
  ).toBeInTheDocument();
  await waitFor(() => expect(TestSocket.instances).toHaveLength(1));
  const socket = TestSocket.instances[0]!;
  act(() => socket.connected());

  // (a) WS COMPLETED -> late out-of-order WS PENDING must NOT regress to PENDING
  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "assistant.status",
        data: {
          conversationId: "dm-mono",
          triggerMessageId: "trigger-mono-1",
          jobId: "job-mono-1",
          status: "COMPLETED",
          failureCode: null,
          responseMessageId: "ai-mono-1",
          updatedAt: "2026-11-28T08:01:05.000Z",
        },
      }),
    });
  });
  await waitFor(() =>
    expect(
      screen.queryByTestId("assistant-trigger-status-processing"),
    ).not.toBeInTheDocument(),
  );

  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "assistant.status",
        data: {
          conversationId: "dm-mono",
          triggerMessageId: "trigger-mono-1",
          jobId: "job-mono-1",
          status: "PENDING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T08:01:00.000Z",
        },
      }),
    });
  });
  expect(
    screen.queryByTestId("assistant-trigger-status-pending"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId("assistant-trigger-status-processing"),
  ).not.toBeInTheDocument();

  // (b) WS CANCELLED arrives BEFORE POST /messages resolves with PENDING -> stays CANCELLED
  fireEvent.click(await screen.findByTestId("chat-composer-ai-trigger"));
  const composerInput = screen.getByPlaceholderText("Write a message…");
  fireEvent.change(composerInput, {
    target: { value: "@continuumAI Race condition check" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(resolvePost).toBeDefined());

  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "assistant.status",
        data: {
          conversationId: "dm-mono",
          triggerMessageId: "trigger-race-full",
          jobId: "job-race-full",
          status: "CANCELLED",
          failureCode: "SOURCE_CHANGED",
          responseMessageId: null,
          updatedAt: "2026-11-28T08:02:04.000Z",
        },
      }),
    });
  });

  await act(async () => {
    resolvePost({
      id: "trigger-race-full",
      conversationId: "dm-mono",
      senderId: "actor",
      senderName: "Actor",
      senderAvatarUrl: null,
      content: "@continuumAI Race condition check",
      createdAt: "2026-11-28T08:02:00.000Z",
      assistantMention: {
        handle: "continuumAI",
        query: "Race condition check",
        timezone: "Asia/Ho_Chi_Minh",
      },
      assistantState: {
        jobId: "job-race-full",
        status: "PENDING",
        failureCode: null,
        responseMessageId: null,
        updatedAt: "2026-11-28T08:02:00.000Z",
      },
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      replyTo: null,
      attachments: [],
      reactions: [],
    });
  });

  expect(
    await screen.findByTestId("assistant-trigger-status-cancelled-source_changed"),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId("assistant-trigger-status-pending"),
  ).not.toBeInTheDocument();
  client.clear();
});

it("reuses retry clientMessageId across transport errors and preserves original trigger reply context in Full Chat", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  });
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const receipt = {
    avatarUrl: null,
    lastReadMessageId: null,
    lastReadAt: null,
    lastDeliveredMessageId: null,
    lastDeliveredAt: null,
  };
  const dmConv: ChatConversation = {
    id: "dm-retry",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: "2026-11-28T08:00:00.000Z",
    lastMessagePreview: "Timeout",
    lastMessageSenderId: "actor",
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    capabilities: { dmAssistantEnabled: true },
    members: [
      { userId: "actor", displayName: "Actor", role: "OWNER", ...receipt },
      { userId: "peer", displayName: "Lan Tran", role: "MEMBER", ...receipt },
    ],
  };

  const failedTrigger: ChatMessage = {
    id: "trigger-failed-full",
    conversationId: "dm-retry",
    senderId: "actor",
    senderName: "Actor",
    senderAvatarUrl: null,
    content: "@continuumAI Summarize sprint",
    createdAt: "2026-11-28T08:01:00.000Z",
    assistantMention: {
      handle: "continuumAI",
      query: "Summarize sprint",
      timezone: "Asia/Ho_Chi_Minh",
    },
    assistantState: {
      jobId: "job-failed-full",
      status: "FAILED",
      failureCode: "TIMEOUT",
      responseMessageId: null,
      updatedAt: "2026-11-28T08:01:10.000Z",
    },
    editedAt: null,
    deletedAt: null,
    replyToMessageId: "orig-context-msg",
    replyTo: {
      id: "orig-context-msg",
      senderName: "Lan Tran",
      preview: "Original thread message",
      deleted: false,
    },
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
  vi.spyOn(chatApi, "messages").mockResolvedValue({
    data: [failedTrigger],
    nextCursor: null,
  });
  vi.spyOn(chatApi, "wsTicket").mockResolvedValue({
    ticket: "test",
    expiresInSeconds: 30,
  });
  vi.spyOn(chatApi, "markDelivered").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "markRead").mockResolvedValue(undefined);

  const sentPayloads: Array<{
    clientMessageId: string;
    replyToMessageId?: string;
  }> = [];
  vi.spyOn(chatApi, "sendMessage")
    .mockImplementationOnce(async (_cid, input) => {
      sentPayloads.push({
        clientMessageId: input.clientMessageId,
        replyToMessageId: input.replyToMessageId,
      });
      throw new Error("Transient network timeout");
    })
    .mockImplementationOnce(async (_cid, input) => {
      sentPayloads.push({
        clientMessageId: input.clientMessageId,
        replyToMessageId: input.replyToMessageId,
      });
      return {
        ...failedTrigger,
        id: "trigger-retried-1",
        assistantState: {
          jobId: "job-retried-1",
          status: "PENDING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T08:02:00.000Z",
        },
      };
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

  const retryBtn = await screen.findByRole("button", {
    name: translations.chat.assistantRetryAction,
  });

  // First attempt fails with a transport error
  fireEvent.click(retryBtn);
  await waitFor(() => expect(sentPayloads).toHaveLength(1));

  // Second attempt reuses the EXACT SAME clientMessageId and preserves original replyToMessageId
  fireEvent.click(retryBtn);
  await waitFor(() => expect(sentPayloads).toHaveLength(2));
  expect(sentPayloads[1]!.clientMessageId).toBe(
    sentPayloads[0]!.clientMessageId,
  );
  expect(sentPayloads[0]!.replyToMessageId).toBe("orig-context-msg");
  expect(sentPayloads[1]!.replyToMessageId).toBe("orig-context-msg");

  consoleErrorSpy.mockRestore();
  client.clear();
});

it("prefers fresh detail dmAssistantEnabled over stale list item and invalidates capabilities on CHAT_AI_NOT_ENABLED", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  });
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const receipt = {
    avatarUrl: null,
    lastReadMessageId: null,
    lastReadAt: null,
    lastDeliveredMessageId: null,
    lastDeliveredAt: null,
  };
  const staleListConv: ChatConversation = {
    id: "dm-cap",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: "2026-11-28T08:00:00.000Z",
    lastMessagePreview: "Hi",
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

  let detailEnabled = false;
  const listSpy = vi.spyOn(chatApi, "conversations").mockResolvedValue({
    data: [staleListConv],
    nextCursor: null,
    capabilities: { dmAssistantEnabled: true },
  });
  const detailSpy = vi
    .spyOn(chatFeatures, "conversation")
    .mockImplementation(async () => ({
      ...staleListConv,
      capabilities: { dmAssistantEnabled: detailEnabled },
    }));
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "",
    mentionUserIds: [],
    assistantMention: false,
    updatedAt: null,
  });
  vi.spyOn(chatFeatures, "saveDraft").mockResolvedValue(undefined);
  vi.spyOn(chatApi, "candidates").mockResolvedValue({ data: [] });
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

  // Part 1: Fresh detail false overrides stale list true -> hides @continuumAI trigger
  await screen.findByPlaceholderText("Write a message…");
  await waitFor(() => expect(detailSpy).toHaveBeenCalled());
  expect(
    screen.queryByTestId("chat-composer-ai-trigger"),
  ).not.toBeInTheDocument();

  // Part 2: Enable via detail, then backend returns CHAT_AI_NOT_ENABLED on send -> invalidates & hides @continuumAI
  detailEnabled = true;
  await act(async () => {
    await client.invalidateQueries({
      queryKey: chatKeys.conversation("organization", "dm-cap"),
    });
  });
  expect(
    await screen.findByTestId("chat-composer-ai-trigger"),
  ).toBeInTheDocument();

  detailEnabled = false;
  listSpy.mockResolvedValue({
    data: [{ ...staleListConv, capabilities: { dmAssistantEnabled: false } }],
    nextCursor: null,
    capabilities: { dmAssistantEnabled: false },
  });
  vi.spyOn(chatApi, "sendMessage").mockRejectedValueOnce(
    new ApiError(403, "CHAT_AI_NOT_ENABLED", "AI assistant disabled"),
  );

  const listCallsBefore = listSpy.mock.calls.length;
  const detailCallsBefore = detailSpy.mock.calls.length;

  fireEvent.click(screen.getByTestId("chat-composer-ai-trigger"));
  const composerInput = screen.getByPlaceholderText("Write a message…");
  fireEvent.change(composerInput, {
    target: { value: "@continuumAI Check disabled flag" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  await waitFor(() => {
    expect(listSpy.mock.calls.length).toBeGreaterThan(listCallsBefore);
    expect(detailSpy.mock.calls.length).toBeGreaterThan(detailCallsBefore);
  });
  await waitFor(() =>
    expect(
      screen.queryByTestId("chat-composer-ai-trigger"),
    ).not.toBeInTheDocument(),
  );

  consoleErrorSpy.mockRestore();
  client.clear();
});

it("invalidates ChatTools search and pinned library queries on WS message.updated and local edit/delete in Full Chat", async () => {
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
  const dmConv: ChatConversation = {
    id: "dm-tools",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: "2026-11-28T08:00:00.000Z",
    lastMessagePreview: "Hello",
    lastMessageSenderId: "actor",
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    members: [
      { userId: "actor", displayName: "Actor", role: "OWNER", ...receipt },
      { userId: "peer", displayName: "Lan Tran", role: "MEMBER", ...receipt },
    ],
  };

  vi.spyOn(chatApi, "conversations").mockResolvedValue({
    data: [dmConv],
    nextCursor: null,
  });
  vi.spyOn(chatFeatures, "conversation").mockResolvedValue(dmConv);
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "",
    mentionUserIds: [],
    updatedAt: null,
  });
  vi.spyOn(chatApi, "candidates").mockResolvedValue({ data: [] });
  vi.spyOn(chatApi, "messages").mockResolvedValue({
    data: [
      {
        id: "src-1",
        conversationId: "dm-tools",
        senderId: "actor",
        senderName: "Actor",
        senderAvatarUrl: null,
        content: "Original source line",
        createdAt: "2026-11-28T08:00:00.000Z",
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

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const searchToolsKey = [
    ...chatKeys.toolsSearch("organization"),
    "dm-tools",
    "source",
    "",
    "",
    "",
    "",
    true,
    "IMAGE",
  ] as const;
  const pinnedToolsKey = [
    ...chatKeys.toolsLibrary("organization", "dm-tools"),
    "",
    "",
    "",
    "",
    "",
    true,
    "PIN",
  ] as const;
  client.setQueryData(searchToolsKey, { pages: [], pageParams: [] });
  client.setQueryData(pinnedToolsKey, { pages: [], pageParams: [] });

  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={translations}>
        <ChatWorkspace />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  await screen.findByText("Original source line");
  await waitFor(() => expect(TestSocket.instances).toHaveLength(1));
  const socket = TestSocket.instances[0]!;

  act(() => {
    socket.onmessage?.({
      data: JSON.stringify({
        event: "message.updated",
        data: {
          id: "src-1",
          conversationId: "dm-tools",
          senderId: "actor",
          senderName: "Actor",
          senderAvatarUrl: null,
          content: "Edited source line",
          createdAt: "2026-11-28T08:00:00.000Z",
          editedAt: "2026-11-28T08:01:00.000Z",
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
          attachments: [],
          reactions: [],
        },
      }),
    });
  });

  await waitFor(() => {
    expect(client.getQueryState(searchToolsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(pinnedToolsKey)?.isInvalidated).toBe(true);
  });
  client.clear();
});
