import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/queries/chat/useChat";
import messages from "@/messages/en.json";
import ChatMessageBubble from "./ChatMessageBubble";

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

it("does not render empty message content when message only has attachments and no text", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={{
          ...message,
          content: "",
          attachments: [
            {
              id: "att-1",
              name: "photo.png",
              contentType: "image/png",
              size: 1024,
              kind: "IMAGE",
            },
          ],
        }}
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
  expect(screen.queryByText("Original")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText("Attachment unavailable")).toBeInTheDocument();
  });
});

it("renders a dedicated Continuum AI card with source chips, edited/deleted badges, disabled deleted source, and hides forward/edit/delete actions", () => {
  const onOpenContext = vi.fn();
  const assistantMessage: ChatMessage = {
    ...message,
    id: "ai-msg-1",
    senderId: "assistant:continuum_ai",
    senderName: "Continuum AI",
    authorType: "ASSISTANT",
    triggerMessageId: "trigger-1",
    assistantStatus: "COMPLETED",
    assistantFailureCode: null,
    assistantMeta: {
      handle: "continuumAI",
      queryMode: "KEYWORD",
      partialCoverage: true,
      coverageNote: "Searched latest 80 messages in this conversation.",
      sourceState: "HAS_EDITED_AND_DELETED",
    },
    content:
      "✅ Deadline for **PAY-123** moved to Friday 17:00 [M1] and confirmed in [M2] and [M3].",
    sourceReferences: [
      {
        refId: "M1",
        messageId: "src-active",
        senderName: "Lan Tran",
        createdAt: "2026-11-27T08:15:00.000Z",
        quoteSnippet: "Chốt dời deadline PAY-123 sang 17:00 thứ Sáu.",
        status: "ACTIVE",
      },
      {
        refId: "M2",
        messageId: "src-edited",
        senderName: "Phuc Nguyen",
        createdAt: "2026-11-27T08:16:00.000Z",
        quoteSnippet: "Ok chốt nhé.",
        status: "EDITED",
      },
      {
        refId: "M3",
        messageId: "src-deleted",
        senderName: "Lan Tran",
        createdAt: "2026-11-27T08:17:00.000Z",
        quoteSnippet: "",
        status: "DELETED",
      },
    ],
  };

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={assistantMessage}
        mine={false}
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onOpenContext={onOpenContext}
        onForward={vi.fn()}
        onPin={vi.fn()}
        onReceipts={vi.fn()}
        onReport={vi.fn()}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );

  expect(screen.getByTestId("assistant-message-card")).toBeInTheDocument();
  expect(screen.getByText("Continuum AI")).toBeInTheDocument();
  // Leading decorative emoji stripped while preserving historical answer text
  expect(screen.queryByText(/✅/)).not.toBeInTheDocument();
  expect(screen.getByText("PAY-123")).toBeInTheDocument();
  expect(
    screen.getByText("Searched latest 80 messages in this conversation."),
  ).toBeInTheDocument();
  expect(screen.getByTestId("assistant-source-edited-badge")).toHaveTextContent(
    "Source edited",
  );
  expect(
    screen.getByTestId("assistant-source-deleted-badge"),
  ).toHaveTextContent("Source deleted");

  // ACTIVE & EDITED source chips remain clickable and jump to original message
  fireEvent.click(screen.getByTestId("assistant-source-chip-M1"));
  expect(onOpenContext).toHaveBeenCalledWith("src-active");
  fireEvent.click(screen.getByTestId("assistant-source-chip-M2"));
  expect(onOpenContext).toHaveBeenCalledWith("src-edited");

  // DELETED source chip is disabled and clicking does NOT navigate
  const deletedChip = screen.getByTestId("assistant-source-chip-M3");
  expect(deletedChip).toBeDisabled();
  expect(deletedChip).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(deletedChip);
  expect(onOpenContext).toHaveBeenCalledTimes(2);

  // Action menu hides Forward, Receipts, Edit, Delete; keeps React, Reply, Pin, Report
  fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
  expect(
    screen.queryByRole("button", { name: "Forward message" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delivery and read details" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "React" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Pin message" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
});

it("renders INSUFFICIENT_EVIDENCE badge and neutral hint on abstained Continuum AI bubbles", () => {
  const abstained: ChatMessage = {
    ...message,
    id: "ai-msg-2",
    senderId: "assistant:continuum_ai",
    senderName: "Continuum AI",
    authorType: "ASSISTANT",
    triggerMessageId: "trigger-2",
    assistantStatus: "INSUFFICIENT_EVIDENCE",
    assistantMeta: {
      handle: "continuumAI",
      queryMode: "KEYWORD",
      partialCoverage: false,
      coverageNote: null,
      sourceState: "FRESH",
    },
    content: "No matching messages were found in this conversation.",
    sourceReferences: [],
  };

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={abstained}
        mine={false}
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

  expect(screen.getByTestId("assistant-insufficient-badge")).toHaveTextContent(
    "Insufficient evidence",
  );
  expect(
    screen.getByTestId("assistant-insufficient-callout"),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("assistant-source-list")).not.toBeInTheDocument();
});

it("renders distinct inline status cards for PENDING, CANCELLED (SOURCE_CHANGED vs ACCESS_REVOKED), and FAILED with retry", async () => {
  const onRetry = vi.fn().mockResolvedValue(true);
  const triggerBase: ChatMessage = {
    ...message,
    id: "trigger-msg",
    content: "@continuumAI Hôm qua chốt gì?",
    assistantMention: {
      handle: "continuumAI",
      query: "Hôm qua chốt gì?",
      timezone: "Asia/Ho_Chi_Minh",
    },
  };

  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={{
          ...triggerBase,
          assistantState: {
            jobId: "j1",
            status: "PENDING",
            failureCode: null,
            responseMessageId: null,
            updatedAt: "2026-11-28T09:00:00Z",
          },
        }}
        mine
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onRetryAssistant={onRetry}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByTestId("assistant-trigger-status-pending"),
  ).toBeInTheDocument();

  // CANCELLED / SOURCE_CHANGED shows separate warning + Ask again button
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={{
          ...triggerBase,
          assistantState: {
            jobId: "j1",
            status: "CANCELLED",
            failureCode: "SOURCE_CHANGED",
            responseMessageId: null,
            updatedAt: "2026-11-28T09:00:02Z",
          },
        }}
        mine
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onRetryAssistant={onRetry}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByText("Response cancelled — source changed"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
  await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));

  // CANCELLED / ACCESS_REVOKED shows distinct access-revoked copy and NO retry button
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={{
          ...triggerBase,
          assistantState: {
            jobId: "j1",
            status: "CANCELLED",
            failureCode: "ACCESS_REVOKED",
            responseMessageId: null,
            updatedAt: "2026-11-28T09:00:03Z",
          },
        }}
        mine
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onRetryAssistant={onRetry}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByText("Conversation access unavailable"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Ask again" }),
  ).not.toBeInTheDocument();

  // FAILED / TIMEOUT shows distinct timeout error alert + retry button
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={{
          ...triggerBase,
          assistantState: {
            jobId: "j1",
            status: "FAILED",
            failureCode: "TIMEOUT",
            responseMessageId: null,
            updatedAt: "2026-11-28T09:00:04Z",
          },
        }}
        mine
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onRetryAssistant={onRetry}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Continuum AI timed out")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
  await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(2));
});

it("collapses multi-source citations to 3 in Full Chat and 2 in compact Mini Chat while prioritizing mutated sources", () => {
  const sources = [
    {
      refId: "M1",
      messageId: "src-1",
      senderName: "Lan Tran",
      createdAt: "2026-11-27T08:01:00.000Z",
      quoteSnippet: "Decision one",
      status: "ACTIVE" as const,
    },
    {
      refId: "M2",
      messageId: "src-2",
      senderName: "Phuc Nguyen",
      createdAt: "2026-11-27T08:02:00.000Z",
      quoteSnippet: "Decision two",
      status: "ACTIVE" as const,
    },
    {
      refId: "M3",
      messageId: "src-3",
      senderName: "Lan Tran",
      createdAt: "2026-11-27T08:03:00.000Z",
      quoteSnippet: "Decision three",
      status: "ACTIVE" as const,
    },
    {
      refId: "M4",
      messageId: "src-4",
      senderName: "Phuc Nguyen",
      createdAt: "2026-11-27T08:04:00.000Z",
      quoteSnippet: "Decision four",
      status: "ACTIVE" as const,
    },
    {
      refId: "M5",
      messageId: "src-5",
      senderName: "Lan Tran",
      createdAt: "2026-11-27T08:05:00.000Z",
      quoteSnippet: "Edited decision five",
      status: "EDITED" as const,
    },
    {
      refId: "M6",
      messageId: "src-6",
      senderName: "Phuc Nguyen",
      createdAt: "2026-11-27T08:06:00.000Z",
      quoteSnippet: "",
      status: "DELETED" as const,
    },
  ];
  const manyRefMessage: ChatMessage = {
    ...message,
    id: "ai-many-refs",
    senderId: "assistant:continuum_ai",
    senderName: "Continuum AI",
    authorType: "ASSISTANT",
    triggerMessageId: "trigger-many",
    assistantStatus: "COMPLETED",
    assistantMeta: {
      handle: "continuumAI",
      queryMode: "TIME_WINDOW",
      partialCoverage: false,
      coverageNote: null,
      sourceState: "HAS_EDITED_AND_DELETED",
    },
    content: "Summary of yesterday decisions [M1] [M5] [M6].",
    sourceReferences: sources,
  };

  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={manyRefMessage}
        mine={false}
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onOpenContext={vi.fn()}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );

  // Full Chat collapsed: 3 visible chips, prioritizing EDITED M5 and DELETED M6 + M1
  expect(screen.getByTestId("assistant-source-chip-M1")).toBeInTheDocument();
  expect(screen.getByTestId("assistant-source-chip-M5")).toBeInTheDocument();
  expect(screen.getByTestId("assistant-source-chip-M6")).toBeInTheDocument();
  expect(
    screen.queryByTestId("assistant-source-chip-M2"),
  ).not.toBeInTheDocument();

  const toggle = screen.getByTestId("assistant-sources-toggle");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveTextContent("Show all 6 sources");

  // Expanding reveals all 6 sources
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveTextContent("Show fewer sources");
  expect(screen.getByTestId("assistant-source-chip-M2")).toBeInTheDocument();
  expect(screen.getByTestId("assistant-source-chip-M4")).toBeInTheDocument();

  // Collapsing hides extras again
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByTestId("assistant-source-chip-M4"),
  ).not.toBeInTheDocument();

  // Compact Mini Chat mode collapses to 2 chips (prioritizing EDITED M5 + DELETED M6)
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatMessageBubble
        message={manyRefMessage}
        mine={false}
        compact
        showSender={false}
        groupStart
        groupEnd
        highlighted={false}
        onOpenContext={vi.fn()}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReaction={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByTestId("assistant-source-chip-M5")).toBeInTheDocument();
  expect(screen.getByTestId("assistant-source-chip-M6")).toBeInTheDocument();
  expect(
    screen.queryByTestId("assistant-source-chip-M1"),
  ).not.toBeInTheDocument();
});
