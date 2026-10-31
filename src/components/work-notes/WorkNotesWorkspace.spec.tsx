import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError, apiClient } from "@/lib/api-client";
import WorkNotesWorkspace from "./WorkNotesWorkspace";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

vi.mock("./WorkNotesPageHeader", () => ({
  default: ({ active }: { active: string }) => (
    <header data-testid="work-notes-header">{active}</header>
  ),
}));

const api = vi.mocked(apiClient);
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const note = {
  id: "751a2b3c4d5e6f7a8b9c0d21",
  projectId,
  taskId: "851a2b3c4d5e6f7a8b9c0d21",
  taskKey: "FE-12",
  taskTitle: "Authentication & session handling",
  authorId: "951a2b3c4d5e6f7a8b9c0d21",
  authorName: "Jordan Lee",
  type: "TASK_NOTE" as const,
  status: "CONFIRMED" as const,
  title: "Invitation endpoint",
  accomplishments: "Added the API route.",
  approach: "Used a transaction with an outbox.",
  reason: "Avoid duplicate invitations.",
  createdAt: "2026-10-24T09:00:00.000Z",
  updatedAt: "2026-10-24T09:00:00.000Z",
  permissions: {
    canCreate: true,
    canEdit: false,
    canSubmit: false,
    canReview: false,
    canConfigure: false,
  },
};

const secondNote = {
  id: "751a2b3c4d5e6f7a8b9c0d22",
  projectId,
  taskId: "851a2b3c4d5e6f7a8b9c0d22",
  taskKey: "FE-08",
  taskTitle: "Dashboard navigation",
  authorId: "951a2b3c4d5e6f7a8b9c0d22",
  authorName: "Alex Rivera",
  type: "TASK_NOTE" as const,
  status: "CONFIRMED" as const,
  title: "Refactored sidebar navigation",
  accomplishments: "Simplified navigation state and active menu highlighting.",
  approach: "Consolidated route matching in sidebar navigation hook.",
  reason: "Eliminate duplicate active state calculations.",
  createdAt: "2026-10-23T16:20:00.000Z",
  updatedAt: "2026-10-23T16:20:00.000Z",
  permissions: {
    canCreate: true,
    canEdit: false,
    canSubmit: false,
    canReview: false,
    canConfigure: false,
  },
};

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkNotesWorkspace projectId={projectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("Project task notes", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("loads persisted Task Notes in compact explorer mode and expands details on demand", async () => {
    api.mockResolvedValue({
      data: [note],
      pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    });
    mount();

    expect(
      await screen.findByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();
    expect(screen.getByText("Added the API route.")).toBeVisible();
    expect(screen.getByText("FE-12")).toBeVisible();
    expect(
      screen.getByText("Authentication & session handling"),
    ).toBeVisible();
    expect(screen.getByText("Linked to task FE-12")).toBeVisible();
    expect(
      screen.queryByText("Used a transaction with an outbox."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(
      screen.getByText("Used a transaction with an outbox."),
    ).toBeVisible();
    expect(screen.getByText("Avoid duplicate invitations.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(
      screen.queryByText("Used a transaction with an outbox."),
    ).not.toBeInTheDocument();

    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-notes?page=1&pageSize=50`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("filters notes by search, task, and author and supports resetting filters", async () => {
    api.mockResolvedValue({
      data: [note, secondNote],
      pagination: { page: 1, pageSize: 50, totalItems: 2, totalPages: 1 },
    });
    mount();

    expect(
      await screen.findByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Refactored sidebar navigation" }),
    ).toBeVisible();
    expect(screen.getByText("2 notes across 2 tasks")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Filter by task"), {
      target: { value: secondNote.taskId },
    });
    expect(
      screen.queryByRole("heading", { name: "Invitation endpoint" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Refactored sidebar navigation" }),
    ).toBeVisible();
    expect(screen.getByText("1 note across 1 task")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(
      screen.getByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Filter by author"), {
      target: { value: note.authorId },
    });
    expect(
      screen.getByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Refactored sidebar navigation" }),
    ).not.toBeInTheDocument();
  });

  it("shows a server failure and can retry the API request", async () => {
    api.mockRejectedValueOnce(new Error("Capture service unavailable"));
    api.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
    });
    mount();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Capture service unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByText("No task notes in this project")).toBeVisible(),
    );
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("loads a Task Note from a notification deep link", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, search: `?noteId=${note.id}` },
    });
    const emptyPage = {
      data: [],
      pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
    };
    api.mockImplementation((async (path: string) =>
      path.endsWith(`/work-notes/${note.id}`) ? note : emptyPage) as never);

    try {
      const view = mount();

      expect(
        await screen.findByRole("heading", { name: "Invitation endpoint" }),
      ).toBeVisible();
      expect(
        screen.getByText("Used a transaction with an outbox."),
      ).toBeVisible();
      expect(api).toHaveBeenCalledWith(
        `/capture/projects/${projectId}/work-notes/${note.id}`,
        expect.objectContaining({ cache: "no-store" }),
      );
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, search: "?noteId=invalid" },
      });
      // Next navigation updates search params without a popstate event.
      view.rerender(
        <QueryClientProvider client={new QueryClient()}>
          <NextIntlClientProvider locale="en" messages={messages}>
            <WorkNotesWorkspace projectId={projectId} />
          </NextIntlClientProvider>
        </QueryClientProvider>,
      );
      expect(
        await screen.findByTestId("work-note-unavailable-banner"),
      ).toBeVisible();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("shows the safe unavailable state when the linked Task Note was removed", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, search: `?noteId=${note.id}` },
    });
    const emptyPage = {
      data: [],
      pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
    };
    api.mockImplementation((async (path: string) =>
      path.endsWith(`/work-notes/${note.id}`)
        ? Promise.reject(new ApiError(404, "TASK_NOTE_NOT_FOUND", "not found"))
        : emptyPage) as never);

    try {
      mount();

      expect(
        await screen.findByTestId("work-note-unavailable-banner"),
      ).toHaveTextContent("Content is no longer available.");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("searches canonical v2 Task Notes without crashing when legacy v1 fields are omitted", async () => {
    const v2NoteWithoutLegacyFields = {
      id: "751a2b3c4d5e6f7a8b9c0d99",
      projectId,
      taskId: "851a2b3c4d5e6f7a8b9c0d99",
      taskKey: "BE-42",
      taskTitle: "Session revocation",
      authorId: "951a2b3c4d5e6f7a8b9c0d21",
      authorName: "Jordan Lee",
      type: "TASK_NOTE" as const,
      status: "CONFIRMED" as const,
      title: "Redis rate-limit notes",
      contentSchemaVersion: 2 as const,
      contentMarkdown: "Verified sliding-window counter with userFence.",
      createdAt: "2026-10-25T10:00:00.000Z",
      updatedAt: "2026-10-25T10:00:00.000Z",
      permissions: note.permissions,
    };

    api.mockResolvedValue({
      data: [v2NoteWithoutLegacyFields, secondNote],
      pagination: { page: 1, pageSize: 50, totalItems: 2, totalPages: 1 },
    });

    mount();
    expect(
      await screen.findByRole("heading", { name: "Redis rate-limit notes" }),
    ).toBeVisible();

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "userFence" } });

    expect(
      screen.getByRole("heading", { name: "Redis rate-limit notes" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Refactored sidebar navigation" }),
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "nonexistent-needle" } });
    expect(
      screen.queryByRole("heading", { name: "Redis rate-limit notes" }),
    ).not.toBeInTheDocument();
  });
});
