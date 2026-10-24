import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useProjectQuery } from "./useProjects";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const api = vi.mocked(apiClient);
const projectId = "123456789012345678901234";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => api.mockReset());
afterEach(() => cleanup());

it("reuses fresh project detail data after navigating away and back", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const sharedWrapper = wrapper(client);
  api.mockResolvedValue({
    id: projectId,
    organizationId: "org-1",
    name: "Apollo",
    code: "APOLLO",
    visibility: "PRIVATE",
    status: "ACTIVE",
    createdBy: "user-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });

  const first = renderHook(() => useProjectQuery("org-1", projectId), {
    wrapper: sharedWrapper,
  });
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  first.unmount();

  const second = renderHook(() => useProjectQuery("org-1", projectId), {
    wrapper: sharedWrapper,
  });
  expect(second.result.current.data?.name).toBe("Apollo");
  expect(api).toHaveBeenCalledTimes(1);

  second.unmount();
  client.clear();
});
