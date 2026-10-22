import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { chatFeatures } from "@/lib/queries/chat/features";
import type { ChatMessage } from "@/lib/queries/chat/useChat";
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
