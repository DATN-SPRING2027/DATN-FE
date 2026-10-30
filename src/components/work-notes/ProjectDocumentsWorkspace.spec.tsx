import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import type {
  DocumentKnowledgeChunksResponse,
  DocumentKnowledgeStatus,
  ProjectDocument,
} from "@/lib/queries/work-notes/useWorkNotes";
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
const document: ProjectDocument = {
  id: documentId,
  projectId,
  title: "Invitation API design",
  description: "Current API decisions",
  type: "OTHER",
  version: 1,
  status: "DRAFT",
  createdBy: "851a2b3c4d5e6f7a8b9c0d21",
  createdAt: "2026-10-24T09:00:00.000Z",
  updatedAt: "2026-10-24T09:00:00.000Z",
  file: {
    name: "invitation-api-design.pdf",
    contentType: "application/pdf",
    size: 24576,
  },
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
      status: "DRAFT",
      createdAt: "2026-10-24T09:00:00.000Z",
      editedBy: "851a2b3c4d5e6f7a8b9c0d21",
      file: {
        name: "invitation-api-design.pdf",
        contentType: "application/pdf",
        size: 24576,
      },
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

it("loads a Project Document without redundant Document type columns and submits a draft for review", async () => {
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
  expect(
    await screen.findByRole("button", { name: "invitation-api-design.pdf" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("columnheader", { name: /document type/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("columnheader", { name: "Processing & progress" }),
  ).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "invitation-api-design.pdf" }),
  );
  expect(await screen.findByText(document.content)).toBeVisible();
  expect(screen.getByText("v1 · Draft")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/submit`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(await screen.findByText("Document workflow updated.")).toBeVisible();
});

it("hides the upload action when project access is denied", async () => {
  api.mockRejectedValue(new Error("Project not found."));

  mount();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Project not found.",
  );
  expect(
    screen.queryByRole("button", { name: "Upload documents" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Request document upload" }),
  ).not.toBeInTheDocument();
});

it("supports Project Member 'Request document upload' flow with files embedded inside the dropzone and 1-step submit to PENDING_REVIEW", async () => {
  let createdPayload: Record<string, unknown> | null = null;
  let uploadedAutoSyncHeader: string | null = "unset";
  let submitCalled = false;
  let docsList: ProjectDocument[] = [];

  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: docsList,
        pagination: {
          page: 1,
          pageSize: 50,
          totalItems: docsList.length,
          totalPages: docsList.length ? 1 : 0,
        },
      } as never;
    }
    if (path.endsWith("/documents") && options?.method === "POST") {
      createdPayload = JSON.parse(String(options.body)) as Record<
        string,
        unknown
      >;
      return {
        ...document,
        id: "951a2b3c4d5e6f7a8b9c0d77",
        title: String(createdPayload.title ?? ""),
        description: String(createdPayload.description ?? ""),
        type: "OTHER",
        status: "DRAFT",
      } as never;
    }
    if (
      path.endsWith("/documents/951a2b3c4d5e6f7a8b9c0d77/file") &&
      options?.method === "PUT"
    ) {
      uploadedAutoSyncHeader = new Headers(options.headers).get(
        "X-Auto-Sync-Sag",
      );
      return {
        ...document,
        id: "951a2b3c4d5e6f7a8b9c0d77",
        file: {
          name: "system-architecture.md",
          contentType: "text/markdown",
          size: 32,
        },
      } as never;
    }
    if (
      path.endsWith("/documents/951a2b3c4d5e6f7a8b9c0d77/submit") &&
      options?.method === "POST"
    ) {
      submitCalled = true;
      const submittedDoc: ProjectDocument = {
        ...document,
        id: "951a2b3c4d5e6f7a8b9c0d77",
        title: "system-architecture",
        description: "Core RBAC architecture specs for sprint 4.",
        status: "PENDING_REVIEW",
        file: {
          name: "system-architecture.md",
          contentType: "text/markdown",
          size: 32,
        },
      };
      docsList = [submittedDoc];
      return submittedDoc as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();

  // Member sees role-accurate CTA (no separate "New document" text editor button)
  const requestBtns = await screen.findAllByRole("button", {
    name: "Request document upload",
  });
  expect(requestBtns.length).toBeGreaterThanOrEqual(1);
  expect(
    screen.queryByRole("button", { name: "New document" }),
  ).not.toBeInTheDocument();

  fireEvent.click(requestBtns[0]!);

  const dialog = await screen.findByRole("dialog", {
    name: "Request document upload",
  });
  expect(dialog).toBeVisible();
  expect(within(dialog).queryByText("Category")).not.toBeInTheDocument();
  expect(
    within(dialog).getByLabelText(/Note for Project Leader/i),
  ).toBeVisible();

  // Drop one valid Markdown file and one unsupported .zip archive into the wide dropzone
  const dropzoneFrame = dialog.querySelector("div.border-dashed")!;
  fireEvent.drop(dropzoneFrame, {
    dataTransfer: {
      files: [
        new File(["# System Architecture\nRBAC rules"], "system-architecture.md", {
          type: "text/markdown",
        }),
        new File(["PK\x03\x04"], "legacy-archive.zip", {
          type: "application/zip",
        }),
      ],
    },
  });

  // Both file cards render INSIDE the dashed dropzone container
  expect(
    await within(dropzoneFrame as HTMLElement).findByText(
      "system-architecture.md",
    ),
  ).toBeVisible();
  expect(
    within(dropzoneFrame as HTMLElement).getByText("2 files selected", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await within(dropzoneFrame as HTMLElement).findByText("Ready for request"),
  ).toBeVisible();
  expect(
    within(dropzoneFrame as HTMLElement).getByText("Unsupported format"),
  ).toBeVisible();
  expect(
    within(dropzoneFrame as HTMLElement).getByRole("button", {
      name: /Add files/i,
    }),
  ).toBeVisible();
  expect(
    within(dropzoneFrame as HTMLElement).getByRole("button", {
      name: "Clear all",
    }),
  ).toBeVisible();

  // Fill optional note for Leader and send request
  fireEvent.change(within(dialog).getByLabelText(/Note for Project Leader/i), {
    target: { value: "Core RBAC architecture specs for sprint 4." },
  });

  fireEvent.click(
    within(dialog).getByRole("button", { name: "Send request (1 file)" }),
  );

  await waitFor(() => expect(submitCalled).toBe(true));
  expect(createdPayload).toMatchObject({
    title: "system-architecture",
    description: "Core RBAC architecture specs for sprint 4.",
    type: "OTHER",
  });
  expect(uploadedAutoSyncHeader).toBeNull();
  expect(
    await within(dialog).findByText("Request sent · Pending approval"),
  ).toBeVisible();
  expect(await screen.findByText("Awaiting Leader approval")).toBeVisible();
});

it("supports Project Leader 'Upload project documents' flow with SHA-256 deduplication and immediate auto-sync", async () => {
  let uploadedAutoSyncHeader: string | null = null;
  const existingDocWithHash: ProjectDocument = {
    ...document,
    status: "APPROVED",
    permissions: {
      ...document.permissions,
      canConfigure: true,
      canReview: false,
    },
    knowledgeSync: {
      documentId,
      version: 1,
      status: "SEARCH_READY",
      currentStage: "COMPLETE",
      documentStatus: "ready",
      searchReady: true,
      progress: 100,
      chunkCount: 14,
      fileHash:
        "3b71f43ff30f4b15b5cd85dd9e95ebc7e84eb5a3f65d280431800d6221c8b435",
    },
  };

  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [existingDocWithHash],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.endsWith("/documents") && options?.method === "POST") {
      return {
        ...document,
        id: "951a2b3c4d5e6f7a8b9c0d99",
        status: "APPROVED",
      } as never;
    }
    if (
      path.endsWith("/documents/951a2b3c4d5e6f7a8b9c0d99/file") &&
      options?.method === "PUT"
    ) {
      uploadedAutoSyncHeader = new Headers(options.headers).get(
        "X-Auto-Sync-Sag",
      );
      return {
        ...document,
        id: "951a2b3c4d5e6f7a8b9c0d99",
        status: "APPROVED",
        file: { name: "new-spec.md", contentType: "text/markdown", size: 14 },
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  const { container } = mount();
  expect(await screen.findByText("Indexed · Ready")).toBeVisible();
  expect(screen.getByText("100%")).toBeVisible();
  expect(screen.getByText("14 chunks")).toBeVisible();

  const uploadBtn = screen.getByRole("button", { name: "Upload documents" });
  expect(uploadBtn).toBeVisible();

  // "hello" has SHA-256 = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  // Let's select two identical files in the same batch to verify SHA-256 deduplication + one unique file
  const fileInputs = container.querySelectorAll('input[type="file"][multiple]');
  fireEvent.change(fileInputs[0]!, {
    target: {
      files: [
        new File(["# New RAG Spec"], "new-spec.md", {
          type: "text/markdown",
        }),
        new File(["# New RAG Spec"], "new-spec-copy.md", {
          type: "text/markdown",
        }),
      ],
    },
  });

  const dialog = await screen.findByRole("dialog", {
    name: "Upload project documents",
  });
  expect(dialog).toBeVisible();
  expect(
    within(dialog).queryByLabelText(/Note for Project Leader/i),
  ).not.toBeInTheDocument();
  expect(await within(dialog).findByText("new-spec.md")).toBeVisible();
  expect(
    await within(dialog).findByText("Already in project (duplicate SHA-256)"),
  ).toBeVisible();

  fireEvent.click(within(dialog).getByRole("button", { name: "Upload 1 file" }));
  expect(
    await within(dialog).findByText("Uploaded · Processing started"),
  ).toBeVisible();
  expect(uploadedAutoSyncHeader).toBe("true");
});

it("renders real SAG pipeline stages (5% -> 35% -> 65% -> Paused -> 85% -> 100%) and handles Pause, Resume, Reprocess, and Revoke", async () => {
  const controlCalls: string[] = [];
  let syncState: DocumentKnowledgeStatus = {
    documentId,
    version: 1,
    sagDocumentId: "sag-doc-9001",
    status: "RECEIVED",
    currentStage: "RECEIVE",
    documentStatus: "pending",
    searchReady: false,
    knowledgeReady: false,
    progress: 5,
    deduplicatedStorage: true,
  };

  let failedDocSync: DocumentKnowledgeStatus = {
    documentId: "751a2b3c4d5e6f7a8b9c0d22",
    version: 1,
    sagDocumentId: "sag-doc-9002",
    status: "FAILED",
    currentStage: "PARSE",
    documentStatus: "failed",
    progress: 25,
    error: {
      stage: "PARSE",
      message: "Corrupted PDF stream",
    },
  };

  const activeDoc: ProjectDocument = {
    ...document,
    status: "APPROVED",
    permissions: {
      ...document.permissions,
      canConfigure: true,
      canEdit: true,
    },
    knowledgeSync: syncState,
  };

  const failedDoc: ProjectDocument = {
    ...document,
    id: "751a2b3c4d5e6f7a8b9c0d22",
    title: "Broken PDF spec",
    status: "APPROVED",
    file: {
      name: "broken-pdf-spec.pdf",
      contentType: "application/pdf",
      size: 16384,
    },
    permissions: {
      ...document.permissions,
      canConfigure: true,
    },
    knowledgeSync: failedDocSync,
  };

  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: [
          { ...activeDoc, knowledgeSync: syncState },
          { ...failedDoc, knowledgeSync: failedDocSync },
        ],
        pagination: { page: 1, pageSize: 50, totalItems: 2, totalPages: 1 },
      } as never;
    }
    if (
      path.endsWith("/documents/751a2b3c4d5e6f7a8b9c0d22/knowledge-control") &&
      options?.method === "POST"
    ) {
      const body = JSON.parse(String(options.body)) as { action: string };
      controlCalls.push(`failed:${body.action}`);
      failedDocSync = {
        ...failedDocSync,
        status: "RECEIVED",
        currentStage: "RECEIVE",
        documentStatus: "pending",
        progress: 5,
        error: null,
      };
      return failedDocSync as never;
    }
    if (
      path.endsWith(`/documents/${documentId}/knowledge-control`) &&
      options?.method === "POST"
    ) {
      const body = JSON.parse(String(options.body)) as { action: string };
      controlCalls.push(body.action);
      if (body.action === "PAUSE") {
        // Real SAG paused payload keeps version status "RECEIVED" while currentStage & documentStatus become PAUSED
        syncState = {
          ...syncState,
          status: "RECEIVED",
          currentStage: "PAUSED",
          documentStatus: "paused",
          progress: 65,
        };
      } else if (body.action === "RESUME") {
        syncState = {
          ...syncState,
          status: "SEARCH_READY",
          currentStage: "COMPLETE",
          documentStatus: "ready",
          searchReady: true,
          knowledgeReady: true,
          progress: 100,
          chunkCount: 24,
        };
      } else if (body.action === "REVOKE") {
        syncState = {
          ...syncState,
          status: "REVOKED",
          currentStage: "REVOKED",
          progress: 0,
        };
      }
      return syncState as never;
    }
    if (path.includes(`/documents/${documentId}/knowledge-chunks`)) {
      const response: DocumentKnowledgeChunksResponse =
        syncState.status === "SEARCH_READY"
          ? {
              documentId,
              version: 1,
              sagDocumentId: "sag-doc-9001",
              sagVersionNo: 1,
              sourceStage: "SEARCH_UNITS",
              totalChunks: 2,
              totalTokens: 168,
              items: [
                {
                  chunkId: "su-1",
                  ordinal: 1,
                  sectionPath: "1. Idempotency Contract",
                  blockType: "paragraph",
                  pageFrom: 1,
                  pageTo: 1,
                  tokenCount: 84,
                  content:
                    "POST /invitations enforces X-Idempotency-Key per project tenant.",
                },
                {
                  chunkId: "su-2",
                  ordinal: 2,
                  sectionPath: "2. Token Expiry Matrix",
                  blockType: "table",
                  pageFrom: 2,
                  pageTo: 2,
                  tokenCount: 84,
                  content: "Role | TTL | Revocable\nMember | 72h | Yes",
                },
              ],
            }
          : {
              documentId,
              version: 1,
              sagDocumentId: "sag-doc-9001",
              sagVersionNo: 1,
              sourceStage: "EMPTY",
              totalChunks: 0,
              totalTokens: 0,
              items: [],
            };
      return response as never;
    }
    if (path.endsWith(`/documents/${documentId}/knowledge-status`)) {
      return syncState as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) {
      return { ...activeDoc, knowledgeSync: syncState } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  const view = mount();

  // 1. Table displays Queued for processing · 5% AND Failed during parsing · 25% + error message
  expect(await screen.findByText("Queued for processing")).toBeVisible();
  expect(screen.getByText("5%")).toBeVisible();
  expect(screen.getByText("Failed during parsing")).toBeVisible();
  expect(screen.getByText("Corrupted PDF stream")).toBeVisible();

  // Clicking Re-index on failed row with sagDocumentId calls REPROCESS (not duplicate /knowledge-sync)
  fireEvent.click(
    screen.getByRole("button", { name: "Re-index: broken-pdf-spec.pdf" }),
  );
  await waitFor(() => expect(controlCalls).toContain("failed:REPROCESS"));

  // 2. Open Detail Modal and advance through PARSE (35%) -> DEDUP_TEMPORAL (65%) -> INDEX_SEARCH (85%)
  fireEvent.click(
    screen.getByRole("button", { name: "invitation-api-design.pdf" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("Processing pipeline")).toBeVisible();
  expect(within(dialog).getByText("Queued for processing")).toBeVisible();

  // Simulate SAG advancing to PARSE · 35%
  syncState = {
    ...syncState,
    status: "RECEIVED",
    currentStage: "PARSE",
    documentStatus: "loading",
    progress: 35,
  };
  view.unmount();

  const viewParse = mount();
  expect(await screen.findByText("Parsing document")).toBeVisible();
  expect(screen.getByText("35%")).toBeVisible();
  viewParse.unmount();

  // Simulate SAG advancing to DEDUP_TEMPORAL · 65%
  syncState = {
    ...syncState,
    status: "RECEIVED",
    currentStage: "DEDUP_TEMPORAL",
    documentStatus: "extracting",
    progress: 65,
  };
  const viewExtract = mount();
  expect(await screen.findByText("Extracting chunks")).toBeVisible();
  expect(screen.getByText("65%")).toBeVisible();
  viewExtract.unmount();

  // Simulate SAG advancing to INDEX_SEARCH · 85%, then test Pause -> Resume -> Revoke in Detail Modal
  syncState = {
    ...syncState,
    status: "RECEIVED",
    currentStage: "INDEX_SEARCH",
    documentStatus: "extracting",
    progress: 85,
  };
  mount();
  expect(await screen.findByText("Indexing vectors")).toBeVisible();
  expect(screen.getByText("85%")).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "invitation-api-design.pdf" }),
  );
  const modal = await screen.findByRole("dialog");
  expect(await within(modal).findByText("Indexing vectors")).toBeVisible();
  expect(within(modal).getByText("85%")).toBeVisible();

  // Pause running pipeline -> renders Paused · 65% even though SAG version status is "RECEIVED"
  fireEvent.click(within(modal).getByRole("button", { name: "Pause indexing" }));
  expect(await within(modal).findByText("Paused")).toBeVisible();
  expect(within(modal).getByText("65%")).toBeVisible();

  // Resume (continue) paused pipeline -> advances to Indexed · Ready · 100% · 24 chunks and reveals SAG Extracted chunks
  fireEvent.click(
    within(modal).getByRole("button", { name: "Resume indexing" }),
  );
  expect(await within(modal).findByText("Indexed · Ready")).toBeVisible();
  expect(within(modal).getByText("100%")).toBeVisible();
  expect(within(modal).getByText("24 chunks")).toBeVisible();
  expect(await within(modal).findByText("Extracted chunks")).toBeVisible();
  expect(within(modal).getByText("1. Idempotency Contract")).toBeVisible();

  // Detach from search index via inline confirmation -> hides Extracted chunks immediately
  fireEvent.click(
    within(modal).getByRole("button", { name: "Remove from index" }),
  );
  expect(
    await within(modal).findByText("Remove from search index?"),
  ).toBeVisible();
  fireEvent.click(within(modal).getByRole("button", { name: "Remove" }));
  expect(await within(modal).findByText("Removed from index")).toBeVisible();
  expect(within(modal).queryByText("Extracted chunks")).not.toBeInTheDocument();
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
  fireEvent.click(
    await screen.findByRole("button", { name: "invitation-api-design.pdf" }),
  );
  const removeLifecycleBtn = await screen.findByRole("button", {
    name: "Remove or delete document",
  });
  fireEvent.click(removeLifecycleBtn);

  expect(
    await screen.findByText("Remove document & cloud storage"),
  ).toBeVisible();
  const archiveBtn = await screen.findByRole("button", { name: "Archive" });
  fireEvent.click(archiveBtn);

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/documents/${documentId}/archive`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
});

it("renders the Leader review queue banner, standalone comment action, and Approve & start processing workflow", async () => {
  let syncTriggered = false;
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
    if (path.endsWith(`/documents/${documentId}/knowledge-sync`)) {
      syncTriggered = true;
      return {
        documentId,
        version: 1,
        status: "RECEIVED",
        currentStage: "RECEIVE",
        documentStatus: "pending",
        progress: 5,
      } as never;
    }
    if (path.endsWith(`/documents/${documentId}/knowledge-status`)) {
      return {
        documentId,
        version: 1,
        status: "RECEIVED",
        currentStage: "RECEIVE",
        documentStatus: "pending",
        progress: 5,
      } as never;
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

  const dialog = await screen.findByRole("dialog");
  expect(
    await within(dialog).findByText("Leader review decision"),
  ).toBeVisible();
  expect(
    within(dialog).queryByText("Extracted chunks"),
  ).not.toBeInTheDocument();
  const sendCommentBtn = within(dialog).getByRole("button", {
    name: "Send comment",
  });
  expect(sendCommentBtn).toBeDisabled();

  fireEvent.change(
    within(dialog).getByLabelText("Review comment", { exact: false }),
    {
      target: { value: "Please verify section 2 before final approval." },
    },
  );
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
      await within(dialog).findAllByText(
        "Please verify section 2 before final approval.",
      )
    ).length,
  ).toBeGreaterThanOrEqual(1);

  fireEvent.change(
    within(dialog).getByLabelText("Review comment", { exact: false }),
    {
      target: { value: "Looks solid and ready for team reference." },
    },
  );
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Approve & start processing",
    }),
  );

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
  await waitFor(() => expect(syncTriggered).toBe(true));
  expect(await screen.findByText("Document workflow updated.")).toBeVisible();
});

it("renders the two-column Document Detail Modal with SAG extracted chunks inspector, native download without fragile binary preview, interactive version switching, and file-first version upload", async () => {
  const longMigrationChunk =
    "Phase 1 deploys dual-write composite indexes on (tenant_id, project_id, updated_at DESC) concurrently with lock_timeout = 2s. " +
    "Phase 2 backfills historical partitions in 10,000-row batches and validates row parity before dropping legacy single-column indexes.";

  const extractedChunksPayload: DocumentKnowledgeChunksResponse = {
    documentId,
    version: 2,
    sagDocumentId: "sag-doc-schema-v2",
    sagVersionNo: 2,
    sourceStage: "SEARCH_UNITS",
    totalChunks: 3,
    totalTokens: 422,
    items: [
      {
        chunkId: "chunk-1",
        ordinal: 1,
        sectionPath: "1. Tenant Isolation Rules",
        blockType: "paragraph",
        pageFrom: 1,
        pageTo: 1,
        tokenCount: 94,
        content:
          "Every multi-tenant table enforces project_id + tenant_id composite partition scoping.",
      },
      {
        chunkId: "chunk-2",
        ordinal: 2,
        sectionPath: "2. Composite Index Matrix",
        blockType: "table",
        pageFrom: 2,
        pageTo: 3,
        tokenCount: 142,
        content:
          "Table | Index Columns | Strategy\nwork_documents | (project_id, status, updated_at) | BTREE",
      },
      {
        chunkId: "chunk-3",
        ordinal: 3,
        sectionPath: "3. Zero-Downtime Rollout",
        blockType: "paragraph",
        pageFrom: 4,
        pageTo: 4,
        tokenCount: 186,
        content: longMigrationChunk,
      },
    ],
  };

  let currentDoc: ProjectDocument = {
    ...document,
    title: "Database Schema Specification",
    description: "Updated indexes for multi-tenant queries.",
    type: "OTHER",
    version: 2,
    status: "APPROVED",
    submittedAt: "2026-10-24T10:00:00.000Z",
    reviewedBy: "951a2b3c4d5e6f7a8b9c0d99",
    reviewedAt: "2026-10-24T11:00:00.000Z",
    reviewComment: "Approved for production rollout.",
    permissions: {
      canCreate: true,
      canEdit: true,
      canSubmit: false,
      canReview: false,
      canConfigure: true,
    },
    file: {
      name: "schema-v2.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 131200,
    },
    knowledgeSync: {
      documentId,
      version: 2,
      status: "SEARCH_READY",
      currentStage: "COMPLETE",
      documentStatus: "ready",
      searchReady: true,
      progress: 100,
      chunkCount: 3,
      fileHash:
        "51f9061a9942c8b04d3e71b28890abcd51f9061a9942c8b04d3e71b28890abcd",
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
        data: [currentDoc],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (path.includes(`/documents/${documentId}/knowledge-chunks`)) {
      return extractedChunksPayload as never;
    }
    if (path.endsWith(`/documents/${documentId}/knowledge-status`)) {
      return currentDoc.knowledgeSync as never;
    }
    if (
      path.endsWith(`/documents/${documentId}`) &&
      options?.method === "PATCH"
    ) {
      return { ...currentDoc, version: 3 } as never;
    }
    if (
      path.endsWith(`/documents/${documentId}/file`) &&
      options?.method === "PUT"
    ) {
      const nextFile = {
        name: "schema-v3.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 142000,
      };
      currentDoc = {
        ...currentDoc,
        version: 3,
        file: nextFile,
        versions: [
          ...currentDoc.versions,
          {
            version: 3,
            status: "APPROVED",
            createdAt: "2026-10-25T09:00:00.000Z",
            editedBy: "851a2b3c4d5e6f7a8b9c0d21",
            file: nextFile,
          },
        ],
      };
      return currentDoc as never;
    }
    if (path.endsWith(`/documents/${documentId}`)) return currentDoc as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "schema-v2.docx" }),
  );

  const dialog = await screen.findByRole("dialog");
  expect(
    await within(dialog).findByText("Latest approved version"),
  ).toBeVisible();
  expect(within(dialog).getByText("Previous approved version")).toBeVisible();
  expect(within(dialog).getByText("Uploader note")).toBeVisible();
  expect(
    within(dialog).getByText("Updated indexes for multi-tenant queries."),
  ).toBeVisible();

  // Review activity timeline shows Submitted for review + Approved comment
  expect(within(dialog).getByText("Document & AI activity")).toBeVisible();
  expect(within(dialog).getByText("Submitted for review")).toBeVisible();
  expect(
    within(dialog).getByText("Approved for production rollout."),
  ).toBeVisible();

  // Fragile binary Preview button is completely removed; native Download + SHA-256 fingerprint are shown
  expect(
    within(dialog).queryByRole("button", { name: /preview/i }),
  ).not.toBeInTheDocument();
  expect(within(dialog).getByText("SHA-256 51f9061a")).toBeVisible();
  expect(
    within(dialog).getByRole("link", { name: "Download schema-v2.docx" }),
  ).toHaveAttribute(
    "href",
    `/api/backend/capture/projects/${projectId}/documents/${documentId}/file`,
  );

  // SAG Extracted chunks inspector renders structured chunks, page ranges, token counts, expand/collapse, and instant filter
  expect(await within(dialog).findByText("Extracted chunks")).toBeVisible();
  expect(within(dialog).getByText("3 chunks · 422 tokens")).toBeVisible();
  expect(within(dialog).getByText("1. Tenant Isolation Rules")).toBeVisible();
  expect(within(dialog).getByText("2. Composite Index Matrix")).toBeVisible();
  expect(within(dialog).getByText("table")).toBeVisible();
  expect(within(dialog).getByText("p. 2–3")).toBeVisible();
  expect(within(dialog).getByText("142 tok")).toBeVisible();

  // Legacy activeContent is suppressed when SAG chunks are displayed (zero duplicate content clutter)
  expect(
    within(dialog).queryByText("Updated v2 database schema with indexes."),
  ).not.toBeInTheDocument();

  // Expand and collapse long chunk #3
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Show full chunk" }),
  );
  expect(
    within(dialog).getByRole("button", { name: "Collapse" }),
  ).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Collapse" }));

  // Filter chunks instantaneously and clear filter
  const filterInput = within(dialog).getByRole("searchbox", {
    name: "Filter chunks…",
  });
  fireEvent.change(filterInput, { target: { value: "Composite Index" } });
  expect(within(dialog).getByText("2. Composite Index Matrix")).toBeVisible();
  expect(
    within(dialog).queryByText("1. Tenant Isolation Rules"),
  ).not.toBeInTheDocument();

  fireEvent.change(filterInput, { target: { value: "nonexistent-keyword" } });
  expect(
    within(dialog).getByText('No chunks match "nonexistent-keyword".'),
  ).toBeVisible();

  fireEvent.click(
    within(dialog).getByRole("button", { name: "Clear chunk filter" }),
  );
  expect(within(dialog).getByText("1. Tenant Isolation Rules")).toBeVisible();

  // Interactive Version History: switch to Version 1
  fireEvent.click(within(dialog).getByText("v1 · Approved"));
  expect(
    await within(dialog).findByText("Viewing Version 1 (Approved)"),
  ).toBeVisible();
  expect(
    within(dialog).getByText("Initial v1 database schema."),
  ).toBeVisible();
  expect(
    within(dialog).getAllByText("schema-v1.docx").length,
  ).toBeGreaterThanOrEqual(1);

  // Return to latest version (v2) -> restores SAG Extracted chunks
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Return to latest (v2)" }),
  );
  expect(
    await within(dialog).findByText("1. Tenant Isolation Rules"),
  ).toBeVisible();

  // File-first version replacement (v3)
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Upload new version" }),
  );
  expect(
    await within(dialog).findByText("Upload new version (v3)"),
  ).toBeVisible();

  const replacementDropzone = dialog.querySelector("div.border-dashed")!;
  fireEvent.drop(replacementDropzone, {
    dataTransfer: {
      files: [
        new File(["v3 docx bytes"], "schema-v3.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ],
    },
  });
  expect(await within(dialog).findByText("schema-v3.docx")).toBeVisible();

  fireEvent.click(within(dialog).getByRole("button", { name: "Upload v3" }));
  expect((await within(dialog).findAllByText("v3")).length).toBeGreaterThanOrEqual(1);
});

it("displays Cloudflare R2 SHA-256 reference-count badges and executes Tier 3 ref-count-safe permanent deletion", async () => {
  let deleted = false;
  const sharedDoc: ProjectDocument = {
    ...document,
    status: "APPROVED",
    permissions: {
      canCreate: true,
      canEdit: true,
      canSubmit: false,
      canReview: true,
      canConfigure: true,
      canDelete: true,
    },
    storageReference: {
      provider: "CLOUDFLARE_R2",
      objectCount: 1,
      deletableObjectCount: 0,
      sharedObjectCount: 1,
      refCount: 2,
      externalDocumentRefs: 1,
      willDeleteFromStorage: false,
      sha256:
        "51f9061a51f9061a51f9061a51f9061a51f9061a51f9061a51f9061a51f9061a",
    },
  };

  api.mockImplementation(async (path, options) => {
    if (path.includes("/documents?")) {
      return {
        data: deleted ? [] : [sharedDoc],
        pagination: {
          page: 1,
          pageSize: 50,
          totalItems: deleted ? 0 : 1,
          totalPages: 1,
        },
      } as never;
    }
    if (
      path === `/capture/projects/${projectId}/documents/${documentId}` &&
      options?.method === "DELETE"
    ) {
      deleted = true;
      return {
        deletedDocumentId: documentId,
        sagRevoked: true,
        r2DeletedKeys: 0,
        r2RetainedSharedKeys: 1,
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();

  expect(await screen.findByText("R2 · 2 refs (shared)")).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Remove or delete document: invitation-api-design.pdf",
    }),
  );

  const removalDialog = await screen.findByRole("dialog", {
    name: "Remove document & cloud storage",
  });
  expect(
    within(removalDialog).getByText(
      "Cloudflare R2 · SHA-256 deduplicated (2 references)",
    ),
  ).toBeVisible();
  expect(within(removalDialog).getByText("Ref-count safe")).toBeVisible();
  expect(
    within(removalDialog).getByText(
      "Tier 2 · Archive document (Governance)",
    ),
  ).toBeVisible();
  expect(
    within(removalDialog).getByText(
      "Tier 3 · Delete permanently (DB + SAG + R2)",
    ),
  ).toBeVisible();

  fireEvent.click(
    within(removalDialog).getByRole("button", { name: "Delete permanently" }),
  );

  await waitFor(() => expect(deleted).toBe(true));
  expect(
    await screen.findByText(/safely retained 1 shared deduplicated R2 object/i),
  ).toBeVisible();
});
