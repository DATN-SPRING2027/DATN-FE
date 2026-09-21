import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useBackendHealthQuery,
  useBackendMutation,
} from "./backend";

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

describe("backend query layer", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("loads backend health through TanStack Query", async () => {
    mockedApiClient.mockResolvedValue({ status: "ok" });

    const { result } = renderHook(() => useBackendHealthQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual({ status: "ok" }));
    expect(mockedApiClient).toHaveBeenCalledWith("/health");
  });

  it("serializes mutation payloads through the shared API client", async () => {
    mockedApiClient.mockResolvedValue({ id: "project-1" });

    const { result } = renderHook(
      () => useBackendMutation<{ id: string }, { name: string }>(),
      { wrapper: createWrapper() },
    );

    await act(() =>
      result.current.mutateAsync({
        endpoint: "/projects",
        body: { name: "Continuum" },
      }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Continuum" }),
    });
  });
});
