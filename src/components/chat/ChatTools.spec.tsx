import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { chatFeatures } from "@/lib/queries/chat/features";
import {
  CONTINUUM_AI_SENDER_ID,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import { invalidateConversationMessageQueries } from "./assistant-utils";
import ChatTools from "./ChatTools";

afterEach(() => vi.restoreAllMocks());
it("sends date/type filters to global search and opens the selected original message", async () => {
  const message = {
    id: "message",
    conversationId: "conversation",
    senderName: "Member",
    content: "xin chào",
    createdAt: "2026-10-21T00:00:00Z",
    attachments: [],
  } as unknown as ChatMessage;
  const search = vi
    .spyOn(chatFeatures, "search")
    .mockResolvedValue({ data: [message], nextCursor: null });
  const onOpenMessage = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatTools
          mode="search"
          organizationId="org"
          actorId="actor"
          onClose={vi.fn()}
          onOpenMessage={onOpenMessage}
          onOpenConversation={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "xin chao" },
  });
  fireEvent.change(screen.getByLabelText("From date"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Content type"), {
    target: { value: "IMAGE" },
  });
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "xin chao",
        kind: "IMAGE",
        from: new Date("2026-10-01T00:00:00").toISOString(),
      }),
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: messages.chat.viewMessageContext,
    }),
  );
  expect(onOpenMessage).toHaveBeenCalledWith(message);
  client.clear();
});

it("refetches open ChatTools search and pinned library panels when conversation message queries are invalidated after source edits/deletes", async () => {
  const conversation = {
    id: "dm-1",
    type: "DIRECT",
    title: null,
    createdBy: "actor",
    lastMessageAt: null,
    lastMessagePreview: "",
    lastMessageSenderId: null,
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    members: [],
  } as unknown as ChatConversation;

  let sourceState: "FRESH" | "HAS_EDITED" = "FRESH";
  const makeAiResult = () =>
    ({
      id: "ai-msg-1",
      conversationId: "dm-1",
      senderId: CONTINUUM_AI_SENDER_ID,
      senderName: "Continuum AI",
      authorType: "ASSISTANT",
      content: "PAY-123 deadline summary",
      createdAt: "2026-11-28T08:00:00.000Z",
      assistantMeta: {
        handle: "continuumAI",
        queryMode: "KEYWORD",
        partialCoverage: false,
        coverageNote: null,
        sourceState,
      },
      sourceReferences: [],
      attachments: [],
    }) as unknown as ChatMessage;

  const searchSpy = vi
    .spyOn(chatFeatures, "search")
    .mockImplementation(async () => ({
      data: [makeAiResult()],
      nextCursor: null,
    }));
  const librarySpy = vi
    .spyOn(chatFeatures, "library")
    .mockImplementation(async () => ({
      data: [makeAiResult()],
      nextCursor: null,
    }));

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const { rerender } = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatTools
          mode="search"
          organizationId="org"
          actorId="actor"
          conversation={conversation}
          onClose={vi.fn()}
          onOpenMessage={vi.fn()}
          onOpenConversation={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "PAY-123" },
  });
  expect(await screen.findByText(/deadline summary/i)).toBeInTheDocument();
  expect(
    screen.queryByText(messages.chat.assistantSourceEdited),
  ).not.toBeInTheDocument();

  sourceState = "HAS_EDITED";
  await act(async () => {
    await invalidateConversationMessageQueries(client, "org", "dm-1");
  });
  expect(
    await screen.findByText(messages.chat.assistantSourceEdited),
  ).toBeInTheDocument();
  expect(searchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

  // Switch to pinned library view and verify invalidation refreshes stale source badge too
  sourceState = "FRESH";
  rerender(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatTools
          mode="library"
          organizationId="org"
          actorId="actor"
          conversation={conversation}
          onClose={vi.fn()}
          onOpenMessage={vi.fn()}
          onOpenConversation={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.chat.pinnedMessages }),
  );
  await waitFor(() =>
    expect(librarySpy).toHaveBeenCalledWith(
      "dm-1",
      "PIN",
      undefined,
      expect.any(AbortSignal),
    ),
  );
  expect(
    screen.queryByText(messages.chat.assistantSourceEdited),
  ).not.toBeInTheDocument();

  sourceState = "HAS_EDITED";
  await act(async () => {
    await invalidateConversationMessageQueries(client, "org", "dm-1");
  });
  expect(
    await screen.findByText(messages.chat.assistantSourceEdited),
  ).toBeInTheDocument();
  client.clear();
});
