import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProjectTaskApi,
  fetchOrganizationTaskSummary,
  fetchProjectTasks,
  formatSprintIfMatch,
  formatTaskIfMatch,
  transitionProjectTaskApi,
  updateProjectTaskApi,
} from "./useTasks";

describe("Workspace Task API client (useTasks)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats task and sprint ETag / If-Match headers per contract", () => {
    expect(formatTaskIfMatch("65f000000000000000000010", 3)).toBe(
      '"task:65f000000000000000000010:3"',
    );
    expect(formatSprintIfMatch("65f000000000000000000020", 2)).toBe(
      '"sprint:65f000000000000000000020:2"',
    );
  });

  it("sends X-CSRF-Token, Idempotency-Key, and If-Match headers on task mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "65f000000000000000000099",
            projectId: "65f000000000000000000010",
            key: "CNTM-1",
            title: "Task 1",
            description: null,
            type: "TASK",
            status: "IN_PROGRESS",
            priority: "HIGH",
            assigneeId: null,
            createdBy: "65f000000000000000000001",
            parentId: null,
            sprintId: null,
            labels: [],
            steps: [],
            subtaskCounts: { total: 0, done: 0 },
            dueDate: null,
            startDate: null,
            completedAt: null,
            createdAt: "2026-10-22T00:00:00.000Z",
            updatedAt: "2026-10-22T00:00:00.000Z",
            version: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const projectId = "65f000000000000000000010";
    const taskId = "65f000000000000000000099";

    await createProjectTaskApi(
      projectId,
      { title: "Task 1", priority: "HIGH" },
      "idem-fixed-key-0001",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const createCall = fetchMock.mock.calls[0];
    const createHeaders = new Headers((createCall?.[1] as RequestInit)?.headers);
    expect(createHeaders.get("Idempotency-Key")).toBe("idem-fixed-key-0001");
    expect(createHeaders.get("X-CSRF-Token")).toBeTruthy();

    await updateProjectTaskApi(projectId, taskId, 1, { title: "Updated" });
    const patchHeaders = new Headers(
      (fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers,
    );
    expect(patchHeaders.get("If-Match")).toBe(`"task:${taskId}:1"`);

    await transitionProjectTaskApi(projectId, taskId, 2, {
      fromStatus: "TODO",
      toStatus: "IN_PROGRESS",
    });
    const transitionHeaders = new Headers(
      (fetchMock.mock.calls[2]?.[1] as RequestInit)?.headers,
    );
    expect(transitionHeaders.get("If-Match")).toBe(`"task:${taskId}:2"`);
    expect(transitionHeaders.get("Idempotency-Key")).toBeTruthy();
  });

  it("queries project tasks and organization summary endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            items: [],
            nextAfterId: null,
            nextCursor: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    await fetchProjectTasks("65f000000000000000000010", { status: "TODO" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/tasks/projects/65f000000000000000000010/tasks?limit=100&status=TODO",
    );

    await fetchOrganizationTaskSummary("cursor-token");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/tasks/organization/task-summary?limit=50&cursor=cursor-token",
    );
  });
});
