import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { chatFeatures } from "@/lib/queries/chat/features";
import ChatDraftComposer from "./ChatDraftComposer";

vi.mock("@/icons", () => ({
  CloseLineIcon: () => null,
  PaperPlaneIcon: () => null,
  PlusIcon: () => null,
  ShootingStarIcon: () => null,
}));
afterEach(() => vi.restoreAllMocks());
it("restores explicit mention identities with a saved draft", async () => {
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "Hi @Member",
    mentionUserIds: ["member-id"],
    updatedAt: null,
  });
  const onSend = vi.fn().mockResolvedValue(false);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatDraftComposer
          conversationId="room-b"
          organizationId="org"
          isSending={false}
          onSend={onSend}
          onTyping={vi.fn()}
          members={[{ userId: "member-id", displayName: "Member" }]}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  await screen.findByDisplayValue("Hi @Member");
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "Hi @Member",
      expect.any(String),
      [],
      ["member-id"],
    ),
  );
  client.clear();
});
it("loads the conversation draft and orders clearing after an in-flight autosave", async () => {
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "Saved draft",
    updatedAt: null,
  });
  let finish: (() => void) | undefined;
  const save = vi
    .spyOn(chatFeatures, "saveDraft")
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const onSend = vi.fn().mockResolvedValue(true);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatDraftComposer
          conversationId="room-a"
          organizationId="org"
          isSending={false}
          onSend={onSend}
          onTyping={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  const input = await screen.findByRole("textbox");
  expect(input).toHaveValue("Saved draft");
  fireEvent.change(input, { target: { value: "New draft" } });
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("room-a", "New draft", []),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(onSend).toHaveBeenCalled());
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish?.();
  });
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("room-a", "", []));
  client.clear();
});

it("restores and clears structured assistantMention state across draft persistence in DIRECT chats", async () => {
  vi.spyOn(chatFeatures, "draft").mockResolvedValue({
    content: "@continuumAI Deadline PAY-123 là khi nào?",
    mentionUserIds: [],
    assistantMention: true,
    updatedAt: null,
  });
  const save = vi.spyOn(chatFeatures, "saveDraft").mockResolvedValue(undefined);
  const onSend = vi.fn().mockResolvedValue(true);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatDraftComposer
          conversationId="dm-1"
          organizationId="org"
          dmAssistantEnabled
          isSending={false}
          onSend={onSend}
          onTyping={vi.fn()}
          members={[{ userId: "member-id", displayName: "Lan Tran" }]}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  await screen.findByDisplayValue("@continuumAI Deadline PAY-123 là khi nào?");
  expect(screen.getByTestId("chat-composer-ai-active-pill")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "@continuumAI Deadline PAY-123 là khi nào?",
      expect.any(String),
      [],
      [],
      {
        handle: "continuumAI",
        query: "Deadline PAY-123 là khi nào?",
        timezone: expect.any(String),
      },
    ),
  );
  await waitFor(() =>
    expect(save).toHaveBeenLastCalledWith("dm-1", "", [], false),
  );
  client.clear();
});
