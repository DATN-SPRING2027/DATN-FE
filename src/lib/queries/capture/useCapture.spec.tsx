import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  useDailyWorkNotesQuery,
  useSaveWorkNoteMutation,
} from "./useCapture";

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

describe("capture query hooks", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("fetches daily work notes for a given date", async () => {
    mockedApiClient.mockResolvedValue([
      {
        id: "note-1",
        date: "2026-09-21",
        what: "Configured microservice proxies",
        how: "Using Next.js BFF route handlers",
        why: "To securely forward tokens in HttpOnly cookies",
        jiraIssueKey: "CONT-101",
        createdAt: "2026-09-21T08:00:00Z",
      },
    ]);

    const { result } = renderHook(
      () => useDailyWorkNotesQuery("2026-09-21"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(1);
    expect(mockedApiClient).toHaveBeenCalledWith("/work-notes?date=2026-09-21");
  });

  it("saves work notes via useSaveWorkNoteMutation", async () => {
    mockedApiClient.mockResolvedValue({
      id: "note-1",
      date: "2026-09-21",
      what: "Configured microservice proxies",
      how: "Using Next.js BFF route handlers",
      why: "To securely forward tokens in HttpOnly cookies",
      jiraIssueKey: "CONT-101",
      createdAt: "2026-09-21T08:00:00Z",
    });

    const { result } = renderHook(() => useSaveWorkNoteMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        date: "2026-09-21",
        what: "Configured microservice proxies",
        how: "Using Next.js BFF route handlers",
        why: "To securely forward tokens in HttpOnly cookies",
        jiraIssueKey: "CONT-101",
      })
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/work-notes", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-09-21",
        what: "Configured microservice proxies",
        how: "Using Next.js BFF route handlers",
        why: "To securely forward tokens in HttpOnly cookies",
        jiraIssueKey: "CONT-101",
      }),
    });
  });
});
