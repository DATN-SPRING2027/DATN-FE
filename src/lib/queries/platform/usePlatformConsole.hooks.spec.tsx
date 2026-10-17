import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useCreatePlatformOrganizationMutation,
  usePlatformMembershipsQuery,
  usePlatformOrganizationQuery,
  usePlatformOrganizationsQuery,
} from "./usePlatformConsole";

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

describe("useCreatePlatformOrganizationMutation", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
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
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
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
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
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
