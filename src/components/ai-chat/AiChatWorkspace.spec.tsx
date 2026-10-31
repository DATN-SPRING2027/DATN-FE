import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import type {
  AiChatMessagePage,
  AiChatStreamEvent,
  AiChatThread,
} from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatWorkspace from "./AiChatWorkspace";

const {
  replaceMock,
  useSearchParamsMock,
  useActiveProjectsMock,
  useThreadsMock,
  createThreadMutateAsync,
  updateThreadMutateAsync,
  deleteThreadMutateAsync,
  branchThreadMutateAsync,
  useMessagesInfiniteMock,
  streamAiChatAskMock,
  streamAiChatRegenerateMock,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
  useActiveProjectsMock: vi.fn(),
  useThreadsMock: vi.fn(),
  createThreadMutateAsync: vi.fn(),
  updateThreadMutateAsync: vi.fn(),
  deleteThreadMutateAsync: vi.fn(),
  branchThreadMutateAsync: vi.fn(),
  useMessagesInfiniteMock: vi.fn(),
  streamAiChatAskMock: vi.fn(),
  streamAiChatRegenerateMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
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
  usePathname: () => "/ai-chat",
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: {
      id: "user-1",
      name: "Thang Developer",
      email: "thang@continuum.ai",
      organizationId: "org-1",
      roles: ["ADMIN"],
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/queries/projects/useActiveOrganizationProjects", () => ({
  useActiveOrganizationProjects: (...args: unknown[]) =>
    useActiveProjectsMock(...args),
}));

vi.mock("@/lib/queries/ai-chat/useAiChat", () => ({
  aiChatKeys: {
    project: (orgId: string, projectId: string) =>
      ["ai-chat", orgId, projectId] as const,
    threads: (orgId: string, projectId: string) =>
      ["ai-chat", orgId, projectId, "threads"] as const,
    messages: (orgId: string, projectId: string, threadId: string) =>
      ["ai-chat", orgId, projectId, "messages", threadId] as const,
  },
  useAiChatThreadsQuery: (...args: unknown[]) => useThreadsMock(...args),
  useCreateAiChatThreadMutation: () => ({
    mutateAsync: createThreadMutateAsync,
    isPending: false,
  }),
  useUpdateAiChatThreadMutation: () => ({
    mutateAsync: updateThreadMutateAsync,
    isPending: false,
  }),
  useDeleteAiChatThreadMutation: () => ({
    mutateAsync: deleteThreadMutateAsync,
    isPending: false,
  }),
  useBranchAiChatThreadMutation: () => ({
    mutateAsync: branchThreadMutateAsync,
    isPending: false,
  }),
  useAiChatMessagesInfiniteQuery: (...args: unknown[]) =>
    useMessagesInfiniteMock(...args),
}));

vi.mock("@/lib/queries/ai-chat/ai-chat-stream", () => ({
  streamAiChatAsk: (...args: unknown[]) => streamAiChatAskMock(...args),
  streamAiChatRegenerate: (...args: unknown[]) =>
    streamAiChatRegenerateMock(...args),
}));

vi.mock("@/lib/queries/ai-chat/useAiAnswerActions", () => ({
  useAiAnswerFeedbackQuery: () => ({
    data: { feedback: null },
    isLoading: false,
    isError: false,
  }),
  useUpsertAiAnswerFeedbackMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteAiAnswerFeedbackMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateAiAnswerShareMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokeAiAnswerShareMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./AiChatMindMapPanel", () => ({
  default: () => <aside data-testid="mind-map-workspace-panel">Cached map</aside>,
}));

function renderWorkspace() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiChatWorkspace />
    </NextIntlClientProvider>,
  );
}

describe("AiChatWorkspace (ChatGPT-style UI + Real SAG BFF & ECCE integration)", () => {
  const sampleThreads: AiChatThread[] = [
    {
      id: "thread-1",
      title: "SAG BFF Security Review",
      createdAt: "2026-10-28T10:00:00Z",
      updatedAt: "2026-10-28T10:05:00Z",
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    replaceMock.mockReset();
    branchThreadMutateAsync.mockReset();
    invalidateQueriesMock.mockReset().mockResolvedValue(undefined);
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useActiveProjectsMock.mockReset().mockReturnValue({
      projects: [
        {
          id: "proj-core",
          organizationId: "org-1",
          name: "Continuum Core",
          code: "CORE",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "proj-docs",
          organizationId: "org-1",
          name: "Architecture Docs",
          code: "DOCS",
          visibility: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      isLoading: false,
      isError: false,
    });
    useThreadsMock.mockReset().mockReturnValue({
      data: sampleThreads,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useMessagesInfiniteMock.mockReset().mockReturnValue({
      data: {
        pages: [
          {
            items: [],
            nextCursor: null,
            hasMore: false,
          } satisfies AiChatMessagePage,
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
    createThreadMutateAsync.mockReset();
    updateThreadMutateAsync.mockReset();
    deleteThreadMutateAsync.mockReset();
    streamAiChatAskMock.mockReset();
    streamAiChatRegenerateMock.mockReset();
  });

  it("unmounts an open Mind Map immediately when Project access is revoked", () => {
    const view = renderWorkspace();
    fireEvent.click(screen.getByTestId("ai-chat-mind-map-trigger"));
    expect(screen.getByTestId("mind-map-workspace-panel")).toBeInTheDocument();
    useThreadsMock.mockReturnValue({
      data: sampleThreads,
      isLoading: false,
      isError: true,
      error: new ApiError(403, "FORBIDDEN", "Project access revoked"),
      refetch: vi.fn(),
    });
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatWorkspace />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId("mind-map-workspace-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-chat-mind-map-trigger")).toBeDisabled();
  });

  it("renders the welcome state without a Chat/Work switch and auto-selects the first ACTIVE project", () => {
    renderWorkspace();

    expect(
      screen.getByRole("heading", { name: "Ready when you are." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select project scope" }),
    ).toHaveTextContent("Continuum Core");
    expect(screen.queryByText(/All Projects/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuum SAG engine details" }),
    ).toHaveTextContent("Continuum SAG");

    const sidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    expect(
      within(sidebar).getByRole("button", { name: "New chat" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByText("SAG BFF Security Review"),
    ).toBeInTheDocument();

    // Pin thread moves it to Pinned section
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "Pin SAG BFF Security Review",
      }),
    );
    expect(within(sidebar).getByText("Pinned")).toBeInTheDocument();

    expect(
      screen.queryAllByRole("group", { name: "Workspace mode" }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: "Chat" }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: "Work" }),
    ).toHaveLength(0);

    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "SAG BFF Security Review",
      }),
    );
    expect(
      screen.queryAllByRole("group", { name: "Workspace mode" }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: "Work" }),
    ).toHaveLength(0);
  });

  it("keeps the focused composer mounted across Enter, thread creation, streaming and completion", async () => {
    let resolveCreateThread!: (thread: AiChatThread) => void;
    let emitEvent!: (event: AiChatStreamEvent) => void;
    let finishStream: (() => void) | undefined;
    createThreadMutateAsync.mockImplementationOnce(
      () =>
        new Promise<AiChatThread>((resolve) => {
          resolveCreateThread = resolve;
        }),
    );
    streamAiChatAskMock.mockImplementationOnce(
      ({ onEvent }: { onEvent: (event: AiChatStreamEvent) => void }) => {
        emitEvent = onEvent;
        return new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    renderWorkspace();
    const composer = screen.getByRole("textbox", { name: "Ask Continuum SAG" });
    composer.focus();
    fireEvent.change(composer, {
      target: { value: "Which framework does this project use?" },
    });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    expect(createThreadMutateAsync).toHaveBeenCalledTimes(1);
    expect(composer).toHaveFocus();

    await act(async () => {
      resolveCreateThread({
        id: "thread-stable-composer",
        title: "Which framework does this project use?",
        createdAt: "2026-10-30T08:00:00Z",
        updatedAt: "2026-10-30T08:00:00Z",
      });
    });

    try {
      expect(streamAiChatAskMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("textbox", { name: "Ask Continuum SAG" })).toBe(
        composer,
      );
      expect(composer).toHaveFocus();
      expect(
        screen.getByRole("button", { name: "Stop generating" }),
      ).toBeInTheDocument();

      act(() =>
        emitEvent({ event: "delta", data: { text: "Next.js is used." } }),
      );
      expect(screen.getByRole("textbox", { name: "Ask Continuum SAG" })).toBe(
        composer,
      );
      expect(composer).toHaveFocus();

      await act(async () => {
        emitEvent({
          event: "completed",
          data: {
            messageId: "answer-stable-composer",
            content: "Next.js is used.",
            answerStatus: "answered",
            citations: [],
            sessionCitations: [],
            retrievalSteps: [],
          },
        });
        finishStream?.();
      });
      expect(screen.getByRole("textbox", { name: "Ask Continuum SAG" })).toBe(
        composer,
      );
      expect(composer).toHaveFocus();
      expect(
        screen.getByRole("button", { name: "Send message" }),
      ).toBeDisabled();
    } finally {
      await act(async () => {
        finishStream?.();
      });
    }
  });

  it("creates a thread on first question, docks composer, streams SAG delta chunks, and renders verified [1] & [S1] citations", async () => {
    createThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-new",
      title: "New chat",
      createdAt: "2026-10-28T11:00:00Z",
      updatedAt: "2026-10-28T11:00:00Z",
    } satisfies AiChatThread);

    streamAiChatAskMock.mockImplementationOnce(
      async ({ onEvent }: { onEvent: (event: AiChatStreamEvent) => void }) => {
        onEvent({
          event: "started",
          data: {
            runId: "run-1",
            threadId: "thread-new",
            userMessageId: "m-user-1",
          },
        });
        onEvent({
          event: "step",
          data: {
            kind: "tool",
            label: "Search Project Documents",
            durationMs: 128,
            count: 2,
          },
        });
        onEvent({
          event: "delta",
          data: {
            text: "Luồng BFF cô lập token theo từng dự án [1, S1].",
          },
        });
        onEvent({
          event: "completed",
          data: {
            messageId: "m-assistant-1",
            content: "Luồng BFF cô lập token theo từng dự án [1, S1].",
            answerStatus: "answered",
            citations: [
              {
                number: 1,
                sourceId: "src-1",
                documentId: "507f1f77bcf86cd799439088",
                documentName: "IAM & SAG Trust Boundary Spec",
                heading: "Continuum Login",
                snippet: "Short-lived project-scoped HS256 JWT.",
                pageFrom: 2,
                pageTo: 3,
                mapped: true,
                claimLevel: "claim",
              },
            ],
            sessionCitations: [
              {
                ref: "S1",
                source: "selected_group",
                groupId: "g-1",
                turnIds: ["m-user-1"],
                summaryExcerpt: "Confirmed single-project scope.",
                mapped: true,
                claimLevel: "claim",
              },
            ],
            retrievalSteps: [
              {
                kind: "tool",
                label: "Search Project Documents",
                durationMs: 128,
                count: 2,
              },
            ],
          },
        });
      },
    );

    renderWorkspace();

    const composer = screen.getByRole("textbox", {
      name: "Ask Continuum SAG",
    });
    fireEvent.change(composer, {
      target: { value: "Giải thích ranh giới bảo mật giữa BFF và SAG?" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    expect(createThreadMutateAsync).toHaveBeenCalledTimes(1);
    expect(streamAiChatAskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-core",
        threadId: "thread-new",
        query: "Giải thích ranh giới bảo mật giữa BFF và SAG?",
      }),
    );

    expect(
      await screen.findByText(/IAM & SAG Trust Boundary Spec/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Confirmed single-project scope\./),
    ).toBeInTheDocument();
  });

  it("supports deleting an existing thread and collapses/reopens the ChatGPT history sidebar", async () => {
    deleteThreadMutateAsync.mockResolvedValueOnce(undefined);
    renderWorkspace();

    const sidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    await act(async () => {
      fireEvent.click(
        within(sidebar).getByRole("button", {
          name: "Delete SAG BFF Security Review",
        }),
      );
    });
    expect(deleteThreadMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse chat history sidebar" }),
    );
    expect(
      screen.queryByRole("complementary", {
        name: "AI Chat conversation history",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open chat history sidebar" })[0]!,
    );
    expect(
      screen.getByRole("complementary", {
        name: "AI Chat conversation history",
      }),
    ).toBeInTheDocument();
  });

  it("renders empty project state when user has zero active projects", () => {
    useActiveProjectsMock.mockReturnValue({
      projects: [],
      isLoading: false,
      isError: false,
    });

    renderWorkspace();

    expect(
      screen.getByRole("heading", { name: "No active projects available" }),
    ).toBeInTheDocument();
  });

  it("supports inline thread rename and enforces 4000-character query validation", async () => {
    updateThreadMutateAsync.mockResolvedValueOnce({
      ...sampleThreads[0]!,
      title: "Updated Architecture Thread",
    } satisfies AiChatThread);

    renderWorkspace();

    const sidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "Rename SAG BFF Security Review",
      }),
    );

    const titleInput = within(sidebar).getByRole("textbox", {
      name: "Conversation title",
    });
    fireEvent.change(titleInput, {
      target: { value: "Updated Architecture Thread" },
    });

    await act(async () => {
      fireEvent.click(
        within(sidebar).getByRole("button", { name: "Save title" }),
      );
    });
    expect(updateThreadMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
      title: "Updated Architecture Thread",
    });

    const composer = screen.getByRole("textbox", {
      name: "Ask Continuum SAG",
    });
    fireEvent.change(composer, { target: { value: "x".repeat(4005) } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Keep your question within 4000 characters.",
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(streamAiChatAskMock).not.toHaveBeenCalled();
  });

  it("revalidates the login session after an AI ask returns 401 without replaying the ask", async () => {
    createThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-2",
      title: "Session expiry check",
      createdAt: "2026-10-31T10:00:00Z",
      updatedAt: "2026-10-31T10:00:00Z",
    } satisfies AiChatThread);
    streamAiChatAskMock.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "The login session expired."),
    );

    renderWorkspace();
    const composer = screen.getByRole("textbox", {
      name: "Ask Continuum SAG",
    });
    fireEvent.change(composer, { target: { value: "Check the session." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(streamAiChatAskMock).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: authKeys.currentUser(),
      exact: true,
    });
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          alert.textContent?.includes(
            "Your login session expired or security token changed.",
          ),
        ),
    ).toBe(true);
  });

  it("surfaces permission-denied banner on 403 access loss and opens/closes citation excerpt dialog", () => {
    useThreadsMock.mockReturnValue({
      data: sampleThreads,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useMessagesInfiniteMock.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: "m-1",
                role: "assistant",
                content: "Kiểm tra phân quyền [1].",
                status: "ok",
                createdAt: "2026-10-28T10:10:00Z",
                citations: [
                  {
                    number: 1,
                    sourceId: "src-1",
                    documentId: "507f1f77bcf86cd799439099",
                    documentName: "RBAC Policy Handbook",
                    snippet: "Default-deny per project.",
                  },
                ],
                sessionCitations: [],
                retrievalSteps: [],
              },
            ],
            nextCursor: null,
            hasMore: false,
          } satisfies AiChatMessagePage,
        ],
      },
      isLoading: false,
      isError: true,
      error: new ApiError(403, "FORBIDDEN", "Access revoked"),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    renderWorkspace();

    fireEvent.click(screen.getByText("SAG BFF Security Review"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Project access unavailable/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "View source [1]" }));
    const dialog = screen.getByRole("dialog", {
      name: "Source evidence details",
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Default-deny per project.")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Source evidence details" }),
    ).not.toBeInTheDocument();
  });

  it("cancels in-flight thread creation on project switch and cleans up pinned IDs on thread deletion", async () => {
    let resolveCreateThread!: (thread: AiChatThread) => void;
    createThreadMutateAsync.mockImplementationOnce(
      () =>
        new Promise<AiChatThread>((resolve) => {
          resolveCreateThread = resolve;
        }),
    );

    renderWorkspace();

    const sidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });

    // Pin thread-1 then delete it -> localStorage pinned array is cleaned up
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "Pin SAG BFF Security Review",
      }),
    );
    expect(
      window.localStorage.getItem("continuum.aiChat.pinned.org-1.proj-core"),
    ).toBe(JSON.stringify(["thread-1"]));

    deleteThreadMutateAsync.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(
        within(sidebar).getByRole("button", {
          name: "Delete SAG BFF Security Review",
        }),
      );
    });
    expect(
      window.localStorage.getItem("continuum.aiChat.pinned.org-1.proj-core"),
    ).toBe(JSON.stringify([]));

    // Start sending a question on proj-core (createThread is pending)
    const composer = screen.getByRole("textbox", {
      name: "Ask Continuum SAG",
    });
    fireEvent.change(composer, {
      target: { value: "Pending thread race test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(createThreadMutateAsync).toHaveBeenCalledTimes(1);

    // Switch project while createThread is still in-flight
    fireEvent.click(
      screen.getByRole("button", { name: "Select project scope" }),
    );
    fireEvent.click(screen.getByText("Architecture Docs"));

    // Resolve stale proj-core thread creation -> must NOT open stream or hijack active thread!
    await act(async () => {
      resolveCreateThread({
        id: "stale-thread-core",
        title: "Pending thread race test",
        createdAt: "2026-10-28T12:00:00Z",
        updatedAt: "2026-10-28T12:00:00Z",
      });
    });

    expect(streamAiChatAskMock).not.toHaveBeenCalled();
  });

  it("regenerates an existing answer via Try again without duplicating the user bubble and switches versions", async () => {
    useMessagesInfiniteMock.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: "msg-user-1",
                role: "user",
                content: "Explain Continuum SAG ACL.",
                status: "ok",
                citations: [],
                sessionCitations: [],
                retrievalSteps: [],
                createdAt: "2026-10-30T08:00:00Z",
              },
              {
                id: "msg-assistant-1",
                role: "assistant",
                content: "First answer version.",
                status: "ok",
                citations: [],
                sessionCitations: [],
                retrievalSteps: [],
                createdAt: "2026-10-30T08:00:05Z",
                replyToMessageId: "msg-user-1",
              },
            ],
            nextCursor: null,
            hasMore: false,
          } satisfies AiChatMessagePage,
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    streamAiChatRegenerateMock.mockImplementationOnce(
      async ({
        onEvent,
      }: {
        onEvent: (event: AiChatStreamEvent) => void;
      }) => {
        onEvent({
          event: "started",
          data: {
            runId: "run-regen-1",
            threadId: "thread-1",
            userMessageId: "msg-user-1",
          },
        });
        onEvent({
          event: "delta",
          data: { text: "Second regenerated answer version." },
        });
        onEvent({
          event: "completed",
          data: {
            messageId: "msg-assistant-2",
            replyToMessageId: "msg-user-1",
            regeneratedFromMessageId: "msg-assistant-1",
            content: "Second regenerated answer version.",
            answerStatus: "answered",
            citations: [],
            sessionCitations: [],
            retrievalSteps: [],
          },
        });
      },
    );

    renderWorkspace();
    fireEvent.click(screen.getByText("SAG BFF Security Review"));

    expect(screen.getByText("First answer version.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    expect(streamAiChatRegenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-core",
        threadId: "thread-1",
        messageId: "msg-assistant-1",
      }),
    );

    expect(screen.getAllByText("Explain Continuum SAG ACL.")).toHaveLength(1);
    expect(
      screen.getByText("Second regenerated answer version."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Previous answer version" }),
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("First answer version.")).toBeInTheDocument();
  });

  it("upserts streaming execution trace steps in place by id without duplicating rows", async () => {
    createThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-trace",
      title: "Trace test",
      createdAt: "2026-10-30T10:00:00Z",
      updatedAt: "2026-10-30T10:00:00Z",
    });

    let emitEvent!: (event: AiChatStreamEvent) => void;
    let finishStream!: () => void;
    streamAiChatAskMock.mockImplementationOnce(
      ({ onEvent }: { onEvent: (event: AiChatStreamEvent) => void }) => {
        emitEvent = onEvent;
        return new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    renderWorkspace();
    const textarea = screen.getByRole("textbox", {
      name: /Ask Continuum SAG/i,
    });
    fireEvent.change(textarea, {
      target: { value: "Check execution trace upsert" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    await act(async () => {
      emitEvent({
        event: "started",
        data: {
          runId: "run-trace-1",
          threadId: "thread-trace",
          userMessageId: "msg-u-trace",
        },
      });
      emitEvent({
        event: "step",
        data: {
          id: "tool-call-42",
          status: "running",
          kind: "tool",
          label: "Tìm trong kho tri thức",
          durationMs: 0,
        },
      });
    });

    expect(
      screen.getAllByText("Search project knowledge base"),
    ).toHaveLength(1);
    expect(screen.getByText("In progress…")).toBeVisible();

    await act(async () => {
      emitEvent({
        event: "step",
        data: {
          id: "tool-call-42",
          status: "completed",
          kind: "tool",
          label: "Tìm trong kho tri thức",
          durationMs: 420,
          count: 4,
        },
      });
    });

    expect(
      screen.getAllByText("Search project knowledge base"),
    ).toHaveLength(1);
    expect(screen.queryByText("In progress…")).not.toBeInTheDocument();
    expect(screen.getByText("420ms")).toBeVisible();
    expect(screen.getByText("4 items")).toBeVisible();

    await act(async () => {
      emitEvent({
        event: "completed",
        data: {
          messageId: "msg-a-trace",
          replyToMessageId: "msg-u-trace",
          content: "Verified answer.",
          answerStatus: "answered",
          citations: [],
          sessionCitations: [],
          retrievalSteps: [],
        },
      });
      finishStream();
    });

    expect(screen.getByText("Verified answer.")).toBeInTheDocument();
  });

  it("preserves completed execution trace steps in session memory when refetched empty-scope history omits steps", async () => {
    let serverItems: AiChatMessagePage["items"] = [];
    useMessagesInfiniteMock.mockImplementation(() => ({
      data: {
        pages: [{ items: serverItems, nextCursor: null, hasMore: false }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    }));

    createThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-empty-scope",
      title: "Empty scope trace",
      createdAt: "2026-10-30T10:05:00Z",
      updatedAt: "2026-10-30T10:05:00Z",
    });

    invalidateQueriesMock.mockImplementation(async () => {
      serverItems = [
        {
          id: "msg-u-empty",
          role: "user",
          content: "Summarize empty project",
          status: "ok",
          citations: [],
          sessionCitations: [],
          retrievalSteps: [],
          createdAt: "2026-10-30T10:05:01Z",
        },
        {
          id: "msg-a-empty",
          replyToMessageId: "msg-u-empty",
          role: "assistant",
          content:
            "[Answer hidden because its evidence is unavailable in the current source scope.]",
          status: "ok",
          citations: [],
          sessionCitations: [],
          retrievalSteps: [],
          createdAt: "2026-10-30T10:05:05Z",
        },
      ];
    });

    streamAiChatAskMock.mockImplementationOnce(
      async ({ onEvent }: { onEvent: (event: AiChatStreamEvent) => void }) => {
        onEvent({
          event: "started",
          data: {
            runId: "run-empty-1",
            threadId: "thread-empty-scope",
            userMessageId: "msg-u-empty",
          },
        });
        onEvent({
          event: "completed",
          data: {
            messageId: "msg-a-empty",
            replyToMessageId: "msg-u-empty",
            content: "No indexed docs.",
            answerStatus: "no_answer",
            citations: [],
            sessionCitations: [],
            retrievalSteps: [
              { kind: "thinking", label: "Reasoning", durationMs: 320 },
              {
                kind: "tool",
                label: "Tìm trong kho tri thức",
                durationMs: 45,
                count: 0,
              },
              { kind: "answer", label: "Answer Synthesis", durationMs: 290 },
            ],
          },
        });
      },
    );

    renderWorkspace();
    const textarea = screen.getByRole("textbox", {
      name: /Ask Continuum SAG/i,
    });
    fireEvent.change(textarea, {
      target: { value: "Summarize empty project" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    fireEvent.click(screen.getByRole("button", { name: /Processed/i }));
    expect(
      screen.getByText("Analyzing question & planning"),
    ).toBeVisible();
    expect(
      screen.getByText("Search project knowledge base"),
    ).toBeVisible();
    expect(
      screen.getByText("Synthesize & verify citations"),
    ).toBeVisible();
  });

  it("opens the composer project menu anchored at the composer instead of jumping to the top header", () => {
    useActiveProjectsMock.mockReturnValue({
      projects: [
        {
          id: "proj-core",
          organizationId: "org-1",
          name: "Continuum Core",
          code: "CORE",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "proj-fe",
          organizationId: "org-1",
          name: "Frontend Portal",
          code: "FE",
          visibility: "PUBLIC",
          status: "ACTIVE",
        },
        {
          id: "proj-be",
          organizationId: "org-1",
          name: "Backend Services",
          code: "BE",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "proj-docs",
          organizationId: "org-1",
          name: "Documentation",
          code: "DOC",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "proj-design",
          organizationId: "org-1",
          name: "Design System",
          code: "DESIGN",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "proj-db",
          organizationId: "org-1",
          name: "Database Cluster",
          code: "DB",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
      ],
      isLoading: false,
      isError: false,
    });

    renderWorkspace();

    const composerForm = screen.getByRole("form", {
      name: "SAG AI Chat composer",
    });
    const composerTrigger = within(composerForm).getByRole("button", {
      name: "Select project in composer",
    });
    const headerTrigger = screen.getByRole("button", {
      name: "Select project scope",
    });

    expect(composerTrigger).toHaveAttribute("aria-expanded", "false");
    expect(headerTrigger).toHaveAttribute("aria-expanded", "false");

    // Clicking the composer trigger opens ONLY the composer-anchored menu
    fireEvent.click(composerTrigger);

    const composerMenu = within(composerForm).getByTestId(
      "ai-chat-composer-project-menu",
    );
    expect(composerMenu).toBeInTheDocument();
    expect(composerMenu.className).toContain("bottom-11");
    expect(composerTrigger).toHaveAttribute("aria-expanded", "true");
    expect(headerTrigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("ai-chat-header-project-menu"),
    ).not.toBeInTheDocument();

    // Opening header project menu closes composer project menu (mutual exclusion)
    fireEvent.click(headerTrigger);
    expect(
      screen.getByTestId("ai-chat-header-project-menu"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-chat-composer-project-menu"),
    ).not.toBeInTheDocument();

    // Reopening composer project menu closes header project menu & supports >5 search + selection
    fireEvent.click(composerTrigger);
    const reopenedComposerMenu = within(composerForm).getByTestId(
      "ai-chat-composer-project-menu",
    );
    expect(
      screen.queryByTestId("ai-chat-header-project-menu"),
    ).not.toBeInTheDocument();

    const filterInput =
      within(reopenedComposerMenu).getByPlaceholderText("Filter projects…");
    fireEvent.change(filterInput, { target: { value: "zzz-none" } });
    expect(
      within(reopenedComposerMenu).getByText("No matching projects."),
    ).toBeInTheDocument();

    fireEvent.change(filterInput, { target: { value: "FE" } });
    fireEvent.click(
      within(reopenedComposerMenu).getByRole("option", {
        name: /Frontend Portal/i,
      }),
    );

    expect(replaceMock).toHaveBeenCalledWith("/ai-chat?projectId=proj-fe");
    expect(
      screen.queryByTestId("ai-chat-composer-project-menu"),
    ).not.toBeInTheDocument();
    expect(composerTrigger).toHaveTextContent("FE");

    // Pressing Enter in the composer filter input selects the match without submitting the chat form
    fireEvent.click(composerTrigger);
    expect(
      screen.getByTestId("ai-chat-composer-project-menu"),
    ).toBeInTheDocument();
    const filterOnReopen = within(
      screen.getByTestId("ai-chat-composer-project-menu"),
    ).getByPlaceholderText("Filter projects…");
    fireEvent.change(filterOnReopen, { target: { value: "Backend" } });
    fireEvent.keyDown(filterOnReopen, { key: "Enter" });
    expect(replaceMock).toHaveBeenCalledWith("/ai-chat?projectId=proj-be");
    expect(createThreadMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Escape closes the composer project menu
    fireEvent.click(composerTrigger);
    expect(
      screen.getByTestId("ai-chat-composer-project-menu"),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByTestId("ai-chat-composer-project-menu"),
    ).not.toBeInTheDocument();
  });

  it("branches from an assistant turn via More actions (⋯), switches to the new chat, shows toast, and navigates back to original", async () => {
    useMessagesInfiniteMock.mockImplementation(
      (_orgId: string, _projId: string, threadId: string | null) => ({
        data: {
          pages: [
            {
              items:
                threadId === "thread-branch-99"
                  ? [
                      {
                        id: "msg-u1",
                        role: "user",
                        content: "How does SAG isolate private projects?",
                        status: "ok",
                        citations: [],
                        sessionCitations: [],
                        retrievalSteps: [],
                        createdAt: "2026-10-28T10:00:00Z",
                        isInherited: true,
                      },
                      {
                        id: "msg-a1",
                        role: "assistant",
                        content: "Live ACL is checked per turn [1].",
                        status: "ok",
                        citations: [],
                        sessionCitations: [],
                        retrievalSteps: [],
                        createdAt: "2026-10-28T10:00:04Z",
                        replyToMessageId: "msg-u1",
                        isInherited: true,
                      },
                    ]
                  : threadId === "thread-1"
                    ? [
                        {
                          id: "msg-u1",
                          role: "user",
                          content: "How does SAG isolate private projects?",
                          status: "ok",
                          citations: [],
                          sessionCitations: [],
                          retrievalSteps: [],
                          createdAt: "2026-10-28T10:00:00Z",
                        },
                        {
                          id: "msg-a1",
                          role: "assistant",
                          content: "Live ACL is checked per turn [1].",
                          status: "ok",
                          citations: [],
                          sessionCitations: [],
                          retrievalSteps: [],
                          createdAt: "2026-10-28T10:00:04Z",
                          replyToMessageId: "msg-u1",
                        },
                      ]
                    : [],
              nextCursor: null,
              hasMore: false,
            } satisfies AiChatMessagePage,
          ],
        },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        refetch: vi.fn(),
      }),
    );

    branchThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-branch-99",
      title: "Branch · SAG BFF Security Review",
      createdAt: "2026-10-28T10:12:00Z",
      updatedAt: "2026-10-28T10:12:00Z",
      isBranched: true,
      parentThreadId: "thread-1",
      parentThreadTitle: "SAG BFF Security Review",
      branchPointMessageId: "msg-a1",
    } satisfies AiChatThread);

    renderWorkspace();

    // Open original thread-1
    fireEvent.click(
      screen.getByRole("button", { name: "SAG BFF Security Review" }),
    );
    expect(
      screen.getByText(/Live ACL is checked per turn/),
    ).toBeInTheDocument();

    // Click More actions (⋯) -> Branch in new chat
    fireEvent.click(screen.getByTestId("ai-chat-more-actions-msg-a1"));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Branch in new chat" }),
      );
    });

    expect(branchThreadMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
      messageId: "msg-a1",
    });

    // Switched to branched thread: sidebar shows branched row, toast appears, inline divider renders
    expect(
      screen.getByRole("button", { name: "Branch · SAG BFF Security Review" }),
    ).toBeInTheDocument();
    const toast = screen.getByTestId("ai-chat-branch-toast");
    expect(toast).toHaveTextContent("Branched in new chat");
    expect(
      screen.getByTestId("ai-chat-branch-divider"),
    ).toHaveTextContent("Branched from SAG BFF Security Review");

    // Clicking "View original" in the toast returns to parent thread-1
    fireEvent.click(
      within(toast).getByRole("button", { name: "View original" }),
    );
    expect(
      screen.queryByTestId("ai-chat-branch-divider"),
    ).not.toBeInTheDocument();
  });
});
