import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useVerificationInboxQuery,
  useVerifyProposalMutation,
} from "./useVerification";

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

describe("verification query hooks", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("fetches pending verification inbox items", async () => {
    mockedApiClient.mockResolvedValue([
      {
        id: "prop-1",
        title: "Database Migration Guide",
        summary: "Step by step DB migration",
        sourceType: "doc",
        authorId: "user-1",
        status: "pending",
        createdAt: "2026-09-21T00:00:00Z",
      },
    ]);

    const { result } = renderHook(() => useVerificationInboxQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(1);
    expect(mockedApiClient).toHaveBeenCalledWith("/verification/inbox");
  });

  it("submits approval decision via useVerifyProposalMutation", async () => {
    mockedApiClient.mockResolvedValue({
      id: "prop-1",
      title: "Database Migration Guide",
      summary: "Step by step DB migration",
      sourceType: "doc",
      authorId: "user-1",
      status: "approved",
      createdAt: "2026-09-21T00:00:00Z",
    });

    const { result } = renderHook(() => useVerifyProposalMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        proposalId: "prop-1",
        decision: "approved",
        reason: "Looks accurate and well tested",
      })
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/verification/proposals/prop-1/decision",
      {
        method: "POST",
        body: JSON.stringify({
          decision: "approved",
          reason: "Looks accurate and well tested",
        }),
      }
    );
  });
});
