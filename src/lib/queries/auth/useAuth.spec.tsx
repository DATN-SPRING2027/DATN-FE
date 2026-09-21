import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
} from "./useAuth";

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

describe("auth query hooks", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("fetches current user via useCurrentUserQuery", async () => {
    mockedApiClient.mockResolvedValue({
      id: "user-1",
      email: "engineer@continuum.ai",
      name: "Lead Engineer",
      organizationId: "org-1",
      roles: ["engineer"],
    });

    const { result } = renderHook(() => useCurrentUserQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe("engineer@continuum.ai");
    expect(mockedApiClient).toHaveBeenCalledWith("/users/me");
  });

  it("authenticates credentials via useLoginMutation", async () => {
    mockedApiClient.mockResolvedValue({
      accessToken: "mock-token",
      tokenType: "Bearer",
      expiresInSeconds: 900,
    });

    const { result } = renderHook(() => useLoginMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        email: "test@continuum.ai",
        password: "password123",
      })
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@continuum.ai",
        password: "password123",
      }),
    });
  });

  it("logs out via useLogoutMutation", async () => {
    mockedApiClient.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogoutMutation(), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync());

    expect(mockedApiClient).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
    });
  });
});
