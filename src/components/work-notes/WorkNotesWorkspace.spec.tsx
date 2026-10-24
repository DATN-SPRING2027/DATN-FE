import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import WorkNotesWorkspace from "./WorkNotesWorkspace";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("./WorkNotesPageHeader", () => ({
  default: ({ active }: { active: string }) => <header data-testid="work-notes-header">{active}</header>,
}));

const api = vi.mocked(apiClient);
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const note = {
  id: "751a2b3c4d5e6f7a8b9c0d21",
  projectId,
  taskId: "851a2b3c4d5e6f7a8b9c0d21",
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
  permissions: { canCreate: true, canEdit: false, canSubmit: false, canReview: false, canConfigure: false },
};

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

  it("loads persisted Task Notes from the project-scoped API", async () => {
    api.mockResolvedValue({ data: [note], pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 } });
    mount();

    expect(await screen.findByRole("heading", { name: "Invitation endpoint" })).toBeVisible();
    expect(screen.getByText("Added the API route.")).toBeVisible();
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-notes?page=1&pageSize=50`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows a server failure and can retry the API request", async () => {
    api.mockRejectedValueOnce(new Error("Capture service unavailable"));
    api.mockResolvedValueOnce({ data: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 } });
    mount();

    expect(await screen.findByRole("alert")).toHaveTextContent("Capture service unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("No task notes in this project")).toBeVisible());
    expect(api).toHaveBeenCalledTimes(2);
  });
});
