import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isKnowledgeSyncActive, workNotesApi } from "./useWorkNotes";

const fetchMock = vi.fn<typeof fetch>();

describe("Work Notes API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-csrf=csrf-value",
    );
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a Task Note through the Capture route with the CSRF cookie header", async () => {
    const response = {
      id: "751a2b3c4d5e6f7a8b9c0d21",
      projectId: "651a2b3c4d5e6f7a8b9c0d21",
      taskId: "851a2b3c4d5e6f7a8b9c0d21",
      authorId: "951a2b3c4d5e6f7a8b9c0d21",
      authorName: "Jordan Lee",
      type: "TASK_NOTE",
      status: "CONFIRMED",
      title: "Invitation endpoint",
      accomplishments: "Added the API route.",
      approach: "Used a transaction with an outbox.",
      reason: "Avoid duplicates.",
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
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(response), { status: 201 }),
    );

    const result = await workNotesApi.createTaskNote(
      response.projectId,
      response.taskId,
      {
        title: response.title,
        accomplishments: response.accomplishments,
        approach: response.approach,
        reason: response.reason,
      },
    );

    expect(result.id).toBe(response.id);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/capture/projects/${response.projectId}/tasks/${response.taskId}/notes`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(options.body).toBe(
      JSON.stringify({
        title: response.title,
        accomplishments: response.accomplishments,
        approach: response.approach,
        reason: response.reason,
      }),
    );
  });

  it("uses only the supported report frequencies in the schedule request", async () => {
    const response = {
      projectId: "651a2b3c4d5e6f7a8b9c0d21",
      frequency: "EVERY_3_DAYS",
      effectiveAt: "2026-10-24T00:00:00.000Z",
      nextEffectiveAt: "2026-10-27T00:00:00.000Z",
      updatedBy: "951a2b3c4d5e6f7a8b9c0d21",
      history: [],
      permissions: { canConfigure: true },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    await workNotesApi.updateReportSettings(response.projectId, "EVERY_3_DAYS");

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/capture/projects/${response.projectId}/work-report-settings`,
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      frequency: "EVERY_3_DAYS",
    });
    expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });

  it("saves a free-form Work Report draft with user title and content only", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const response = {
      id: "751a2b3c4d5e6f7a8b9c0d21",
      projectId,
      memberId: "951a2b3c4d5e6f7a8b9c0d21",
      memberName: "Jordan Lee",
      frequency: "WEEKLY",
      periodStart: "2026-10-26T00:00:00.000Z",
      periodEnd: "2026-11-02T00:00:00.000Z",
      dueAt: "2026-11-02T00:00:00.000Z",
      status: "DRAFT",
      title: "Sprint 14 Weekly Note",
      content: "Free-form summary of engineering tasks and observations.",
      createdAt: "2026-10-26T09:00:00.000Z",
      updatedAt: "2026-10-26T09:15:00.000Z",
      reviewHistory: [],
      permissions: {
        canCreate: true,
        canEdit: true,
        canSubmit: true,
        canReview: false,
        canConfigure: false,
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const saved = await workNotesApi.saveCurrentReport(projectId, {
      title: response.title,
      content: response.content,
    });

    expect(saved.title).toBe(response.title);
    expect(saved.content).toBe(response.content);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      title: "Sprint 14 Weekly Note",
      content: "Free-form summary of engineering tasks and observations.",
    });
  });

  it("uploads directly to R2 via upload-intent -> presigned XHR PUT -> confirm-upload without buffering through BFF", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const documentId = "751a2b3c4d5e6f7a8b9c0d22";
    const sha256 = "a".repeat(64);
    const file = new File(["%PDF-1.7 sample"], "architecture.pdf", {
      type: "application/pdf",
    });

    const xhrCalls: Array<{
      method: string;
      url: string;
      withCredentials: boolean;
      headers: Record<string, string>;
    }> = [];

    class MockXMLHttpRequest {
      method = "";
      url = "";
      withCredentials = false;
      status = 200;
      responseText = "";
      headers: Record<string, string> = {};
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      open(method: string, url: string) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader(key: string, value: string) {
        this.headers[key] = value;
      }

      abort() {
        this.onabort?.();
      }

      send(body: Document | XMLHttpRequestBodyInit | null) {
        xhrCalls.push({
          method: this.method,
          url: this.url,
          withCredentials: this.withCredentials,
          headers: { ...this.headers },
        });
        const total = body instanceof Blob ? body.size : 15;
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: total,
          total,
        } as ProgressEvent);
        this.status = 200;
        this.onload?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);

    const confirmedDoc = {
      id: documentId,
      projectId,
      title: "Architecture",
      type: "ARCHITECTURE",
      version: 1,
      status: "APPROVED",
      createdBy: "951a2b3c4d5e6f7a8b9c0d21",
      createdAt: "2026-10-29T10:00:00.000Z",
      updatedAt: "2026-10-29T10:00:05.000Z",
      content: "",
      file: {
        name: "architecture.pdf",
        contentType: "application/pdf",
        size: file.size,
      },
      versions: [],
      reviewHistory: [],
      permissions: {
        canCreate: true,
        canEdit: false,
        canSubmit: false,
        canReview: true,
        canConfigure: true,
      },
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "DIRECT_PUT",
            uploadToken: "v1.token.sig",
            uploadUrl: "https://r2.example.cloudflarestorage.com/presigned-put",
            headers: { "Content-Type": "application/pdf" },
            expiresInSeconds: 900,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(confirmedDoc), { status: 200 }),
      );

    const progressUpdates: number[] = [];
    const result = await workNotesApi.uploadDocumentFile(
      projectId,
      documentId,
      file,
      {
        sha256,
        autoSyncSag: true,
        onProgress: (pct) => progressUpdates.push(pct),
      },
    );

    expect(result.id).toBe(documentId);
    expect(xhrCalls).toHaveLength(1);
    expect(xhrCalls[0]).toEqual({
      method: "PUT",
      url: "https://r2.example.cloudflarestorage.com/presigned-put",
      withCredentials: false,
      headers: { "Content-Type": "application/pdf" },
    });
    expect(progressUpdates).toEqual([98, 100]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/backend/capture/projects/${projectId}/documents/${documentId}/file/upload-intent`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/backend/capture/projects/${projectId}/documents/${documentId}/file/confirm-upload`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("skips uploading bytes completely on DEDUPLICATED intent and falls back to legacy proxy if R2 CORS blocks direct XHR", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const documentId = "751a2b3c4d5e6f7a8b9c0d22";
    const sha256 = "b".repeat(64);
    const file = new File(["%PDF-1.7 dedup"], "dedup.pdf", {
      type: "application/pdf",
    });

    const xhrUrls: string[] = [];
    class FallbackMockXMLHttpRequest {
      url = "";
      withCredentials = false;
      status = 0;
      responseText = "";
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      open(_method: string, url: string) {
        this.url = url;
      }
      setRequestHeader() {}
      abort() {
        this.onabort?.();
      }
      send() {
        xhrUrls.push(this.url);
        if (this.url.startsWith("https://r2.example")) {
          this.status = 0;
          this.onerror?.();
          return;
        }
        this.status = 200;
        this.responseText = JSON.stringify({ id: documentId });
        this.onload?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", FallbackMockXMLHttpRequest);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "DEDUPLICATED",
            uploadToken: "v1.dedup.token",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: documentId }), { status: 200 }),
      );

    let dedupProgress = 0;
    const dedupResult = await workNotesApi.uploadDocumentFile(
      projectId,
      documentId,
      file,
      {
        sha256,
        onProgress: (pct) => {
          dedupProgress = pct;
        },
      },
    );
    expect(dedupResult.id).toBe(documentId);
    expect(dedupProgress).toBe(100);
    expect(xhrUrls).toHaveLength(0);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          mode: "DIRECT_PUT",
          uploadToken: "v1.direct.token",
          uploadUrl: "https://r2.example.cloudflarestorage.com/cors-blocked",
          headers: { "Content-Type": "application/pdf" },
        }),
        { status: 200 },
      ),
    );

    const fallbackResult = await workNotesApi.uploadDocumentFile(
      projectId,
      documentId,
      file,
      { sha256 },
    );
    expect(fallbackResult.id).toBe(documentId);
    expect(xhrUrls).toEqual([
      "https://r2.example.cloudflarestorage.com/cors-blocked",
      `/api/backend/capture/projects/${projectId}/documents/${documentId}/file`,
    ]);
  });

  it("downloads blobs directly from R2 when format=url returns DIRECT_GET", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const documentId = "751a2b3c4d5e6f7a8b9c0d22";

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "DIRECT_GET",
            downloadUrl: "https://r2.example.cloudflarestorage.com/direct-get",
            fileName: "spec.pdf",
            contentType: "application/pdf",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("direct-pdf-bytes", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      );

    const blob = await workNotesApi.downloadDocumentFile(
      projectId,
      documentId,
      2,
    );
    expect(await blob.text()).toBe("direct-pdf-bytes");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/backend/capture/projects/${projectId}/documents/${documentId}/file?version=2&format=url`,
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://r2.example.cloudflarestorage.com/direct-get",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("caps legacy proxy upload XHR progress at 98% until server responds 2xx and recognizes DATA_READY as settled knowledge sync", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const documentId = "751a2b3c4d5e6f7a8b9c0d22";
    const file = new File(["%PDF-1.7 legacy"], "legacy.pdf", {
      type: "application/pdf",
    });

    const progressTimeline: string[] = [];

    class LegacyProxyMockXMLHttpRequest {
      status = 0;
      responseText = "";
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      open() {}
      setRequestHeader() {}
      abort() {
        this.onabort?.();
      }
      send(body: Document | XMLHttpRequestBodyInit | null) {
        const size = body instanceof Blob ? body.size : 15;
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: size,
          total: size,
        } as ProgressEvent);
        progressTimeline.push("before-server-200");
        this.status = 200;
        this.responseText = JSON.stringify({ id: documentId });
        this.onload?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", LegacyProxyMockXMLHttpRequest);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Implemented" }), {
        status: 501,
      }),
    );

    await workNotesApi.uploadDocumentFile(projectId, documentId, file, {
      sha256: "c".repeat(64),
      onProgress: (pct) => progressTimeline.push(`pct:${pct}`),
    });

    expect(progressTimeline).toEqual([
      "pct:98",
      "before-server-200",
      "pct:100",
    ]);

    expect(
      isKnowledgeSyncActive({
        documentId,
        version: 1,
        status: "SEARCH_READY",
        searchStatus: "SEARCH_READY",
        knowledgeStatus: "QUEUED",
        searchReady: true,
        knowledgeReady: false,
        progress: 100,
      }),
    ).toBe(true);

    expect(
      isKnowledgeSyncActive({
        documentId,
        version: 1,
        status: "SEARCH_READY",
        searchStatus: "SEARCH_READY",
        knowledgeStatus: "DATA_READY",
        searchReady: true,
        knowledgeReady: false,
        progress: 100,
      }),
    ).toBe(false);
  });

  it("approves Task Notes, downloads post-approval .md artifacts via DIRECT_GET, and controls SAG sync for Task Notes and Work Reports", async () => {
    const projectId = "651a2b3c4d5e6f7a8b9c0d21";
    const noteId = "751a2b3c4d5e6f7a8b9c0d21";
    const reportId = "751a2b3c4d5e6f7a8b9c0d31";

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: noteId,
          projectId,
          reviewStatus: "APPROVED",
        }),
        { status: 200 },
      ),
    );
    const approvedNote = await workNotesApi.taskNoteAction(
      projectId,
      noteId,
      "approve",
      "Ready for SAG",
    );
    expect(approvedNote.reviewStatus).toBe("APPROVED");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/capture/projects/${projectId}/work-notes/${noteId}/approve`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ comment: "Ready for SAG" }),
      }),
    );

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "DIRECT_GET",
            downloadUrl: "https://r2.example.com/work-notes/approved.md",
            fileName: "task-note.md",
            contentType: "text/markdown",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("# Approved Task Note", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        }),
      );

    const noteBlob = await workNotesApi.downloadTaskNoteFile(projectId, noteId);
    expect(await noteBlob.text()).toBe("# Approved Task Note");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          documentId: reportId,
          version: 1,
          status: "PAUSED",
        }),
        { status: 200 },
      ),
    );
    const pausedReportSync = await workNotesApi.controlWorkReportKnowledge(
      projectId,
      reportId,
      "PAUSE",
    );
    expect(pausedReportSync.status).toBe("PAUSED");
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/backend/capture/projects/${projectId}/work-reports/${reportId}/knowledge-control`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "PAUSE" }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          entityId: noteId,
          status: "CHANGES_REQUESTED",
          sagRevoked: true,
          r2DeletedKeys: 1,
          r2RetainedSharedKeys: 0,
        }),
        { status: 200 },
      ),
    );
    const purgedNote = await workNotesApi.purgeTaskNoteFile(
      projectId,
      noteId,
      { reopen: true, comment: "Needs diagram" },
    );
    expect(purgedNote.r2DeletedKeys).toBe(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/backend/capture/projects/${projectId}/work-notes/${noteId}/file?reopen=true`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ reopen: true, comment: "Needs diagram" }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          action: "APPROVE",
          requestedCount: 1,
          succeededIds: [reportId],
          failed: [],
        }),
        { status: 200 },
      ),
    );
    const bulkResult = await workNotesApi.bulkWorkReportAction(projectId, {
      ids: [reportId],
      action: "APPROVE",
    });
    expect(bulkResult.succeededIds).toEqual([reportId]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/backend/capture/projects/${projectId}/work-reports/bulk-action`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ids: [reportId], action: "APPROVE" }),
      }),
    );
  });
});
