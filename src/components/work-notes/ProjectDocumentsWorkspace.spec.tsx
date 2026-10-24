import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import type { ProjectDocument } from "@/lib/queries/work-notes/useWorkNotes";
import ProjectDocumentsWorkspace from "./ProjectDocumentsWorkspace";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("./WorkNotesPageHeader", () => ({
  default: () => <header>Project Work Note navigation</header>,
}));

const api = vi.mocked(apiClient);
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const documentId = "751a2b3c4d5e6f7a8b9c0d21";
const document = {
  id: documentId,
  projectId,
  title: "Invitation API design",
  description: "Current API decisions",
  type: "API_SPECIFICATION" as const,
  version: 1,
  status: "DRAFT" as const,
  createdBy: "851a2b3c4d5e6f7a8b9c0d21",
  createdAt: "2026-10-24T09:00:00.000Z",
  updatedAt: "2026-10-24T09:00:00.000Z",
  permissions: { canCreate: true, canEdit: true, canSubmit: true, canReview: false, canConfigure: false },
  content: "Use an idempotent invitation command.",
  versions: [{ version: 1, status: "DRAFT" as const, createdAt: "2026-10-24T09:00:00.000Z", editedBy: "851a2b3c4d5e6f7a8b9c0d21" }],
  reviewHistory: [],
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectDocumentsWorkspace projectId={projectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.mockReset();
});

it("loads a Project Document and submits the server-permitted draft for review", async () => {
  let current: ProjectDocument = document;
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return { data: [current], pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 } } as never;
    }
    if (path.endsWith(`/documents/${documentId}/submit`)) {
      current = { ...current, status: "PENDING_REVIEW", permissions: { ...current.permissions, canSubmit: false } };
      return current as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return current as never;
    throw new Error(`Unexpected API request: ${options?.method ?? "GET"} ${path}`);
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: document.title }));
  expect(await screen.findByText(document.content)).toBeVisible();
  expect(screen.getByText("Version 1 · Draft")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

  await waitFor(() => expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/documents/${documentId}/submit`,
    expect.objectContaining({ method: "POST" }),
  ));
  expect(await screen.findByText("Document workflow updated.")).toBeVisible();
});
