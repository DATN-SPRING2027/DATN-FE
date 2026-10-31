import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assessmentApi } from "./work-note-assessment.api";
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(document, "cookie", "get").mockReturnValue(
    "__Host-csrf=assessment-csrf",
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ schemaVersion: "task-note-assessment/v1" }),
        { status: 200 },
      ),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const mutation = {
  operationId: "operation-one",
  expectedRevision: 4,
  expectedAssessmentRevision: 2,
};
it("uses the Task draft route with CSRF and revision fields, not a client-supplied Task context", async () => {
  await assessmentApi.assess("project/id", "draft/id", {
    operationId: mutation.operationId,
    expectedRevision: 4,
    purpose: "PROGRESS",
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/backend/capture/projects/project%2Fid/work-note-drafts/draft%2Fid/agent/assessments",
    expect.objectContaining({ method: "POST", credentials: "include" }),
  );
  const options = fetchMock.mock.calls[0][1]!;
  expect(new Headers(options.headers).get("X-CSRF-Token")).toBe(
    "assessment-csrf",
  );
  expect(JSON.parse(String(options.body))).toEqual({
    operationId: "operation-one",
    expectedRevision: 4,
    purpose: "PROGRESS",
  });
});
it("serializes typed unknown without an invented answer and keeps assessment CAS", async () => {
  await assessmentApi.reply("p", "d", "assessment/id", {
    ...mutation,
    gapId: "gap-one",
    questionId: "question-one",
    disposition: "unknown",
  });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(
    "/api/backend/capture/projects/p/work-note-drafts/d/agent/assessments/assessment%2Fid/replies",
  );
  expect(JSON.parse(String(options?.body))).toEqual({
    ...mutation,
    gapId: "gap-one",
    questionId: "question-one",
    disposition: "unknown",
  });
});
it("keeps correction, reset, rewrite, feedback and author validation as distinct explicit operations", async () => {
  await assessmentApi.correct("p", "d", "a", {
    ...mutation,
    targetClaimOrGapId: "claim-one",
    correctionText: "Not deployed.",
  });
  await assessmentApi.reset("p", "d", "a", {
    ...mutation,
    newPurpose: "HANDOVER",
    carryAnswerIds: [],
  });
  await assessmentApi.rewrite("p", "d", "a", mutation);
  await assessmentApi.feedback("p", "d", "a", {
    ...mutation,
    category: "FALSE_SUFFICIENT",
  });
  await assessmentApi.validateAuthor("p", "d", "a", mutation);
  expect(
    fetchMock.mock.calls.map(([url]) => String(url).split("/").at(-1)),
  ).toEqual(["corrections", "reset", "rewrite", "feedback", "validate-author"]);
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
    ...mutation,
    newPurpose: "HANDOVER",
    carryAnswerIds: [],
  });
});
