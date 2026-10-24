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
    screen.getByLabelText("Document file", { exact: false }),
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
  const moreActionsBtn = await screen.findByRole("button", {
    name: "More actions",
  });
  expect(moreActionsBtn).toBeVisible();
  fireEvent.click(moreActionsBtn);

  const archiveBtn = await screen.findByRole("button", { name: "Archive" });
  expect(archiveBtn).toBeVisible();
  fireEvent.click(archiveBtn);

  expect(await screen.findByText("Archive this document?")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

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
    screen.getByLabelText("Document file", { exact: false }),
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

it("displays inline field validation errors, supports drag-and-drop file selection, and prompts before discarding unsaved changes", async () => {
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(await screen.findByRole("button", { name: "New document" }));

  // Submit empty form -> shows summary alert + inline field errors for title and content/file
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Complete all required fields before saving.",
  );
  expect(screen.getByText("Enter a document title.")).toBeVisible();
  expect(
    screen.getByText(
      "Enter document content or attach a document file before saving.",
    ),
  ).toBeVisible();

  // Fill title -> dirty state is active
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Database Design v1" },
  });

  // Drop a valid Markdown (.md) file with empty browser MIME type onto the dropzone
  const dropzoneText = screen.getByText("Drag and drop your document here");
  const dropzone = dropzoneText.closest("div.border-dashed")!;
  fireEvent.drop(dropzone, {
    dataTransfer: {
      files: [
        new File(["# Database Schema\n\nTables and indexes."], "schema-design.md", {
          type: "",
        }),
      ],
    },
  });
  expect(await screen.findByText("schema-design.md")).toBeVisible();
  expect(screen.getByText("MD")).toBeVisible();
  expect(screen.getByText("Ready to upload")).toBeVisible();

  // Remove selected file
  fireEvent.click(screen.getByRole("button", { name: "Remove file" }));
  expect(screen.queryByText("schema-design.md")).not.toBeInTheDocument();

  // Click Cancel when dirty -> shows unsaved changes confirmation
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    await screen.findByText("You have unsaved changes. Discard this draft?"),
  ).toBeVisible();

  // Keep editing keeps the dialog open with the entered title
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Document title")).toHaveValue(
    "Database Design v1",
  );

  // Cancel again and confirm Discard -> closes dialog
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("renders the Leader review queue banner, row Review button, and Leader review decision panel for pending documents", async () => {
  let current: ProjectDocument = {
    ...document,
    status: "PENDING_REVIEW",
    permissions: {
      canCreate: true,
      canEdit: false,
      canSubmit: false,
      canReview: true,
      canConfigure: true,
    },
  };
  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [current],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}/comment`)) {
      current = {
        ...current,
        reviewComment: "Please verify section 2 before final approval.",
        reviewHistory: [
          {
            action: "PENDING_REVIEW",
            reviewerId: "64d000000000000000000004",
            comment: "Please verify section 2 before final approval.",
            at: "2026-04-08T12:00:00.000Z",
          },
        ],
      };
      return current as never;
    }
    if (path.endsWith(`/documents/${documentId}/approve`)) {
      current = {
        ...current,
        status: "APPROVED",
        permissions: { ...current.permissions, canReview: false },
      };
      return current as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return current as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  expect(
    await screen.findByText("1 document awaiting your Leader review"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Review" }));

  expect(await screen.findByText("Leader review decision")).toBeVisible();
  const sendCommentBtn = screen.getByRole("button", { name: "Send comment" });
  expect(sendCommentBtn).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Review comment", { exact: false }), {
    target: { value: "Please verify section 2 before final approval." },
  });
  expect(sendCommentBtn).toBeEnabled();
  fireEvent.click(sendCommentBtn);

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/comment`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          comment: "Please verify section 2 before final approval.",
        }),
      }),
    ),
  );
  expect(
    (
      await screen.findAllByText(
        "Please verify section 2 before final approval.",
      )
    ).length,
  ).toBeGreaterThanOrEqual(1);

  fireEvent.change(screen.getByLabelText("Review comment", { exact: false }), {
    target: { value: "Looks solid and ready for team reference." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/approve`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          comment: "Looks solid and ready for team reference.",
        }),
      }),
    ),
  );
  expect(await screen.findByText("Document workflow updated.")).toBeVisible();
});

it("renders the two-column Document Detail Modal with interactive version switching, review activity timeline, and attachment preview", async () => {
  const multiVersionDoc: ProjectDocument = {
    ...document,
    title: "Database Schema Specification",
    description: "",
    type: "DATABASE_DESIGN",
    version: 2,
    status: "APPROVED",
    submittedAt: "2026-10-24T10:00:00.000Z",
    reviewedBy: "951a2b3c4d5e6f7a8b9c0d99",
    reviewedAt: "2026-10-24T11:00:00.000Z",
    reviewComment: "Approved for production rollout.",
    permissions: {
      canCreate: true,
      canEdit: false,
      canSubmit: false,
      canReview: false,
      canConfigure: false,
    },
    file: {
      name: "schema-v2.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 131200,
    },
    versions: [
      {
        version: 1,
        status: "APPROVED",
        createdAt: "2026-10-23T09:00:00.000Z",
        editedBy: "851a2b3c4d5e6f7a8b9c0d21",
        content: "Initial v1 database schema.",
        file: {
          name: "schema-v1.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 65536,
        },
      },
      {
        version: 2,
        status: "APPROVED",
        createdAt: "2026-10-24T09:00:00.000Z",
        editedBy: "851a2b3c4d5e6f7a8b9c0d21",
        content: "Updated v2 database schema with indexes.",
        file: {
          name: "schema-v2.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 131200,
        },
      },
    ],
    reviewHistory: [
      {
        action: "APPROVED",
        reviewerId: "951a2b3c4d5e6f7a8b9c0d99",
        comment: "Approved for production rollout.",
        at: "2026-10-24T11:00:00.000Z",
      },
    ],
  };

  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [multiVersionDoc],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}`))
      return multiVersionDoc as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: multiVersionDoc.title }),
  );

  // Header eyebrow, metadata, and Read-only mode
  expect(
    await screen.findByText("Project Document / Database design"),
  ).toBeVisible();
  expect(await screen.findByText("Document information")).toBeVisible();
  expect(screen.getByText("No additional description.")).toBeVisible();
  expect(screen.getByText("Read-only document view")).toBeVisible();
  expect(screen.getByText("Latest approved version")).toBeVisible();
  expect(screen.getByText("Previous approved version")).toBeVisible();

  // Review activity timeline shows Submitted for review + Approved comment
  expect(screen.getByText("Review activity")).toBeVisible();
  expect(screen.getByText("Submitted for review")).toBeVisible();
  expect(screen.getByText("Approved for production rollout.")).toBeVisible();

  // Attachment Preview button shows binary preview notice for .docx
  expect(screen.getByText("schema-v2.docx")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(
    await screen.findByText(
      "Direct browser preview is not available for this binary document format. Use Download to open the file in its native application.",
    ),
  ).toBeVisible();

  // Interactive Version History: switch to Version 1
  fireEvent.click(screen.getByText("Version 1 · Approved"));
  expect(
    await screen.findByText("Viewing Version 1 (Approved)"),
  ).toBeVisible();
  expect(screen.getByText("Initial v1 database schema.")).toBeVisible();
  expect(screen.getByText("schema-v1.docx")).toBeVisible();

  // Return to latest version (v2)
  fireEvent.click(
    screen.getByRole("button", { name: "Return to latest (v2)" }),
  );
  expect(
    await screen.findByText("Updated v2 database schema with indexes."),
  ).toBeVisible();
});
