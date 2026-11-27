import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, setExpectedOrganizationId } from "@/lib/api-client";
import { clearAllClientSessionCaches } from "@/lib/session-cleanup";
import {
  csrfHeaders,
  usePlatformLogoutMutation,
} from "@/lib/queries/platform/usePlatformConsole";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: vi.fn(),
    setExpectedOrganizationId: vi.fn(),
  };
});

vi.mock("@/lib/session-cleanup", () => ({
  clearAllClientSessionCaches: vi.fn(),
}));

const mockedApiClient = vi.mocked(apiClient);
const mockedSetExpectedOrgId = vi.mocked(setExpectedOrganizationId);
const mockedClearCaches = vi.mocked(clearAllClientSessionCaches);

describe("Platform console CSRF & logout cleanup", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedSetExpectedOrgId.mockReset();
    mockedClearCaches.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodes URL-encoded CSRF cookie values via shared getCsrfToken helper", () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-csrf=token%2Bwith%2Fspecial%3Dchars",
    );
    const headers = csrfHeaders("idem-1");
    expect(headers.get("X-CSRF-Token")).toBe("token+with/special=chars");
    expect(headers.get("Idempotency-Key")).toBe("idem-1");
  });

  it("clears expected organization ID and all client session caches on platform logout", async () => {
    mockedApiClient.mockResolvedValue(undefined);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const clearSpy = vi.spyOn(client, "clear");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePlatformLogoutMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockedSetExpectedOrgId).toHaveBeenCalledWith(null);
    expect(mockedClearCaches).toHaveBeenCalledWith({ clearStorage: true });
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
