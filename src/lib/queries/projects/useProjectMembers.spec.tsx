import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  useProjectMemberCandidatesQuery,
  useProjectMembersQuery,
  useProjectMembersAllQuery,
  useAddProjectMember,
  useRemoveProjectMember,
} from "./useProjectMembers";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const api = vi.mocked(apiClient);
const projectId = "123456789012345678901234";
const userId = "123456789012345678901235";
const membershipId = "123456789012345678901236";
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
beforeEach(() => {
  api.mockReset();
});
afterEach(() => cleanup());
it("lists the documented page and status without role inference", async () => {
  api.mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  });
  const { result } = renderHook(
    () =>
      useProjectMembersQuery("org", projectId, {
        page: 1,
        pageSize: 20,
        status: "ACTIVE",
      }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api).toHaveBeenCalledWith(
    `/iam/projects/${projectId}/memberships?page=1&pageSize=20&status=ACTIVE`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
it("loads every active Project member page for complete assignee choices", async () => {
  api
    .mockResolvedValueOnce({
      data: [{
        id: membershipId,
        organizationId: "org",
        projectId,
        userId,
        status: "ACTIVE",
        joinedAt: "2026-10-01T00:00:00Z",
      }],
      pagination: { page: 1, pageSize: 100, totalItems: 101, totalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: [{
        id: "123456789012345678901237",
        organizationId: "org",
        projectId,
        userId: "123456789012345678901238",
        status: "ACTIVE",
        joinedAt: "2026-10-02T00:00:00Z",
      }],
      pagination: { page: 2, pageSize: 100, totalItems: 101, totalPages: 2 },
    });
  const { result } = renderHook(
    () => useProjectMembersAllQuery("org", projectId, { status: "ACTIVE" }),
    { wrapper: wrapper() },
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(2);
  expect(api).toHaveBeenNthCalledWith(
    1,
    `/iam/projects/${projectId}/memberships?page=1&pageSize=100&status=ACTIVE`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(api).toHaveBeenNthCalledWith(
    2,
    `/iam/projects/${projectId}/memberships?page=2&pageSize=100&status=ACTIVE`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
it("preserves a denied candidate search as a query error", async () => {
  api.mockRejectedValue(new ApiError(403, "FORBIDDEN", "denied"));
  const { result } = renderHook(
    () =>
      useProjectMemberCandidatesQuery("org", projectId, "member@example.test"),
    { wrapper: wrapper() },
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(ApiError);
  expect(result.current.error?.message).toBe("denied");
  expect(api).toHaveBeenCalledTimes(1);
});
it("treats a malformed candidate response as an error rather than an empty result", async () => {
  api.mockResolvedValue({ data: null });
  const { result } = renderHook(
    () =>
      useProjectMemberCandidatesQuery("org", projectId, "member@example.test"),
    { wrapper: wrapper() },
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(ApiError);
  expect(result.current.error).toMatchObject({
    status: 502,
    code: "INVALID_PROJECT_MEMBER_RESPONSE",
  });
});
it("adds only userId and removes by membershipId with an empty response", async () => {
  api
    .mockResolvedValueOnce({
      id: membershipId,
      organizationId: "org",
      projectId,
      userId,
      status: "ACTIVE",
      joinedAt: "2026-10-01T00:00:00Z",
    })
    .mockResolvedValue(undefined);
  const add = renderHook(() => useAddProjectMember("org", projectId), {
    wrapper: wrapper(),
  });
  await act(() => add.result.current.mutateAsync(userId));
  expect(api).toHaveBeenCalledWith(
    `/iam/projects/${projectId}/memberships`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  );
  const remove = renderHook(() => useRemoveProjectMember("org", projectId), {
    wrapper: wrapper(),
  });
  await act(() => remove.result.current.mutateAsync(membershipId));
  expect(api).toHaveBeenCalledWith(
    `/iam/projects/${projectId}/memberships/${membershipId}`,
    expect.objectContaining({ method: "DELETE" }),
  );
});
it.each([
  [403, "denied"],
  [404, "cross-scope"],
  [422, "invalid"],
  [0, "network failure"],
] as const)(
  "preserves %s %s errors for every operation without retrying mutations",
  async (status, message) => {
    const error = status
      ? new ApiError(status, "TEST_ERROR", message)
      : new TypeError(message);
    api.mockRejectedValue(error);
    const list = renderHook(
      () => useProjectMembersQuery("org", projectId, { page: 1, pageSize: 20 }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(list.result.current.isError).toBe(true));
    expect(list.result.current.error?.message).toBe(message);
    list.unmount();
    const add = renderHook(() => useAddProjectMember("org", projectId), {
      wrapper: wrapper(),
    });
    act(() => add.result.current.mutate(userId));
    await waitFor(() => expect(add.result.current.isError).toBe(true));
    expect(add.result.current.error?.message).toBe(message);
    const remove = renderHook(() => useRemoveProjectMember("org", projectId), {
      wrapper: wrapper(),
    });
    act(() => remove.result.current.mutate(membershipId));
    await waitFor(() => expect(remove.result.current.isError).toBe(true));
    expect(remove.result.current.error?.message).toBe(message);
    expect(api).toHaveBeenCalledTimes(3);
  },
);
it("rejects invalid input before making mutations", async () => {
  const add = renderHook(() => useAddProjectMember("org", projectId), {
    wrapper: wrapper(),
  });
  await act(async () => {
    await expect(add.result.current.mutateAsync("")).rejects.toThrow();
  });
  const remove = renderHook(() => useRemoveProjectMember("org", projectId), {
    wrapper: wrapper(),
  });
  await act(async () => {
    await expect(remove.result.current.mutateAsync("   ")).rejects.toThrow();
  });
  expect(api).not.toHaveBeenCalled();
});
