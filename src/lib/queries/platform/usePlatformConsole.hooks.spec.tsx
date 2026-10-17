import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, logoutSession } from "@/lib/api-client";
import {
  useCreatePlatformOrganizationMutation,
  usePlatformAuditQuery,
  usePlatformMembershipsQuery,
  usePlatformOrganizationQuery,
  usePlatformOrganizationsQuery,
  usePlatformLogoutMutation,
} from "./usePlatformConsole";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, apiClient: vi.fn(), logoutSession: vi.fn() };
});

const mockedApiClient = vi.mocked(apiClient);
const mockedLogoutSession = vi.mocked(logoutSession);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useCreatePlatformOrganizationMutation", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedLogoutSession.mockReset().mockResolvedValue(undefined);
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-csrf=csrf-test-token",
    );
    mockedApiClient.mockResolvedValue({
      id: "651a2b3c4d5e6f7a8b9c0d21",
      name: "First Organization",
      slug: "first-organization",
      plan: "FREE",
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
    });
  });

  it("sends the CSRF cookie value as the request header", async () => {
    const { result } = renderHook(() => useCreatePlatformOrganizationMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "First Organization",
        slug: "first-organization",
        plan: "FREE",
        firstAdminUserId: "751a2b3c4d5e6f7a8b9c0d21",
      });
    });

    const [path, options] = mockedApiClient.mock.calls[0];
    expect(path).toBe("/iam/platform/organizations");
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe(
      "csrf-test-token",
    );
  });
});

describe("Platform paginated list queries", () => {
  beforeEach(() => {
    mockedApiClient.mockReset().mockResolvedValue({
      data: [],
      pagination: { page: 2, pageSize: 100, totalItems: 205, totalPages: 3 },
    });
  });

  it("requests the selected Organization directory page", async () => {
    const { result } = renderHook(() => usePlatformOrganizationsQuery(true, 2), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/iam/platform/organizations?page=2&pageSize=100",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("requests the selected membership page within one Organization", async () => {
    const organizationId = "651a2b3c4d5e6f7a8b9c0d21";
    const { result } = renderHook(() => usePlatformMembershipsQuery(organizationId, true, 3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      `/iam/platform/organizations/${organizationId}/memberships?page=3&pageSize=100`,
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });
});

describe("Platform audit projection query", () => {
  beforeEach(() => mockedApiClient.mockReset());

  it("fails the projection instead of silently dropping a malformed record", async () => {
    mockedApiClient.mockResolvedValue([
      {
        action: "organization.create",
        targetResource: "ORGANIZATION",
        targetResourceId: "651a2b3c4d5e6f7a8b9c0d21",
        actorUserId: "751a2b3c4d5e6f7a8b9c0d21",
        occurredAt: "2026-10-16T00:00:00.000Z",
      },
      {
        action: "unapproved.secret.payload",
        targetResource: "ORGANIZATION",
        targetResourceId: "651a2b3c4d5e6f7a8b9c0d22",
        actorUserId: "751a2b3c4d5e6f7a8b9c0d21",
        occurredAt: "2026-10-16T00:00:00.000Z",
      },
    ]);
    const { result } = renderHook(() => usePlatformAuditQuery(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("usePlatformLogoutMutation", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedLogoutSession.mockReset().mockResolvedValue(undefined);
  });

  it("uses the shared refresh-aware session logout flow", async () => {
    const { result } = renderHook(() => usePlatformLogoutMutation(), { wrapper: createWrapper() });

    await act(async () => result.current.mutateAsync());

    expect(mockedLogoutSession).toHaveBeenCalledTimes(1);
    expect(mockedLogoutSession.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("clears private query data when the logout endpoint confirms the session is already unauthenticated", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["platform-console", "session"], { context: "PLATFORM", id: "operator" });
    queryClient.setQueryData(["platform-console", "organizations", 1], [{ id: "org-1" }]);
    mockedLogoutSession.mockRejectedValueOnce(new ApiError(401, "AUTHENTICATION_FAILED", "private auth detail"));
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePlatformLogoutMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({ status: 401 });
    });

    expect(queryClient.getQueryData(["platform-console", "session"])).toBeUndefined();
    expect(queryClient.getQueryData(["platform-console", "organizations", 1])).toBeUndefined();
  });
});

describe("Platform Organization detail query", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("does not send a request for an invalid Organization ID", async () => {
    const { result } = renderHook(() => usePlatformOrganizationQuery("not-an-object-id", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mockedApiClient).not.toHaveBeenCalled();
  });
});
