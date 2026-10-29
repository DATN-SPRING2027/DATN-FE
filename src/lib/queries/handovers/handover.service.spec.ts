import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, type ApiRequestOptions } from "@/lib/api-client";
import {
  acceptHandoverPackage,
  acknowledgeHandoverItem,
  askHandoverQuestion,
  createHandover,
  formatFollowUpEtag,
  formatHandoverEtag,
  getHandover,
  listHandovers,
  publishHandoverRevision,
  resolveHandoverFollowUp,
  setHandoverCoordinator,
  startHandoverTaskTransfer,
} from "./handover.service";
import type { HandoverSummaryDto } from "./handover.types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const mockedApiClient = vi.mocked(apiClient);

function makeSummary(overrides: Partial<HandoverSummaryDto> = {}): HandoverSummaryDto {
  return {
    id: "69e923c77859fd1c702d4d01",
    projectId: "69e923c77859fd1c702d4c21",
    teamId: null,
    departingUserId: "user-departing-a",
    assignedLeaderId: "user-leader-d",
    successorUserId: "user-successor-b",
    assignmentVersion: 1,
    title: "Core Auth & Gateway Knowledge Handover",
    version: 3,
    status: "OPEN",
    publishedRevisionId: "69e923c77859fd1c702d4e01",
    draftVersion: 2,
    targetCompletionDate: "2026-11-15T00:00:00.000Z",
    overdue: false,
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T01:00:00.000Z",
    ...overrides,
  };
}

describe("handover.service", () => {
  const originalCookie = document.cookie;

  beforeEach(() => {
    mockedApiClient.mockReset();
    document.cookie = "continuum_csrf=csrf-test-token-123";
  });

  afterEach(() => {
    document.cookie = "continuum_csrf=; Max-Age=0";
    if (originalCookie) {
      document.cookie = originalCookie;
    }
  });

  it("formats handover and follow-up strong ETags according to the contract", () => {
    expect(formatHandoverEtag("ho-1", 4)).toBe('"handover:ho-1:4"');
    expect(formatFollowUpEtag("fu-9", 2)).toBe('"handover-followup:fu-9:2"');
  });

  it("sends only cursor and limit query params on listHandovers and filters client-side", async () => {
    mockedApiClient.mockResolvedValueOnce({
      data: [
        makeSummary({
          id: "ho-1",
          title: "Auth Service Handover",
          status: "OPEN",
          departingUserId: "user-a",
          successorUserId: "user-b",
        }),
        makeSummary({
          id: "ho-2",
          title: "Search Indexing Handover",
          status: "COMPLETED",
          departingUserId: "user-a",
          successorUserId: "user-b",
        }),
        makeSummary({
          id: "ho-3",
          title: "Auth Legacy Notes",
          status: "OPEN",
          departingUserId: "user-other",
          successorUserId: "user-b",
        }),
      ],
      nextCursor: "cursor-next-2",
    });

    const result = await listHandovers("proj-1", {
      cursor: "cursor-1",
      limit: 25,
      status: "OPEN",
      departingUserId: "user-a",
      search: "auth",
    });

    expect(mockedApiClient).toHaveBeenCalledTimes(1);
    const [calledUrl] = mockedApiClient.mock.calls[0]!;
    expect(calledUrl).toBe(
      "/handover/projects/proj-1/handovers?cursor=cursor-1&limit=25",
    );
    expect(result.nextCursor).toBe("cursor-next-2");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("ho-1");
  });

  it("extracts ETag from GET /handovers/:handoverId and falls back deterministically", async () => {
    const summary = makeSummary({ id: "ho-99", version: 5 });
    mockedApiClient.mockImplementationOnce(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({ etag: '"handover:ho-99:5"' }),
        );
        return {
          handover: summary,
          publishedRevision: null,
          capabilities: ["READ", "MANAGE"],
          requiredPendingCount: 0,
          canComplete: false,
        };
      },
    );

    const res = await getHandover("proj-1", "ho-99");
    expect(res.etag).toBe('"handover:ho-99:5"');
    expect(res.detail.handover.id).toBe("ho-99");
  });

  it("attaches Idempotency-Key and X-CSRF-Token on createHandover (without If-Match)", async () => {
    mockedApiClient.mockImplementationOnce(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({
            etag: '"handover:ho-1:1"',
            "idempotency-replayed": "false",
          }),
        );
        return {
          operationId: "op-1",
          handoverId: "ho-1",
          version: 1,
          status: "OPEN",
          revisionId: null,
          replayed: false,
        };
      },
    );

    const res = await createHandover(
      "proj-1",
      {
        departingUserId: "user-a",
        assignedLeaderId: "user-d",
        successorUserId: null,
        teamId: null,
        targetCompletionDate: "2026-12-01T00:00:00.000Z",
        title: "Backend Architecture Handover",
      },
      "idem-create-001",
    );

    const [endpoint, options] = mockedApiClient.mock.calls[0]!;
    const headers = options?.headers as Headers;
    expect(endpoint).toBe("/handover/projects/proj-1/handovers");
    expect(options?.method).toBe("POST");
    expect(headers.get("Idempotency-Key")).toBe("idem-create-001");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token-123");
    expect(headers.get("If-Match")).toBeNull();
    expect(res.etag).toBe('"handover:ho-1:1"');
    expect(res.replayed).toBe(false);
  });

  it("sends If-Match, Idempotency-Key, and X-CSRF-Token on optimistic concurrency mutations", async () => {
    mockedApiClient.mockImplementation(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({
            etag: '"handover:ho-1:4"',
            "idempotency-replayed": "true",
          }),
        );
        return {
          operationId: "op-2",
          handoverId: "ho-1",
          version: 4,
          status: "OPEN",
          revisionId: "rev-1",
          replayed: true,
        };
      },
    );

    const coordRes = await setHandoverCoordinator(
      "proj-1",
      "ho-1",
      '"handover:ho-1:3"',
      { assignedLeaderId: "leader-2", reason: "Reassign coordinator" },
      "idem-coord-1",
    );
    expect(coordRes.replayed).toBe(true);
    {
      const [endpoint, options] = mockedApiClient.mock.calls[0]!;
      const headers = options?.headers as Headers;
      expect(endpoint).toBe("/handover/projects/proj-1/handovers/ho-1/coordinator");
      expect(options?.method).toBe("PUT");
      expect(headers.get("If-Match")).toBe('"handover:ho-1:3"');
      expect(headers.get("Idempotency-Key")).toBe("idem-coord-1");
      expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token-123");
    }

    await publishHandoverRevision(
      "proj-1",
      "ho-1",
      '"handover:ho-1:4"',
      {
        expectedDraftVersion: 2,
        reviewNote: "Approved for successor",
        itemReviews: [],
        gapAssignments: [],
      },
      "idem-pub-1",
    );
    {
      const [endpoint, options] = mockedApiClient.mock.calls[1]!;
      expect(endpoint).toBe("/handover/projects/proj-1/handovers/ho-1/revisions");
      expect(options?.method).toBe("POST");
      expect((options?.headers as Headers).get("If-Match")).toBe(
        '"handover:ho-1:4"',
      );
    }

    await acceptHandoverPackage(
      "proj-1",
      "ho-1",
      '"handover:ho-1:5"',
      { revisionId: "rev-1" },
      "idem-acc-1",
    );
    await acknowledgeHandoverItem(
      "proj-1",
      "ho-1",
      "item-1",
      '"handover:ho-1:5"',
      {
        revisionId: "rev-1",
        contentVersion: 1,
        assignmentVersion: 1,
        decision: "UNDERSTOOD",
        note: "Clear",
      },
      "idem-ack-1",
    );
    await startHandoverTaskTransfer(
      "proj-1",
      "ho-1",
      '"handover:ho-1:6"',
      {
        revisionId: "rev-1",
        assignmentVersion: 1,
        tasks: [{ taskId: "task-1", expectedTaskVersion: 2 }],
      },
      "idem-tr-1",
    );

    expect(mockedApiClient.mock.calls[2]?.[0]).toBe(
      "/handover/projects/proj-1/handovers/ho-1/acceptance",
    );
    expect(mockedApiClient.mock.calls[3]?.[0]).toBe(
      "/handover/projects/proj-1/handovers/ho-1/items/item-1/acknowledgements",
    );
    expect(mockedApiClient.mock.calls[4]?.[0]).toBe(
      "/handover/projects/proj-1/handovers/ho-1/task-transfers",
    );
  });

  it("sends CSRF-only headers (omitting If-Match and Idempotency-Key) on askHandoverQuestion", async () => {
    mockedApiClient.mockResolvedValueOnce({
      revisionId: "rev-1",
      answerStatus: "ANSWERED",
      message: "Grounded response",
      sections: [],
    });

    await askHandoverQuestion("proj-1", "ho-1", {
      revisionId: "rev-1",
      assignmentVersion: 1,
      question: "Where are the rotation keys configured?",
    });

    const [endpoint, options] = mockedApiClient.mock.calls[0]!;
    const headers = options?.headers as Headers;
    expect(endpoint).toBe("/handover/projects/proj-1/handovers/ho-1/questions");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token-123");
    expect(headers.get("Idempotency-Key")).toBeNull();
    expect(headers.get("If-Match")).toBeNull();
  });

  it("uses independent follow-up ETag on resolveHandoverFollowUp", async () => {
    mockedApiClient.mockImplementationOnce(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({ etag: '"handover-followup:fu-55:2"' }),
        );
        return {
          id: "fu-55",
          handoverId: "ho-1",
          revisionId: "rev-1",
          itemId: "item-opt-1",
          ownerUserId: "user-b",
          dueAt: "2026-11-20T00:00:00.000Z",
          reason: "Deferred runbook cleanup",
          status: "RESOLVED",
          version: 2,
          resolvedAt: "2026-10-29T00:00:00.000Z",
        };
      },
    );

    const res = await resolveHandoverFollowUp(
      "proj-1",
      "ho-1",
      "fu-55",
      formatFollowUpEtag("fu-55", 1),
      { resolutionNote: "Runbook updated and verified.", references: [] },
      "idem-fu-55",
    );

    const [endpoint, options] = mockedApiClient.mock.calls[0]!;
    const headers = options?.headers as Headers;
    expect(endpoint).toBe(
      "/handover/projects/proj-1/handovers/ho-1/follow-ups/fu-55/resolution",
    );
    expect(headers.get("If-Match")).toBe('"handover-followup:fu-55:1"');
    expect(headers.get("Idempotency-Key")).toBe("idem-fu-55");
    expect(res.etag).toBe('"handover-followup:fu-55:2"');
  });
});
