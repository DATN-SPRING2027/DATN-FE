import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  usePlatformArchiveUserMutation,
  usePlatformChangeUserStatusMutation,
  usePlatformIncidentHistoryQuery,
  usePlatformIncidentQuery,
  usePlatformOrganizationInvitationsQuery,
  usePlatformUpdateUserProfileMutation,
  usePlatformUserOrganizationsQuery,
  usePlatformUserSessionQuery,
  usePlatformUsersQuery,
  usePlatformServicesQuery,
} from "./usePlatformOperations";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, apiClient: vi.fn() };
});

const mockedApiClient = vi.mocked(apiClient);

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

const user = {
  id: "651a2b3c4d5e6f7a8b9c0d21",
  email: "operator@example.test",
  fullName: "Platform Operator",
  avatarUrl: null,
  archivedAt: null,
  status: "SUSPENDED",
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T01:00:00.000Z",
  memberships: [],
  membershipsTruncated: false,
  password: "must-not-be-returned",
};

describe("Platform user operations", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("requests a filtered BE page and returns only the safe user projection", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mockedApiClient.mockResolvedValue({
      data: [user],
      pagination: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 },
    });

    const { result } = renderHook(
      () =>
        usePlatformUsersQuery(
          { page: 2, pageSize: 25, search: "alice", status: "SUSPENDED" },
          true,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/iam/platform/users?page=2&pageSize=25&search=alice&status=SUSPENDED",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data?.data[0]).not.toHaveProperty("password");
    expect(result.current.data?.data[0]?.status).toBe("SUSPENDED");
    expect(mockedApiClient.mock.calls[0]?.[1]?.signal).toBeInstanceOf(
      AbortSignal,
    );
    expect(timeout).toHaveBeenCalledWith(15_000);
    timeout.mockRestore();
  });

  it.each(["ACTIVE", "SUSPENDED", "PENDING_INVITE", "ARCHIVED"] as const)(
    "accepts the %s Platform user list filter",
    async (status) => {
      mockedApiClient.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      });

      const { result } = renderHook(
        () => usePlatformUsersQuery({ page: 1, pageSize: 25, status }, true),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiClient).toHaveBeenCalledWith(
        `/iam/platform/users?page=1&pageSize=25&status=${status}`,
        expect.objectContaining({ cache: "no-store" }),
      );
    },
  );

  it("rejects a user list filter outside the Platform user contract", () => {
    expect(() =>
      renderHook(
        () => usePlatformUsersQuery({ status: "PUBLIC" as "ACTIVE" }, false),
        { wrapper: createWrapper() },
      ),
    ).toThrow("Invalid user filter");
  });

  it("sends a CSRF protected CAS status change with request ID and refreshes private projections", async () => {
    const cookie = vi
      .spyOn(document, "cookie", "get")
      .mockReturnValue("__Host-csrf=csrf-test-token");
    mockedApiClient.mockResolvedValue({
      ...user,
      status: "ACTIVE",
      updatedAt: "2026-10-16T02:00:00.000Z",
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePlatformChangeUserStatusMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        userId: user.id,
        status: "ACTIVE",
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      });
    });

    const [path, options] = mockedApiClient.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(path).toBe(`/iam/platform/users/${user.id}/status`);
    expect(options?.method).toBe("PATCH");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token");
    expect(headers.get("X-Request-ID")).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      status: "ACTIVE",
      expectedUpdatedAt: user.updatedAt,
      reasonCode: "ACCESS_REVIEW",
    });
    expect(invalidate).toHaveBeenCalled();
    cookie.mockRestore();
  });

  it("updates Platform profile fields through the Platform route with CAS and no retry", async () => {
    const cookie = vi
      .spyOn(document, "cookie", "get")
      .mockReturnValue("__Host-csrf=csrf-test-token");
    mockedApiClient.mockResolvedValue({
      ...user,
      fullName: "Updated Operator",
      avatarUrl: "https://cdn.example.test/operator.png",
      updatedAt: "2026-10-16T02:00:00.000Z",
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => usePlatformUpdateUserProfileMutation(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        userId: user.id,
        fullName: "Updated Operator",
        avatarUrl: "https://cdn.example.test/operator.png",
        expectedUpdatedAt: user.updatedAt,
      });
    });

    const [path, options] = mockedApiClient.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(path).toBe(`/iam/platform/users/${user.id}`);
    expect(options?.method).toBe("PATCH");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token");
    expect(headers.get("X-Request-ID")).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      fullName: "Updated Operator",
      avatarUrl: "https://cdn.example.test/operator.png",
      expectedUpdatedAt: user.updatedAt,
    });
    expect(invalidate).toHaveBeenCalled();
    cookie.mockRestore();
  });

  it("archives a Platform user through the explicit archive route with CAS and no retry", async () => {
    const cookie = vi
      .spyOn(document, "cookie", "get")
      .mockReturnValue("__Host-csrf=csrf-test-token");
    mockedApiClient.mockResolvedValue({
      ...user,
      status: "SUSPENDED",
      archivedAt: "2026-10-16T02:00:00.000Z",
      updatedAt: "2026-10-16T02:00:00.000Z",
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePlatformArchiveUserMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: user.id,
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      });
    });

    const [path, options] = mockedApiClient.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(path).toBe(`/iam/platform/users/${user.id}/archive`);
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test-token");
    expect(headers.get("X-Request-ID")).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      expectedUpdatedAt: user.updatedAt,
      reasonCode: "ACCESS_REVIEW",
    });
    expect(invalidate).toHaveBeenCalled();
    cookie.mockRestore();
  });

  it("loads paginated organization memberships from the user-scoped Platform route", async () => {
    mockedApiClient.mockResolvedValue({
      data: [
        {
          organizationId: "751a2b3c4d5e6f7a8b9c0d21",
          organizationName: "North Star",
          organizationSlug: "north-star",
          status: "ACTIVE",
          organizationRoles: ["ADMIN"],
        },
      ],
      pagination: { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 },
    });
    const { result } = renderHook(
      () => usePlatformUserOrganizationsQuery(user.id, true, 2),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      `/iam/platform/users/${user.id}/organizations?page=2&pageSize=25`,
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data?.data[0]?.organizationSlug).toBe("north-star");
  });

  it("loads session detail from the exact user and session path and strips extra fields", async () => {
    mockedApiClient.mockResolvedValue({
      id: "session-1",
      userId: user.id,
      context: "PLATFORM",
      organizationId: null,
      status: "ACTIVE",
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T01:00:00.000Z",
      expiresAt: "2026-10-17T00:00:00.000Z",
      refreshTokenHash: "must-not-be-returned",
    });
    const { result } = renderHook(
      () => usePlatformUserSessionQuery(user.id, "session-1", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      `/iam/platform/users/${user.id}/sessions/session-1`,
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data).not.toHaveProperty("refreshTokenHash");
  });

  it("loads incident detail from the Platform detail route", async () => {
    mockedApiClient.mockResolvedValue({
      id: "651a2b3c4d5e6f7a8b9c0d22",
      title: "Queue delay",
      severity: "HIGH",
      status: "OPEN",
      affectedServiceId: "iam",
      version: 1,
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
      createdBy: user.id,
      updatedBy: user.id,
      acknowledgedAt: null,
      resolvedAt: null,
      internalPayload: "must-not-be-returned",
    });
    const incidentId = "651a2b3c4d5e6f7a8b9c0d22";
    const { result } = renderHook(
      () => usePlatformIncidentQuery(incidentId, true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      `/iam/platform/incidents/${incidentId}`,
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.data).not.toHaveProperty("internalPayload");
  });

  it("accepts redacted incident history notes up to the API limit", async () => {
    const incidentId = "651a2b3c4d5e6f7a8b9c0d22";
    const note = "a".repeat(2000);
    mockedApiClient.mockResolvedValue({
      data: [
        {
          id: "751a2b3c4d5e6f7a8b9c0d22",
          incidentId,
          action: "NOTE_ADDED",
          fromStatus: "OPEN",
          toStatus: "OPEN",
          version: 2,
          actorUserId: user.id,
          occurredAt: "2026-10-16T01:00:00.000Z",
          note,
        },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });

    const { result } = renderHook(
      () => usePlatformIncidentHistoryQuery(incidentId, true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data[0]?.note).toHaveLength(2000);
  });

  it("normalizes the exact BE C02AdminInvitation payload (invitedEmail without membershipId/targetUserId/membershipVersion)", async () => {
    const organizationId = "651a2b3c4d5e6f7a8b9c0d23";
    mockedApiClient.mockResolvedValue({
      data: [
        {
          id: "751a2b3c4d5e6f7a8b9c0d23",
          organizationId,
          status: "PENDING",
          version: 1,
          expiresAt: "2026-10-23T00:00:00.000Z",
          createdAt: "2026-10-16T00:00:00.000Z",
          invitedEmail: "invitee@example.test",
        },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });

    const { result } = renderHook(
      () => usePlatformOrganizationInvitationsQuery(organizationId, true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data[0]).toEqual({
      id: "751a2b3c4d5e6f7a8b9c0d23",
      organizationId,
      status: "PENDING",
      version: 1,
      expiresAt: "2026-10-23T00:00:00.000Z",
      createdAt: "2026-10-16T00:00:00.000Z",
      invitedEmail: "invitee@example.test",
      email: "invitee@example.test",
    });
  });
});

describe("Platform service liveness contract", () => {
  it.each(["ALIVE", "UNAVAILABLE", "AVAILABLE"])(
    "validates service liveness %s independently from availability",
    async (liveness) => {
      mockedApiClient.mockReset();
      mockedApiClient.mockResolvedValue({
        data: [
          {
            id: "jira",
            name: "Jira Integration",
            status: "READY",
            availability: "AVAILABLE",
            liveness,
            readiness: "READY",
            dependencies: { mongodb: "AVAILABLE", redis: "AVAILABLE" },
            lastCheckedAt: "2026-10-28T00:00:00.000Z",
            diagnosticsSummary:
              "Service and configured dependencies are ready.",
          },
        ],
      });
      const { result } = renderHook(() => usePlatformServicesQuery(true), {
        wrapper: createWrapper(),
      });
      if (liveness === "AVAILABLE") {
        await waitFor(() => expect(result.current.isError).toBe(true));
      } else {
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.[0]?.liveness).toBe(liveness);
      }
    },
  );
});
