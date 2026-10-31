import { beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { editorAgentApi } from "./work-note-agent.api";
vi.mock("@/lib/api-client", () => ({ apiClient: vi.fn() }));
const response = {
  id: "draft",
  workflow: "PROJECT_DOCUMENT",
  resourceId: "doc",
  baseVersion: 2,
  baseContentHash: "a".repeat(64),
  revision: 1,
  title: "Source",
  contentMarkdown: "Chưa test.",
  expiresAt: "2026-10-29",
  conversation: [],
  pendingQuestion: null,
  suggestion: null,
  hasAppliedRewrite: false,
  context: { documentType: "OTHER" },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiClient).mockResolvedValue(response);
});
it("creates an existing Document editor without a Task identifier and normalizes only shared UI state", async () => {
  const api = editorAgentApi({
    workflow: "PROJECT_DOCUMENT",
    resourceId: "doc",
  });
  const d = await api.create("project", {
    operationId: "operation",
    taskId: "must-not-send",
  });
  expect(d.workflow).toBe("PROJECT_DOCUMENT");
  expect(d.baseNoteVersion).toBe(2);
  expect(d.baseContentHash).toBe(response.baseContentHash);
  const body = JSON.parse(
    vi.mocked(apiClient).mock.calls[0][1]!.body as string,
  );
  expect(body).toEqual({
    operationId: "operation",
    workflow: "PROJECT_DOCUMENT",
    documentId: "doc",
  });
});
it("uses the server-owned Report ID and carries the source hash when restoring", async () => {
  const api = editorAgentApi({ workflow: "WORK_REPORT", resourceId: "report" });
  await api.create("project", {
    operationId: "operation",
    taskId: "must-not-send",
  });
  expect(
    JSON.parse(vi.mocked(apiClient).mock.calls[0][1]!.body as string),
  ).toEqual({
    operationId: "operation",
    workflow: "WORK_REPORT",
    reportId: "report",
  });
  await api.restore("project", "", "report", {
    operationId: "restore",
    expectedVersion: 2,
    versionNumber: 1,
    expectedContentHash: response.baseContentHash,
  });
  expect(vi.mocked(apiClient).mock.lastCall?.[0]).toContain(
    "/editor-drafts/sources/WORK_REPORT/report/restore",
  );
  expect(
    JSON.parse(vi.mocked(apiClient).mock.lastCall?.[1]?.body as string)
      .expectedContentHash,
  ).toBe(response.baseContentHash);
});
