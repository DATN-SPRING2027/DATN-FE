import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import TaskNotesPanel from "./TaskNotesPanel";

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

const api = vi.mocked(apiClient);
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const taskId = "851a2b3c4d5e6f7a8b9c0d21";
const note = {
  id: "751a2b3c4d5e6f7a8b9c0d21",
  projectId,
  taskId,
  authorId: "951a2b3c4d5e6f7a8b9c0d21",
  authorName: "Jordan Lee",
  type: "TASK_NOTE",
  status: "CONFIRMED",
  title: "Invitation endpoint",
  accomplishments: "Added the endpoint.",
  approach: "Used a transaction.",
  reason: "Prevent duplicates.",
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

function mount(customClient?: QueryClient, customTaskId = taskId) {
  const client =
    customClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <TaskNotesPanel projectId={projectId} taskId={customTaskId} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  api.mockReset();
});

it("keeps composer collapsed initially, creates a persisted structured note, and expands details on demand", async () => {
  let saved = false;
  api.mockImplementation(async (_path, options) => {
    if (options?.method === "POST") {
      saved = true;
      return note as never;
    }
    return {
      data: saved ? [note] : [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: saved ? 1 : 0,
        totalPages: saved ? 1 : 0,
      },
    } as never;
  });
  mount();

  expect(await screen.findByText("No task notes yet")).toBeVisible();
  expect(screen.getByText("0 notes")).toBeVisible();
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add first note" }));

  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: note.title },
  });
  fireEvent.change(screen.getByLabelText("What was done"), {
    target: { value: note.accomplishments },
  });
  fireEvent.change(screen.getByLabelText("How it was done"), {
    target: { value: note.approach },
  });
  fireEvent.change(screen.getByLabelText("Why this approach"), {
    target: { value: note.reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));

  expect(await screen.findByText("Task note saved.")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: note.title })).toBeVisible(),
  );
  expect(screen.getByText("1 note")).toBeVisible();
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

  // How / Why are collapsed until View details is clicked
  expect(screen.queryByText(note.approach)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View details" }));
  expect(screen.getByText(note.approach)).toBeVisible();
  expect(screen.getByText(note.reason)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
  expect(screen.queryByText(note.approach)).not.toBeInTheDocument();

  expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/tasks/${taskId}/notes`,
    expect.objectContaining({ method: "POST" }),
  );
});

it("shows internal AI Chat citation links and session references in note details", async () => {
  const sourcedNote = {
    ...note,
    contentMarkdown: "Decision recorded from the runbook [1] and context [S1].",
    aiChatSource: {
      threadId: "thread-1",
      messageId: "message-1",
      citations: [
        {
          number: 1,
          sourceLabel: "Runbook",
          documentId: "507f1f77bcf86cd799439088",
          documentName: "Architecture Runbook",
          heading: "Release process",
          pageFrom: 2,
          pageTo: 3,
        },
      ],
      sessionCitations: [{ ref: "S1", groupId: "group-1", turnIds: ["turn-1"] }],
    },
  };
  api.mockResolvedValue({
    data: [sourcedNote],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  } as never);
  mount();

  await screen.findByRole("heading", { name: note.title });
  expect(screen.queryByText("AI Chat sources")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View details" }));

  const sourceLink = await screen.findByRole("link", {
    name: "Architecture Runbook",
  });
  expect(sourceLink).toHaveAttribute(
    "href",
    `/projects/${projectId}/documents?documentId=507f1f77bcf86cd799439088`,
  );
  expect(screen.getByText("Conversation context")).toBeVisible();
});

it("edits and archives a permitted Task Note through the actions menu and API", async () => {
  let current = {
    ...note,
    permissions: { ...note.permissions, canEdit: true, canDelete: true },
  };
  let deleted = false;
  api.mockImplementation(async (_path, options) => {
    if (options?.method === "PATCH") {
      current = { ...current, title: "Corrected note" };
      return current as never;
    }
    if (options?.method === "DELETE") {
      deleted = true;
      return undefined as never;
    }
    return {
      data: deleted ? [] : [current],
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: deleted ? 0 : 1,
        totalPages: deleted ? 0 : 1,
      },
    } as never;
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mount();

  fireEvent.click(
    await screen.findByRole("button", {
      name: `More actions for ${note.title}`,
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Corrected note" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Corrected note" }),
    ).toBeVisible(),
  );

  // Open edit again, then archive the same note and verify the composer closes cleanly
  fireEvent.click(
    screen.getByRole("button", { name: "More actions for Corrected note" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Corrected note");

  fireEvent.click(
    screen.getByRole("button", { name: "More actions for Corrected note" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Corrected note" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/tasks/${taskId}/notes/${note.id}`,
    expect.objectContaining({ method: "PATCH" }),
  );
  expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/tasks/${taskId}/notes/${note.id}`,
    expect.objectContaining({ method: "DELETE" }),
  );
  vi.restoreAllMocks();
});

it("shows an archive error, clears stale success banners, and preserves the edited draft for retry", async () => {
  api.mockImplementation(async (_path, options) => {
    if (options?.method === "PATCH")
      return {
        ...note,
        permissions: { ...note.permissions, canEdit: true, canDelete: true },
      } as never;
    if (options?.method === "DELETE") throw new Error("Delete unavailable");
    return {
      data: [
        {
          ...note,
          permissions: { ...note.permissions, canEdit: true, canDelete: true },
        },
      ],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    } as never;
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mount();

  fireEvent.click(
    await screen.findByRole("button", {
      name: `More actions for ${note.title}`,
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  expect(await screen.findByText("Task note saved.")).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: `More actions for ${note.title}` }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  fireEvent.click(
    screen.getByRole("button", { name: `More actions for ${note.title}` }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Delete unavailable",
  );
  expect(screen.queryByText("Task note saved.")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Title")).toHaveValue(note.title);
  vi.restoreAllMocks();
});

it("preserves unsaved drafts across tab switches or modal close for the same taskId while isolating other tasks", async () => {
  api.mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
  } as never);

  const { client, unmount } = mount();
  fireEvent.click(await screen.findByRole("button", { name: "New note" }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Draft auth note" },
  });
  fireEvent.change(screen.getByLabelText("What was done"), {
    target: { value: "In-progress work" },
  });

  // Unmount (simulating switching Activity tabs or closing the modal)
  unmount();

  // Mounting a different taskId starts with a collapsed composer
  const otherTaskView = mount(client, "111122223333444455556666");
  expect(await screen.findByText("No task notes yet")).toBeVisible();
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  otherTaskView.unmount();

  // Remounting the original taskId restores the open composer and draft text
  mount(client, taskId);
  expect(await screen.findByLabelText("Title")).toHaveValue("Draft auth note");
  expect(screen.getByLabelText("What was done")).toHaveValue("In-progress work");
  expect(screen.getByText("Unsaved draft")).toBeVisible();
});

it("delegates New note and Edit to splitControl without opening a modal when hosted in split-screen mode", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_EDITOR_ENABLED", "true");
  try {
    const editableNote = {
      ...note,
      permissions: { ...note.permissions, canEdit: true },
    };
    api.mockResolvedValue({
      data: [editableNote],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    } as never);

    const onOpen = vi.fn();
    const onClose = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <TaskNotesPanel
            projectId={projectId}
            taskId={taskId}
            splitControl={{
              isOpen: false,
              editingNoteId: null,
              savedSignal: 0,
              onOpen,
              onClose,
            }}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: editableNote.title });

    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    expect(onOpen).toHaveBeenCalledWith(undefined);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `More actions for ${editableNote.title}`,
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onOpen).toHaveBeenCalledWith(editableNote.id);

    rerender(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <TaskNotesPanel
            projectId={projectId}
            taskId={taskId}
            splitControl={{
              isOpen: true,
              editingNoteId: editableNote.id,
              savedSignal: 1,
              onOpen,
              onClose,
            }}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Editing")).toBeVisible();
    expect(await screen.findByText("Task note saved.")).toBeVisible();
  } finally {
    vi.unstubAllEnvs();
  }
});
