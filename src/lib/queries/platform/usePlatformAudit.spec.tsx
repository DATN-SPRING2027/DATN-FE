import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  usePlatformAuditEventsQuery,
  usePlatformAuditEventQuery,
  usePlatformAuditResourceHistoryQuery,
} from "./usePlatformOperations";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, apiClient: vi.fn() };
});
const api = vi.mocked(apiClient);
const event = {
  eventId: "restore-event-1",
  occurredAt: "2026-10-26T08:00:00.000Z",
  actorUserId: "651a2b3c4d5e6f7a8b9c0d21",
  action: "platform.user.restored",
  resourceType: "USER",
  resourceId: "651a2b3c4d5e6f7a8b9c0d22",
  scope: "PLATFORM",
  result: "SUCCESS",
  reasonCode: "ACCESS_REVIEW",
};
const page = {
  data: [event],
  pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
};
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
describe("Platform restore audit compatibility", () => {
  beforeEach(() => api.mockReset());
  it("loads a page containing the contracted user-restored event", async () => {
    api.mockResolvedValue(page);
    const { result } = renderHook(
      () => usePlatformAuditEventsQuery({ page: 1, pageSize: 25 }, true),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data[0]).toEqual(event);
  });
  it("loads restored-user event details", async () => {
    api.mockResolvedValue(event);
    const { result } = renderHook(
      () => usePlatformAuditEventQuery(event.eventId, true),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(event);
  });
  it("loads restored-user resource history", async () => {
    api.mockResolvedValue(page);
    const { result } = renderHook(
      () =>
        usePlatformAuditResourceHistoryQuery("USER", event.resourceId, true),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data[0]).toEqual(event);
  });
  it("continues rejecting actions outside the approved audit contract", async () => {
    api.mockResolvedValue({
      ...page,
      data: [{ ...event, action: "unapproved.action" }],
    });
    const { result } = renderHook(() => usePlatformAuditEventsQuery({}, true), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: "INVALID_PLATFORM_RESPONSE",
    });
  });
});
