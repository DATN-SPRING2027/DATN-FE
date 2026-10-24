import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import TaskNotesPanel from "./TaskNotesPanel";

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
  permissions: { canCreate: true, canEdit: false, canSubmit: false, canReview: false, canConfigure: false },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <TaskNotesPanel projectId={projectId} taskId={taskId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.mockReset();
});

it("creates a persisted structured note for the current Task and refreshes the list", async () => {
  let saved = false;
  api.mockImplementation(async (path, options) => {
    if (options?.method === "POST") {
      saved = true;
      return note as never;
    }
    return { data: saved ? [note] : [], pagination: { page: 1, pageSize: 100, totalItems: saved ? 1 : 0, totalPages: saved ? 1 : 0 } } as never;
  });
  mount();

  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: note.title } });
  fireEvent.change(screen.getByLabelText("What was done"), { target: { value: note.accomplishments } });
  fireEvent.change(screen.getByLabelText("How it was done"), { target: { value: note.approach } });
  fireEvent.change(screen.getByLabelText("Why this approach"), { target: { value: note.reason } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));

  expect(await screen.findByText("Task note saved.")).toBeVisible();
  await waitFor(() => expect(screen.getByRole("heading", { name: note.title })).toBeVisible());
  expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/tasks/${taskId}/notes`,
    expect.objectContaining({ method: "POST" }),
  );
});
