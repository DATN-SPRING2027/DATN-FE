import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
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

function renderMessage(message = assistant, locale = "vi") {
  const messages = locale === "vi" ? viMessages : en;
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
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
      />
    </NextIntlClientProvider>,
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
});
