import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useArchiveWorkItemMutation,
  useCreateWorkItemMutation,
  useWorkItemsQuery,
} from "./useWorkManagement";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
}));

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

describe("Continuum Work queries and mutations", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("does not request project Work Items until a project is selected", () => {
    const { result } = renderHook(() => useWorkItemsQuery(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("loads a filtered page through the BFF using the selected project scope", async () => {
    mockedApiClient.mockResolvedValue({ data: [], pagination: {} });

    const { result } = renderHook(
      () => useWorkItemsQuery("507f1f77bcf86cd799439011", { status: "TODO" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items?page=1&pageSize=20&status=TODO",
    );
  });

  it("uses the requested page and page size for server-side pagination", async () => {
    mockedApiClient.mockResolvedValue({ data: [], pagination: {} });

    const { result } = renderHook(
      () =>
        useWorkItemsQuery("507f1f77bcf86cd799439011", {
          page: 3,
          pageSize: 20,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items?page=3&pageSize=20",
    );
  });

  it("creates an item without trusting caller-provided project or actor fields", async () => {
    mockedApiClient.mockResolvedValue({ id: "item-1" });

    const { result } = renderHook(
      () => useCreateWorkItemMutation("507f1f77bcf86cd799439011"),
      { wrapper: createWrapper() },
    );

    await act(() =>
      result.current.mutateAsync({
        title: "Prepare release",
        description: "Write release notes",
      }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Prepare release",
          description: "Write release notes",
        }),
      },
    );
  });

  it("uses DELETE for archive and accepts a no-content result", async () => {
    mockedApiClient.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useArchiveWorkItemMutation("507f1f77bcf86cd799439011"),
      { wrapper: createWrapper() },
    );

    await act(() => result.current.mutateAsync({ workItemId: "item-1" }));

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items/item-1",
      { method: "DELETE" },
    );
  });
});
