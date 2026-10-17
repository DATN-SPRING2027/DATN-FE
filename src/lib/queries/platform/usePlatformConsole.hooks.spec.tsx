import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, logoutSession } from "@/lib/api-client";
import {
  useCreatePlatformOrganizationMutation,
  usePlatformAuditQuery,
  usePlatformHealthQuery,
  usePlatformMembershipsQuery,
  usePlatformOrganizationQuery,
  usePlatformOrganizationsQuery,
  usePlatformLoginMutation,
  usePlatformUserLookupMutation,
  usePlatformLogoutMutation,
  useSuspendPlatformMembershipMutation,
} from "./usePlatformConsole";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, apiClient: vi.fn(), logoutSession: vi.fn() };
});

const mockedApiClient = vi.mocked(apiClient);
const mockedLogoutSession = vi.mocked(logoutSession);

const organizationId = "651a2b3c4d5e6f7a8b9c0d21";
const membershipId = "751a2b3c4d5e6f7a8b9c0d21";
const memberUserId = "851a2b3c4d5e6f7a8b9c0d21";

function membershipPage(version: number) {
  return {
    data: [{
      id: membershipId,
      organizationId,
      userId: memberUserId,
      status: "ACTIVE",
      version,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      user: { id: memberUserId, email: "member@example.test", fullName: "Member One", accountStatus: "ACTIVE" },
      organizationRoles: ["MEMBER"],
    }],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  };
}

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

describe("Platform API request contract", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-contract-token");
  });

  it("loads Organization detail from the BE #43 scoped detail route", async () => {
    mockedApiClient.mockResolvedValue({
      id: organizationId,
      name: "North Star",
      slug: "north-star",
      plan: "FREE",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    const { result } = renderHook(() => usePlatformOrganizationQuery(organizationId, true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      `/iam/platform/organizations/${organizationId}`,
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("uses the BE main Platform login route and request body", async () => {
    mockedApiClient.mockResolvedValue({ context: "PLATFORM", user: { id: memberUserId, email: "operator@example.test", name: "Operator" } });
    const { result } = renderHook(() => usePlatformLoginMutation(), { wrapper: createWrapper() });
    await act(async () => result.current.mutateAsync({ email: "operator@example.test", password: "test-password" }));

    const [path, options] = mockedApiClient.mock.calls[0];
    expect(path).toBe("/auth/platform/login");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({ email: "operator@example.test", password: "test-password" });
    expect(options?.cache).toBe("no-store");
  });

  it("uses CSRF-protected POST for exact-user lookup", async () => {
    mockedApiClient.mockResolvedValue({ id: memberUserId, email: "member@example.test", fullName: "Member One", status: "ACTIVE" });
    const { result } = renderHook(() => usePlatformUserLookupMutation(), { wrapper: createWrapper() });
    await act(async () => result.current.mutateAsync("member@example.test"));

    const [path, options] = mockedApiClient.mock.calls[0];
    expect(path).toBe("/iam/platform/users/lookup");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({ email: "member@example.test" });
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("csrf-contract-token");
    expect(options?.cache).toBe("no-store");
  });

  it.each(["SECURITY_INCIDENT", "ACCESS_REVIEW"] as const)("sends the selected %s reason and expected membership version", async (reasonCode) => {
    mockedApiClient.mockResolvedValue({
      operationId: "951a2b3c4d5e6f7a8b9c0d21",
      membership: { id: membershipId, organizationId, userId: memberUserId, status: "SUSPENDED", version: 3 },
    });
    const { result } = renderHook(() => useSuspendPlatformMembershipMutation(organizationId), { wrapper: createWrapper() });
    await act(async () => result.current.mutateAsync({ membershipId, expectedMembershipVersion: 2, reasonCode }));

    const [path, options] = mockedApiClient.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(path).toBe(`/iam/platform/organizations/${organizationId}/memberships/${membershipId}/suspend`);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({ expectedMembershipVersion: 2, reasonCode });
    expect(headers.get("X-CSRF-Token")).toBe("csrf-contract-token");
    expect(headers.get("Idempotency-Key")).toEqual(expect.any(String));
    expect(options?.cache).toBe("no-store");
  });

  it("loads health through the Platform IAM route", async () => {
    mockedApiClient.mockResolvedValue({ status: "ok" });
    const { result } = renderHook(() => usePlatformHealthQuery(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/platform/health", expect.objectContaining({ cache: "no-store" }));
  });

  it("loads the bounded Platform audit projection through its BE main route", async () => {
    mockedApiClient.mockResolvedValue([]);
    const { result } = renderHook(() => usePlatformAuditQuery(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/platform/audit", expect.objectContaining({ cache: "no-store" }));
  });
});

describe("Platform membership conflict recovery", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-conflict-token");
  });

  it("refetches the authoritative membership version after 409 without retrying the mutation", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    let membershipReads = 0;
    mockedApiClient.mockImplementation((path) => {
      if (path.includes("/memberships?page=")) {
        membershipReads += 1;
        return Promise.resolve(membershipPage(membershipReads === 1 ? 2 : 3));
      }
      if (path.endsWith("/suspend")) return Promise.reject(new ApiError(409, "MEMBERSHIP_VERSION_CONFLICT", "private stale version"));
      return Promise.reject(new Error(`Unexpected Platform endpoint: ${path}`));
    });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({
      memberships: usePlatformMembershipsQuery(organizationId, true),
      suspend: useSuspendPlatformMembershipMutation(organizationId),
    }), { wrapper });

    await waitFor(() => expect(result.current.memberships.data?.data[0]?.version).toBe(2));
    await act(async () => {
      await expect(result.current.suspend.mutateAsync({
        membershipId,
        expectedMembershipVersion: 2,
        reasonCode: "ACCESS_REVIEW",
      })).rejects.toMatchObject({ status: 409 });
    });

    await waitFor(() => expect(result.current.memberships.data?.data[0]?.version).toBe(3));
    expect(membershipReads).toBe(2);
    expect(mockedApiClient.mock.calls.filter(([path]) => path.endsWith("/suspend"))).toHaveLength(1);
    expect(JSON.parse(String(mockedApiClient.mock.calls.find(([path]) => path.endsWith("/suspend"))?.[1]?.body)))
      .toEqual({ expectedMembershipVersion: 2, reasonCode: "ACCESS_REVIEW" });
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

  it("clears every cached query after a successful Platform logout", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(["platform-console", "session"], { context: "PLATFORM", id: "operator" });
    queryClient.setQueryData(["platform-console", "organizations", 1], [{ id: "org-1" }]);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePlatformLogoutMutation(), { wrapper });

    await act(async () => result.current.mutateAsync());

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
