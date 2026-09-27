import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useUpdateUserMutation, useUserQuery, useUsersQuery } from "./useUsers";

vi.mock("@/lib/api-client", () => ({ apiClient: vi.fn() }));
const mockedApiClient = vi.mocked(apiClient);

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("user directory queries", () => {
  beforeEach(() => mockedApiClient.mockReset());

  it("loads a filtered organization page through the BFF", async () => {
    mockedApiClient.mockResolvedValue({ data: [], pagination: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 } });
    const { result } = renderHook(() => useUsersQuery("org-1", { page: 2, pageSize: 20, status: "ACTIVE" }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/users?page=2&pageSize=20&status=ACTIVE");
  });

  it("loads a user detail and patches only the requested fields", async () => {
    mockedApiClient.mockResolvedValue({ id: "user-1", fullName: "Renamed" });
    const Wrapper = wrapper();
    const detail = renderHook(() => useUserQuery("org-1", "user-1"), { wrapper: Wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    const update = renderHook(() => useUpdateUserMutation(), { wrapper: Wrapper });
    await act(() => update.result.current.mutateAsync({ userId: "user-1", fullName: "Renamed" }));
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/users/user-1", { method: "PATCH", body: JSON.stringify({ fullName: "Renamed" }) });
  });
});
