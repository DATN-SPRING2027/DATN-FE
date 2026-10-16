import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useCreatePlatformOrganizationMutation } from "./usePlatformConsole";

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
