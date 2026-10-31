import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import AiChatMessageList, {
  type DisplayAiChatMessage,
} from "./AiChatMessageList";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const canonicalNoAnswer =
  "The available knowledge base does not contain enough traceable evidence to answer this question.";

const assistant: DisplayAiChatMessage = {
  id: "assistant-1",
  role: "assistant",
  status: "ok",
  content: canonicalNoAnswer,
  answerStatus: "no_answer",
  citations: [],
  sessionCitations: [],
  retrievalSteps: [],
  createdAt: "2026-10-30T06:00:00Z",
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactElement, locale = "vi") {
  const messages = locale === "vi" ? viMessages : en;
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function renderMessage(message = assistant, locale = "vi") {
  renderWithProviders(
    <AiChatMessageList
      projectId="project-1"
      mode="chat"
      messages={[message]}
      isLoadingMessages={false}
      isMessagesError={false}
      hasOlderMessages={false}
      isLoadingOlder={false}
      highlightedTurnId={null}
      onLoadOlder={vi.fn()}
      onRetryMessages={vi.fn()}
      onRetryTurn={vi.fn()}
      onInspectEvidence={vi.fn()}
      onJumpToTurn={vi.fn()}
    />,
    locale,
  );
}

describe("AI Chat no-answer presentation", () => {
  it.each(["vi", "en"])(
    "renders one localized no-answer explanation in %s instead of the engine's fixed English fallback",
    (locale) => {
      const messages = locale === "vi" ? viMessages : en;
      renderMessage(assistant, locale);

      expect(screen.queryByText(canonicalNoAnswer)).not.toBeInTheDocument();
      expect(screen.getAllByText(messages.AiChat.noAnswerNotice)).toHaveLength(
        1,
      );
      expect(screen.queryByText("[1]")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: messages.AiChat.previewExcerptAction,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: messages.AiChat.openDocumentLink }),
      ).not.toBeInTheDocument();
    },
  );

  it("preserves an actual English answer when the interface locale is Vietnamese", () => {
    const answer = "The frontend uses Next.js with React.";
    renderMessage({ ...assistant, answerStatus: "answered", content: answer });

    expect(screen.getByText(answer)).toBeVisible();
    expect(
      screen.queryByText(viMessages.AiChat.noAnswerNotice),
    ).not.toBeInTheDocument();
  });

  it("localizes the canonical fallback in reloaded history without transient answer status", () => {
    renderMessage({ ...assistant, answerStatus: undefined });
    expect(screen.queryByText(canonicalNoAnswer)).not.toBeInTheDocument();
    expect(screen.getByText(viMessages.AiChat.noAnswerNotice)).toBeVisible();
  });

  it("preserves an explicitly answered quotation even when it matches the fallback text", () => {
    renderMessage({ ...assistant, answerStatus: "answered" });
    expect(screen.getByText(canonicalNoAnswer)).toBeVisible();
    expect(
      screen.queryByText(viMessages.AiChat.noAnswerNotice),
    ).not.toBeInTheDocument();
  });

  it.each(["failed", "cancelled"] as const)(
    "keeps a %s run distinct from a completed no-answer result",
    (status) => {
      const content = "Partial response before the run ended.";
      const error = "The AI service is temporarily unavailable.";
      renderMessage({
        ...assistant,
        status,
        content,
        errorMessage: error,
      });

      expect(
        screen.queryByText(viMessages.AiChat.noAnswerNotice),
      ).not.toBeInTheDocument();
      expect(screen.getByText(content)).toBeVisible();
      if (status === "failed") {
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        expect(screen.getByText(viMessages.AiChat.statusFailed)).toBeVisible();
      } else {
        expect(
          screen.getByText(viMessages.AiChat.statusCancelled),
        ).toBeVisible();
      }
    },
  );

  it.each(["vi", "en"] as const)(
    "localizes whitelisted errorCode (%s) instead of displaying raw English backend failure text",
    (locale) => {
      const messages = locale === "vi" ? viMessages : en;
      renderMessage(
        {
          ...assistant,
          status: "failed",
          content: "",
          answerStatus: undefined,
          errorCode: "SEARCH_UNAVAILABLE",
          errorMessage:
            "Knowledge search index is temporarily unavailable. Please try again.",
        },
        locale,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        (messages.AiChat as Record<string, string>).errorSearchUnavailable,
      );
    },
  );

  it("enables Retry for cancelled turns and reloaded failed turns by inferring the preceding user prompt", () => {
    const onRetryTurn = vi.fn();
    const userTurn: DisplayAiChatMessage = {
      id: "user-1",
      role: "user",
      status: "ok",
      content: "Theo tài liệu 02_FRONTEND_NEXTJS.md, frontend dùng framework nào?",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T06:00:00Z",
    };
    const cancelledAssistant: DisplayAiChatMessage = {
      ...assistant,
      id: "assistant-cancelled",
      status: "cancelled",
      content: "Đang trả lời dở...",
      answerStatus: undefined,
    };

    const queryClient = createTestQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <AiChatMessageList
            projectId="project-1"
            mode="chat"
            messages={[userTurn, cancelledAssistant]}
            isLoadingMessages={false}
            isMessagesError={false}
            hasOlderMessages={false}
            isLoadingOlder={false}
            highlightedTurnId={null}
            onLoadOlder={vi.fn()}
            onRetryMessages={vi.fn()}
            onRetryTurn={onRetryTurn}
            onInspectEvidence={vi.fn()}
            onJumpToTurn={vi.fn()}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: viMessages.AiChat.retryTurn }),
    );
    expect(onRetryTurn).toHaveBeenCalledWith(userTurn.content);

    onRetryTurn.mockClear();
    const reloadedFailed: DisplayAiChatMessage = {
      ...assistant,
      id: "assistant-failed-reloaded",
      status: "failed",
      content: "",
      answerStatus: undefined,
      errorCode: "LLM_TIMEOUT",
    };

    rerender(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <AiChatMessageList
            projectId="project-1"
            mode="chat"
            messages={[userTurn, reloadedFailed]}
            isLoadingMessages={false}
            isMessagesError={false}
            hasOlderMessages={false}
            isLoadingOlder={false}
            highlightedTurnId={null}
            onLoadOlder={vi.fn()}
            onRetryMessages={vi.fn()}
            onRetryTurn={onRetryTurn}
            onInspectEvidence={vi.fn()}
            onJumpToTurn={vi.fn()}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: viMessages.AiChat.retryTurn }),
    );
    expect(onRetryTurn).toHaveBeenCalledWith(userTurn.content);
  });

  it("renders GFM Markdown tables and ordered lists with interactive citations inside cells", () => {
    const onInspectEvidence = vi.fn();
    const markdownContent = [
      "1. Bước xác thực phiên",
      "2. Bước kiểm tra quyền dự án",
      "",
      "| Thành phần | Công nghệ | Nguồn |",
      "| --- | --- | :---: |",
      "| Frontend | **Next.js** `App Router` | [1] |",
    ].join("\n");

    renderWithProviders(
      <AiChatMessageList
        projectId="project-1"
        mode="chat"
        messages={[
          {
            ...assistant,
            answerStatus: "answered",
            content: markdownContent,
            citations: [
              {
                number: 1,
                sourceId: "src-fe",
                documentId: "6ad8834abef68a3326035eeb",
                documentName: "02_FRONTEND_NEXTJS.md",
                heading: "Framework",
                snippet: "Frontend uses Next.js App Router.",
              },
            ],
          },
        ]}
        isLoadingMessages={false}
        isMessagesError={false}
        hasOlderMessages={false}
        isLoadingOlder={false}
        highlightedTurnId={null}
        onLoadOlder={vi.fn()}
        onRetryMessages={vi.fn()}
        onRetryTurn={vi.fn()}
        onInspectEvidence={onInspectEvidence}
        onJumpToTurn={vi.fn()}
      />,
      "vi",
    );

    expect(screen.getByRole("table")).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Thành phần" }),
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: /Next\.js/ })).toBeVisible();
    expect(screen.getByText("Bước xác thực phiên").closest("ol")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: viMessages.AiChat.citationJumpAria.replace("{label}", "1"),
      }),
    );
    expect(onInspectEvidence).toHaveBeenCalledTimes(1);
  });

  it("renders clickable Branched from divider at the branch point and hides in-place Regenerate on inherited messages", () => {
    const onSelectParentThread = vi.fn();
    const onBranchFromMessage = vi.fn();
    const onRegenerateMessage = vi.fn();

    const inheritedUser: DisplayAiChatMessage = {
      id: "msg-u1",
      role: "user",
      status: "ok",
      content: "Explain the BFF ACL boundary.",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T08:00:00Z",
      isInherited: true,
    };
    const inheritedV1: DisplayAiChatMessage = {
      id: "msg-a1-v1",
      role: "assistant",
      status: "ok",
      answerStatus: "answered",
      content: "Version 1 inherited answer.",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T08:00:05Z",
      replyToMessageId: "msg-u1",
      isInherited: true,
    };
    const inheritedV2: DisplayAiChatMessage = {
      id: "msg-a1-v2",
      role: "assistant",
      status: "ok",
      answerStatus: "answered",
      content: "Version 2 inherited answer.",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T08:00:10Z",
      replyToMessageId: "msg-u1",
      regeneratedFromMessageId: "msg-a1-v1",
      isInherited: true,
    };
    const ownFollowUpUser: DisplayAiChatMessage = {
      id: "msg-u2",
      role: "user",
      status: "ok",
      content: "What if we revoke membership?",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T08:05:00Z",
      isInherited: false,
    };
    const ownFollowUpAssistant: DisplayAiChatMessage = {
      id: "msg-a2",
      role: "assistant",
      status: "ok",
      answerStatus: "answered",
      content: "Live ACL blocks access immediately.",
      citations: [],
      sessionCitations: [],
      retrievalSteps: [],
      createdAt: "2026-10-30T08:05:06Z",
      replyToMessageId: "msg-u2",
      isInherited: false,
    };

    renderWithProviders(
      <AiChatMessageList
        organizationId="org-1"
        projectId="project-1"
        projectName="Continuum Core"
        threadId="thread-branch-1"
        activeThread={{
          id: "thread-branch-1",
          title: "Branch · Security Review",
          createdAt: "2026-10-30T08:02:00Z",
          updatedAt: "2026-10-30T08:05:06Z",
          isBranched: true,
          parentThreadId: "thread-parent",
          parentThreadTitle: "Security Review",
          branchPointMessageId: "msg-a1-v2",
        }}
        mode="chat"
        messages={[
          inheritedUser,
          inheritedV1,
          inheritedV2,
          ownFollowUpUser,
          ownFollowUpAssistant,
        ]}
        isLoadingMessages={false}
        isMessagesError={false}
        hasOlderMessages={false}
        isLoadingOlder={false}
        highlightedTurnId={null}
        onLoadOlder={vi.fn()}
        onRetryMessages={vi.fn()}
        onRetryTurn={vi.fn()}
        onRegenerateMessage={onRegenerateMessage}
        onBranchFromMessage={onBranchFromMessage}
        onSelectParentThread={onSelectParentThread}
        onInspectEvidence={vi.fn()}
        onJumpToTurn={vi.fn()}
      />,
      "en",
    );

    // Only own non-inherited assistant turn has Try again; inherited turn hides in-place regenerate
    const tryAgainButtons = screen.getAllByRole("button", {
      name: en.AiChat.tryAgainAction,
    });
    expect(tryAgainButtons).toHaveLength(1);

    // Inline Branched from pill navigates back to parent thread
    const parentLinkBtn = screen.getByRole("button", {
      name: "Open original conversation: Security Review",
    });
    expect(parentLinkBtn).toHaveTextContent("Branched from Security Review");
    fireEvent.click(parentLinkBtn);
    expect(onSelectParentThread).toHaveBeenCalledWith("thread-parent");

    // Switching < 2 / 2 > -> < 1 / 2 > on inherited turn and branching locks onto msg-a1-v1!
    fireEvent.click(
      screen.getByRole("button", { name: en.AiChat.previousVersionAria }),
    );
    expect(screen.getByText("Version 1 inherited answer.")).toBeVisible();

    fireEvent.click(screen.getByTestId("ai-chat-more-actions-msg-a1-v1"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: en.AiChat.branchInNewChatAction }),
    );
    expect(onBranchFromMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "msg-a1-v1" }),
    );
  });

  it("renders non-clickable tombstone fallback when parentThreadId is null on a branched thread", () => {
    renderWithProviders(
      <AiChatMessageList
        organizationId="org-1"
        projectId="project-1"
        threadId="thread-orphan-branch"
        activeThread={{
          id: "thread-orphan-branch",
          title: "Branch · Deleted Original",
          createdAt: "2026-10-30T08:02:00Z",
          updatedAt: "2026-10-30T08:02:00Z",
          isBranched: true,
          parentThreadId: null,
          parentThreadTitle: null,
          branchPointMessageId: "assistant-1",
        }}
        mode="chat"
        messages={[{ ...assistant, answerStatus: "answered", content: "Inherited turn." }]}
        isLoadingMessages={false}
        isMessagesError={false}
        hasOlderMessages={false}
        isLoadingOlder={false}
        highlightedTurnId={null}
        onLoadOlder={vi.fn()}
        onRetryMessages={vi.fn()}
        onRetryTurn={vi.fn()}
        onSelectParentThread={vi.fn()}
        onInspectEvidence={vi.fn()}
        onJumpToTurn={vi.fn()}
      />,
      "en",
    );

    const divider = screen.getByTestId("ai-chat-branch-divider");
    expect(divider).toHaveTextContent(en.AiChat.branchedFromDeletedChat);
    expect(divider.querySelector("button")).toBeNull();
  });
});
