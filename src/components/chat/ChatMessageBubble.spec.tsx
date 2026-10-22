import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/queries/chat/useChat";
import messages from "@/messages/en.json";
import ChatMessageBubble from "./ChatMessageBubble";

vi.mock("@/icons", () => ({ MoreDotIcon: () => null }));
const message: ChatMessage = {
  id: "one",
  conversationId: "conversation",
  senderId: "actor",
  senderName: "Actor",
  senderAvatarUrl: null,
  content: "Original",
  createdAt: "2026-10-21T10:00:00Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  replyTo: null,
  attachments: [],
  reactions: [],
};

it("keeps actions out of the flow and preserves edit/delete confirmations", async () => {
  const onEdit = vi.fn().mockResolvedValue(true),
    onDelete = vi.fn().mockResolvedValue(true);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={message}
        mine
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit" }), {
    target: { value: "  Updated  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onEdit).toHaveBeenCalledWith("Updated"));
  await waitFor(() =>
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
});

it("does not expose editing or deleting another sender's message", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={message}
        mine={false}
        showSender
        groupStart
        groupEnd={false}
        highlighted={false}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
  expect(document.querySelector("time")).toBeNull();
});

it("keeps the last message menu inside the viewport and closes it when history scrolls", () => {
  const height = vi
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockReturnValue(330);
  const width = vi
    .spyOn(HTMLElement.prototype, "offsetWidth", "get")
    .mockReturnValue(256);
  try {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatMessageBubble
          message={message}
          mine
          showSender={false}
          groupStart
          groupEnd
          highlighted={false}
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onReaction={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Message actions" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      left: 900,
      right: 936,
      top: 700,
      bottom: 736,
      width: 36,
      height: 36,
      x: 900,
      y: 700,
      toJSON() {},
    });
    fireEvent.click(trigger);
    const panel = screen.getByRole("group", {
      name: "Message actions",
    }).parentElement!;
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.top).toBe("362px");
    expect(parseFloat(panel.style.left) + 256).toBeLessThanOrEqual(
      window.innerWidth - 8,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "React" }));
    fireEvent.click(screen.getByRole("button", { name: "React" }));
    expect(screen.getByRole("button", { name: "React with 👍" })).toBeVisible();
    fireEvent.scroll(document);
    expect(
      screen.queryByRole("button", { name: "React with 👍" }),
    ).not.toBeInTheDocument();
  } finally {
    height.mockRestore();
    width.mockRestore();
  }
});
