import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workNotesApi } from "./useWorkNotes";

const fetchMock = vi.fn<typeof fetch>();

describe("Work Notes API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
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
      permissions: { canCreate: true, canEdit: false, canSubmit: false, canReview: false, canConfigure: false },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }));

    const result = await workNotesApi.createTaskNote(
      response.projectId,
      response.taskId,
      { title: response.title, accomplishments: response.accomplishments, approach: response.approach, reason: response.reason },
    );

    expect(result.id).toBe(response.id);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/capture/projects/${response.projectId}/tasks/${response.taskId}/notes`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(options.body).toBe(JSON.stringify({ title: response.title, accomplishments: response.accomplishments, approach: response.approach, reason: response.reason }));
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
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    await workNotesApi.updateReportSettings(response.projectId, "EVERY_3_DAYS");

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/capture/projects/${response.projectId}/work-report-settings`,
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({ frequency: "EVERY_3_DAYS" });
    expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });
});
