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
  permissions: {
    canCreate: true,
    canEdit: true,
    canSubmit: true,
    canReview: false,
    canConfigure: false,
  },
  content: "Use an idempotent invitation command.",
  versions: [
    {
      version: 1,
      status: "DRAFT" as const,
      createdAt: "2026-10-24T09:00:00.000Z",
      editedBy: "851a2b3c4d5e6f7a8b9c0d21",
    },
  ],
  reviewHistory: [],
};

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
      return {
        data: [current],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}/submit`)) {
      current = {
        ...current,
        status: "PENDING_REVIEW",
        permissions: { ...current.permissions, canSubmit: false },
      };
      return current as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return current as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: document.title }));
  expect(await screen.findByText(document.content)).toBeVisible();
  expect(screen.getByText("Version 1 · Draft")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/submit`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(await screen.findByText("Document workflow updated.")).toBeVisible();
});

it("hides the create action when project access is denied", async () => {
  api.mockRejectedValue(new Error("Project not found."));

  mount();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Project not found.",
  );
  expect(
    screen.queryByRole("button", { name: "New document" }),
  ).not.toBeInTheDocument();
});

it("keeps the created draft editor open with the selected file when its upload fails, and succeeds on retry", async () => {
  let uploadCalls = 0;
  let uploadedFile: ProjectDocument | null = null;
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: uploadedFile ? [uploadedFile] : [],
        pagination: {
          page: 1,
          pageSize: 50,
          totalItems: uploadedFile ? 1 : 0,
          totalPages: uploadedFile ? 1 : 0,
        },
      } as never;
    }
    if (path.endsWith("/documents") && options?.method === "POST") {
      const input = JSON.parse(String(options.body)) as {
        title: string;
        content: string;
      };
      return {
        ...document,
        title: input.title,
        content: input.content,
      } as never;
    }
    if (
      path.endsWith(`/documents/${documentId}`) &&
      options?.method === "PATCH"
    ) {
      const input = JSON.parse(String(options.body)) as {
        title: string;
        content: string;
      };
      return {
        ...document,
        title: input.title,
        content: input.content,
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}/file`)) {
      uploadCalls += 1;
      if (uploadCalls === 1) throw new Error("Upload failed");
      uploadedFile = {
        ...document,
        title: "Architecture draft",
        content: "Saved text draft",
        file: {
          name: "architecture.pdf",
          contentType: "application/pdf",
          size: 8,
        },
      };
      return uploadedFile as never;
    }
    if (path.endsWith(`/documents/${documentId}`))
      return (uploadedFile ?? document) as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: "New document" }));
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Architecture draft" },
  });
  fireEvent.change(screen.getByLabelText("Document content"), {
    target: { value: "Saved text draft" },
  });
  fireEvent.change(
    screen.getByLabelText("PDF or DOCX file (up to 20 MB)", { exact: false }),
    {
      target: {
        files: [
          new File(["%PDF-1.4"], "architecture.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  expect(screen.getByRole("button", { name: "Save draft" })).toBeVisible();
  expect(screen.getByLabelText("Document title")).toHaveValue(
    "Architecture draft",
  );
  expect(screen.getByLabelText("Document content")).toHaveValue(
    "Saved text draft",
  );
  expect(screen.getByText("architecture.pdf")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(uploadCalls).toBe(2));
});

it("allows archiving a document with an approved version even when a newer version is in draft", async () => {
  const mixedDoc: ProjectDocument = {
    ...document,
    version: 2,
    status: "DRAFT",
    permissions: {
      ...document.permissions,
      canConfigure: true,
      canReview: true,
    },
    versions: [
      {
        version: 1,
        status: "APPROVED",
        createdAt: "2026-10-24T08:00:00.000Z",
        editedBy: "851a2b3c4d5e6f7a8b9c0d21",
      },
      {
        version: 2,
        status: "DRAFT",
        createdAt: "2026-10-24T09:00:00.000Z",
        editedBy: "851a2b3c4d5e6f7a8b9c0d21",
      },
    ],
  };
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [mixedDoc],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}/archive`)) {
      return { ...mixedDoc, status: "ARCHIVED" } as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return mixedDoc as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: mixedDoc.title }));
  const archiveBtn = await screen.findByRole("button", { name: "Archive" });
  expect(archiveBtn).toBeVisible();
  fireEvent.click(archiveBtn);
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/archive`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
});

it("clears stale upload errors before retrying document updates and clears action status on validation error", async () => {
  let patchCalls = 0;
  const reviewableDoc: ProjectDocument = {
    ...document,
    status: "PENDING_REVIEW",
    permissions: {
      ...document.permissions,
      canSubmit: true,
      canReview: true,
    },
  };
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [reviewableDoc],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith("/documents") && options?.method === "POST") {
      return document as never;
    }
    if (
      path.endsWith(`/documents/${documentId}`) &&
      options?.method === "PATCH"
    ) {
      patchCalls += 1;
      throw new Error("Update failed");
    }
    if (path.endsWith(`/documents/${documentId}/file`)) {
      throw new Error("Upload failed");
    }
    if (path.endsWith(`/documents/${documentId}/submit`)) {
      return reviewableDoc as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return reviewableDoc as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: "New document" }));
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Architecture draft" },
  });
  fireEvent.change(screen.getByLabelText("Document content"), {
    target: { value: "Saved text draft" },
  });
  fireEvent.change(
    screen.getByLabelText("PDF or DOCX file (up to 20 MB)", { exact: false }),
    {
      target: {
        files: [
          new File(["%PDF-1.4"], "architecture.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");

  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(patchCalls).toBe(1));
  expect(await screen.findByRole("alert")).toHaveTextContent("Update failed");
});
