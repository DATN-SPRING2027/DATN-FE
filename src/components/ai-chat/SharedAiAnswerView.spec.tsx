import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import type { AiSharedAnswer } from "@/lib/queries/ai-chat/ai-chat.types";
import SharedAiAnswerView from "./SharedAiAnswerView";

const { useSharedAnswerQueryMock } = vi.hoisted(() => ({
  useSharedAnswerQueryMock: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: {
      id: "user-2",
      name: "Project Teammate",
      email: "teammate@continuum.ai",
      organizationId: "org-1",
      roles: ["MEMBER"],
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/queries/ai-chat/useAiAnswerActions", () => ({
  useSharedAiAnswerQuery: (...args: unknown[]) =>
    useSharedAnswerQueryMock(...args),
}));

describe("SharedAiAnswerView (Project-member read-only shared Q&A boundary)", () => {
  beforeEach(() => {
    useSharedAnswerQueryMock.mockReset();
  });

  function renderView() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SharedAiAnswerView projectId="proj-1" shareId="share-99" />
      </NextIntlClientProvider>,
    );
  }

  it("renders single shared question, answer, and verified citations without leaking thread history", () => {
    const sharedData: AiSharedAnswer = {
      share: {
        id: "share-99",
        projectId: "proj-1",
        messageId: "msg-a1",
        createdAt: "2026-10-30T09:05:00Z",
      },
      question: {
        content: "What is our PostgreSQL migration rule?",
      },
      answer: {
        id: "msg-a1",
        content: "Never edit an existing numbered migration [1].",
        citations: [
          {
            number: 1,
            sourceId: "src-db",
            documentId: "507f1f77bcf86cd799439088",
            documentName: "Database Governance Spec",
            snippet: "Add a new migration script only.",
          },
        ],
      },
    };
    useSharedAnswerQueryMock.mockReturnValue({
      data: sharedData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderView();

    expect(
      screen.getByText("What is our PostgreSQL migration rule?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Never edit an existing numbered migration/),
    ).toBeInTheDocument();
    expect(screen.getByText("Database Governance Spec")).toBeInTheDocument();
    for (const label of ["Copy", "Read aloud"]) {
      const btn = screen.getByRole("button", { name: label });
      expect(btn.textContent?.trim() ?? "").toBe("");
      expect(btn).toHaveAttribute("title", label);
    }
    expect(
      screen.queryByRole("textbox", { name: "Ask Continuum SAG" }),
    ).not.toBeInTheDocument();
  });

  it("shows safe unavailable boundary on 404 when share is revoked, non-member, or source access lost", () => {
    useSharedAnswerQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError(404, "AI_CHAT_RESOURCE_NOT_FOUND", "Not found"),
      refetch: vi.fn(),
    });

    renderView();

    expect(
      screen.getByRole("heading", { name: /Shared answer unavailable/i }),
    ).toBeInTheDocument();
  });

  it("retries when transient 503 error occurs", () => {
    const refetch = vi.fn();
    useSharedAnswerQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError(503, "SAG_UNAVAILABLE", "Temporary outage"),
      refetch,
    });

    renderView();

    fireEvent.click(screen.getByRole("button", { name: /Try again|Retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
