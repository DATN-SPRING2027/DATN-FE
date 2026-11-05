import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError, apiClient } from "@/lib/api-client";
import type { TaskNote } from "@/lib/queries/work-notes/useWorkNotes";
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

  it("loads persisted Task Notes in the Task-Grouped Split Workbench and switches between task groups and timeline", async () => {
    api.mockResolvedValue({
      data: [note],
      pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    });
    mount();

    expect(
      await screen.findByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();
    expect(screen.getAllByText("Added the API route.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FE-12").length).toBeGreaterThan(0);

    expect(
      screen.getAllByText("Authentication & session handling").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /FE-12/ })).toHaveAttribute(
      "href",
      `/projects/${projectId}/work/FE-12`,
    );
    expect(screen.queryByText("Linked to task FE-12")).not.toBeInTheDocument();
    expect(
      screen.getByText("Used a transaction with an outbox."),
    ).toBeVisible();
    expect(screen.getByText("Avoid duplicate invitations.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    expect(
      screen.getByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Group by task" }));
    expect(
      screen.getByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();

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

  it("enforces post-approval .md & SAG governance: hides Download .md while PENDING_REVIEW and shows Download .md + SAG chunks once APPROVED", async () => {
    let currentNote = {
      ...note,
      contentSchemaVersion: 2 as const,
      contentMarkdown: "## Token Validation\n\nVerified JWT signature rotation.",
      reviewStatus: "PENDING_REVIEW" as const,
      permissions: {
        ...note.permissions,
        canReview: true,
      },
    };

    api.mockImplementation((async (path: string, options?: RequestInit) => {
      if (path.endsWith("/work-notes?page=1&pageSize=50")) {
        return {
          data: [currentNote],
          pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        };
      }
      if (
        options?.method === "POST" &&
        path.endsWith(`/work-notes/${note.id}/approve`)
      ) {
        currentNote = {
          ...currentNote,
          reviewStatus: "APPROVED" as unknown as "PENDING_REVIEW",
          file: {
            name: "task-note-fe-12-invitation-endpoint-v1.md",
            contentType: "text/markdown",
            size: 512,
            sha256: "a".repeat(64),
          },
          knowledgeSync: {
            documentId: note.id,
            version: 1,
            status: "KNOWLEDGE_READY",
            knowledgeReady: true,
            searchReady: true,
            progress: 100,
            chunkCount: 2,
          },
        } as typeof currentNote;
        return currentNote;
      }
      if (path.endsWith(`/work-notes/${note.id}/knowledge-status`)) {
        return {
          documentId: note.id,
          version: 1,
          status: "KNOWLEDGE_READY",
          knowledgeReady: true,
          searchReady: true,
          progress: 100,
          chunkCount: 2,
        };
      }
      if (path.includes(`/work-notes/${note.id}/knowledge-chunks`)) {
        return {
          documentId: note.id,
          version: 1,
          sourceStage: "SEARCH_UNITS",
          totalChunks: 2,
          totalTokens: 84,
          items: [
            {
              chunkId: "chunk-1",
              ordinal: 1,
              sectionPath: "Token Validation",
              blockType: "paragraph",
              pageFrom: 0,
              pageTo: 0,
              tokenCount: 42,
              content: "Verified JWT signature rotation.",
            },
          ],
        };
      }
      throw new Error(`Unexpected request: ${options?.method ?? "GET"} ${path}`);
    }) as never);

    mount();
    expect(
      await screen.findByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();

    // Open Review & SAG modal while PENDING_REVIEW -> NO Download .md button & NO fake SAG stepper!
    fireEvent.click(screen.getByRole("button", { name: "Review & SAG" }));
    const drawer = await screen.findByTestId("knowledge-governance-drawer");
    expect(
      within(drawer).getByText(/Stored in database only/i),
    ).toBeVisible();
    expect(
      screen.getByText("Cloudflare R2 & SAG Governance Gate"),
    ).toBeVisible();
    expect(screen.queryByText("Parse .md")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Download \.md/i }),
    ).not.toBeInTheDocument();
    // Rich Markdown renders `## Token Validation` as an actual heading!
    expect(
      screen.getByRole("heading", { name: "Token Validation" }),
    ).toBeVisible();

    // Approve inside modal -> transitions to APPROVED, reveals Download .md + 4-stage SAG + Chunks!
    fireEvent.click(
      screen.getByRole("button", { name: "Approve & Sync SAG" }),
    );

    expect(
      (await screen.findAllByRole("button", { name: /Download \.md/i }))[0],
    ).toBeVisible();
    expect(
      await screen.findByText("task-note-fe-12-invitation-endpoint-v1.md"),
    ).toBeVisible();
    expect(screen.getByText("Parse .md")).toBeVisible();
    const chunksSection = await screen.findByLabelText("Extracted chunks");
    expect(within(chunksSection).getByText("Token Validation")).toBeVisible();
  });

  it("supports SAG pause/resume/revoke, tiered R2 purge + reopen, and bulk batch approval", async () => {
    const secondNote = {
      ...note,
      id: "751a2b3c4d5e6f7a8b9c0d99",
      title: "Outbox consumer retry policy",
      reviewStatus: "PENDING_REVIEW" as const,
      permissions: {
        ...note.permissions,
        canReview: true,
        canControlKnowledge: true,
        canPurgeArtifact: true,
        canDelete: true,
      },
    };
    let firstNote: TaskNote = {
      ...note,
      reviewStatus: "PENDING_REVIEW",
      permissions: {
        ...note.permissions,
        canReview: true,
        canControlKnowledge: true,
        canPurgeArtifact: true,
        canDelete: true,
      },
    };
    let listItems: TaskNote[] = [firstNote, secondNote];
    const calledPaths: Array<{ method: string; path: string; body?: string }> = [];

    api.mockImplementation((async (path: string, options?: RequestInit) => {
      calledPaths.push({
        method: options?.method ?? "GET",
        path,
        body: typeof options?.body === "string" ? options.body : undefined,
      });

      if (path.endsWith("/work-notes?page=1&pageSize=50")) {
        return {
          data: listItems,
          pagination: {
            page: 1,
            pageSize: 50,
            totalItems: listItems.length,
            totalPages: 1,
          },
        };
      }

      if (
        options?.method === "POST" &&
        path.endsWith("/work-notes/bulk-action")
      ) {
        firstNote = {
          ...firstNote,
          reviewStatus: "APPROVED",
          file: {
            name: "task-note-fe-12-invitation-endpoint-v1.md",
            contentType: "text/markdown",
            size: 640,
            sha256: "c".repeat(64),
          },
          storageReference: {
            provider: "CLOUDFLARE_R2",
            objectCount: 1,
            deletableObjectCount: 1,
            sharedObjectCount: 0,
            refCount: 1,
            externalDocumentRefs: 0,
            willDeleteFromStorage: true,
          },
          knowledgeSync: {
            documentId: firstNote.id,
            sagDocumentId: "sag-doc-1",
            version: 1,
            status: "INDEXING",
            currentStage: "EXTRACT",
            progress: 60,
            chunkCount: 0,
          },
        };
        listItems = [
          firstNote,
          {
            ...secondNote,
            reviewStatus: "APPROVED",
          },
        ];
        return {
          action: "APPROVE",
          requestedCount: 2,
          succeededIds: [firstNote.id, secondNote.id],
          failed: [],
        };
      }

      if (path.endsWith(`/work-notes/${firstNote.id}/knowledge-status`)) {
        return firstNote.knowledgeSync;
      }

      if (
        options?.method === "POST" &&
        path.endsWith(`/work-notes/${firstNote.id}/knowledge-control`)
      ) {
        const parsed = JSON.parse(String(options.body ?? "{}")) as {
          action?: string;
        };
        const nextStatus =
          parsed.action === "PAUSE"
            ? {
                documentId: firstNote.id,
                sagDocumentId: "sag-doc-1",
                version: 1,
                status: "PAUSED",
                currentStage: "EXTRACT",
                progress: 60,
              }
            : {
                documentId: firstNote.id,
                sagDocumentId: "sag-doc-1",
                version: 1,
                status: "INDEXING",
                currentStage: "EXTRACT",
                progress: 60,
              };
        firstNote = { ...firstNote, knowledgeSync: nextStatus } as typeof firstNote;
        listItems = [firstNote, listItems[1]!];
        return nextStatus;
      }

      if (
        options?.method === "DELETE" &&
        path.includes(`/work-notes/${firstNote.id}/file`)
      ) {
        firstNote = {
          ...firstNote,
          reviewStatus: "CHANGES_REQUESTED",
          file: undefined,
        };
        listItems = [firstNote, listItems[1]!];
        return {
          entityId: firstNote.id,
          purgedFromR2: true,
          retainedSharedR2: false,
          revokedSag: true,
          status: "CHANGES_REQUESTED",
        };
      }

      throw new Error(`Unexpected request: ${options?.method ?? "GET"} ${path}`);
    }) as never);

    mount();
    expect(
      await screen.findByRole("heading", { name: "Invitation endpoint" }),
    ).toBeVisible();

    // Select all -> triggers sticky BulkGovernanceBar -> batch approve 2 notes!
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    const bulkApproveBtn = await screen.findByRole("button", {
      name: "Approve & Sync (2)",
    });
    fireEvent.click(bulkApproveBtn);

    expect(
      await screen.findByText("Processed 2/2 items successfully."),
    ).toBeVisible();
    expect(
      calledPaths.some(
        (c) => c.method === "POST" && c.path.endsWith("/work-notes/bulk-action"),
      ),
    ).toBe(true);

    // Open approved note modal -> Pause -> Resume -> R2 & Remove… -> Purge R2 & Reopen
    const inspectButtons = await screen.findAllByRole("button", {
      name: "Inspect .md & SAG",
    });
    fireEvent.click(inspectButtons[0]!);

    const pauseBtn = await screen.findByRole("button", { name: "Pause" });
    fireEvent.click(pauseBtn);

    const resumeBtn = await screen.findByRole("button", { name: "Resume" });
    fireEvent.click(resumeBtn);

    fireEvent.click(await screen.findByRole("button", { name: "R2 & Remove…" }));
    expect(
      await screen.findByText("Manage SAG Index, Cloudflare R2 & Record"),
    ).toBeVisible();

    fireEvent.click(
      screen.getByLabelText(
        "Also reopen for author editing (move status to Changes Requested)",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Purge R2 & Reopen" }));

    await waitFor(() => {
      expect(
        calledPaths.some(
          (c) =>
            c.method === "DELETE" &&
            c.path.includes(`/work-notes/${firstNote.id}/file?reopen=true`),
        ),
      ).toBe(true);
    });
  });

  it("renders SectionOutlineBar and clamps >18-line code blocks for long Markdown notes while hiding outline on short notes", async () => {
    const codeLines = Array.from(
      { length: 24 },
      (_, idx) => `const step${idx + 1} = verifyToken(${idx + 1});`,
    ).join("\n");
    const longMarkdownNote: TaskNote = {
      ...note,
      id: "751a2b3c4d5e6f7a8b9c0d88",
      title: "Architecture & SAG Outbox Deep Dive",
      contentSchemaVersion: 2,
      contentMarkdown: [
        "## 1. Context & Problem",
        "High-volume markdown ingestion requires strict approval gating.",
        "## 2. Outbox Transaction Design",
        "```ts",
        codeLines,
        "```",
        "## 3. Benchmarks & Rollout",
        "Latency stayed below 40ms p99.",
      ].join("\n\n"),
    };

    api.mockResolvedValue({
      data: [longMarkdownNote, secondNote],
      pagination: { page: 1, pageSize: 50, totalItems: 2, totalPages: 1 },
    });

    mount();
    expect(
      await screen.findByRole("heading", {
        name: "Architecture & SAG Outbox Deep Dive",
      }),
    ).toBeVisible();

    const outlineNav = screen.getByTestId("section-outline-bar");
    expect(outlineNav).toBeVisible();
    expect(
      within(outlineNav).getByRole("button", { name: "1. Context & Problem" }),
    ).toBeVisible();
    expect(
      within(outlineNav).getByRole("button", { name: "3. Benchmarks & Rollout" }),
    ).toBeVisible();

    const expandCodeBtn = screen.getByRole("button", {
      name: "Show all 26 lines",
    });
    expect(expandCodeBtn).toBeVisible();
    fireEvent.click(expandCodeBtn);
    expect(
      screen.getByRole("button", { name: "Collapse code" }),
    ).toBeVisible();

    // Selecting the short legacy note hides SectionOutlineBar cleanly
    fireEvent.click(
      screen.getByRole("heading", { name: "Refactored sidebar navigation" }),
    );
    expect(screen.queryByTestId("section-outline-bar")).not.toBeInTheDocument();

    // Resizable split column supports keyboard resize and double-click reset
    const resizer = screen.getByTestId("split-workbench-resizer");
    expect(resizer).toHaveAttribute("aria-valuenow", "360");
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
    expect(resizer).toHaveAttribute("aria-valuenow", "376");
    fireEvent.doubleClick(resizer);
    expect(resizer).toHaveAttribute("aria-valuenow", "360");
  });
});
