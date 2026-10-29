import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
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
  useMessagesInfiniteMock,
  streamAiChatAskMock,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
  useActiveProjectsMock: vi.fn(),
  useThreadsMock: vi.fn(),
  createThreadMutateAsync: vi.fn(),
  updateThreadMutateAsync: vi.fn(),
  deleteThreadMutateAsync: vi.fn(),
  useMessagesInfiniteMock: vi.fn(),
  streamAiChatAskMock: vi.fn(),
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
  useAiChatMessagesInfiniteQuery: (...args: unknown[]) =>
    useMessagesInfiniteMock(...args),
}));

vi.mock("@/lib/queries/ai-chat/ai-chat-stream", () => ({
  streamAiChatAsk: (...args: unknown[]) => streamAiChatAskMock(...args),
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
  });

  it("renders ChatGPT-style hero ('Ready when you are.'), Chat | Work pill, and auto-selects first ACTIVE project without 'All Projects'", () => {
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

    // Switch Chat -> Work mode updates hero heading
    const workButtons = screen.getAllByRole("button", { name: "Work" });
    fireEvent.click(workButtons[0]!);
    expect(
      screen.getByRole("heading", { name: "Ready to synthesize CORE." }),
    ).toBeInTheDocument();
  });

  it("creates a thread on first question, docks composer, streams SAG delta chunks, and renders verified [1] & [S1] citations", async () => {
    createThreadMutateAsync.mockResolvedValueOnce({
      id: "thread-new",
      title: "New chat",
      createdAt: "2026-10-28T11:00:00Z",
      updatedAt: "2026-10-28T11:00:00Z",
    } satisfies AiChatThread);

    streamAiChatAskMock.mockImplementationOnce(
      async ({
        onEvent,
      }: {
        onEvent: (event: AiChatStreamEvent) => void;
      }) => {
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
});
