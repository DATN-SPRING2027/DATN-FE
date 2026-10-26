import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import { useProjectManagementAccess } from "./useProjectSettings";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

function mount(active = true, projectId = "project-a") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(
    () => useProjectManagementAccess("org-a", projectId, active),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

it("denies Settings when both scoped endpoints reject a Member", async () => {
  vi.mocked(apiClient).mockRejectedValue(
    new ApiError(403, "FORBIDDEN", "Denied"),
  );
  const { result } = mount();
  expect(result.current.canAccessSettings).toBe(false);
  await waitFor(() => expect(result.current.isPending).toBe(false));
  expect(result.current.canAccessSettings).toBe(false);
  expect(result.current.error).toBeNull();
});

it("allows a Manager's visibility controls without granting Project metadata edits", async () => {
  vi.mocked(apiClient).mockImplementation(async (path) => {
    if (path.endsWith("/settings-access"))
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return { canManageVisibility: true };
  });
  const { result } = mount();
  await waitFor(() => expect(result.current.canAccessSettings).toBe(true));
  expect(result.current.canUpdateProject).toBe(false);
  expect(result.current.canManageVisibility).toBe(true);
});

it.each(["denied", "unavailable"])(
  "removes a previously granted Leader permission after a %s recheck",
  async (outcome) => {
    vi.mocked(apiClient).mockImplementation(async (path) => {
      if (path.endsWith("/visibility"))
        throw new ApiError(403, "FORBIDDEN", "Denied");
      return { canUpdateProject: true };
    });
    const { result } = mount();
    await waitFor(() => expect(result.current.canUpdateProject).toBe(true));
    vi.mocked(apiClient).mockRejectedValue(
      outcome === "denied"
        ? new ApiError(403, "FORBIDDEN", "Revoked")
        : new Error("Network unavailable"),
    );
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.canAccessSettings).toBe(false));
  },
);

it("does not reuse permission from another Project or an inactive Project", async () => {
  vi.mocked(apiClient).mockResolvedValue({ canUpdateProject: true });
  const inactive = mount(false);
  expect(inactive.result.current.canAccessSettings).toBe(false);
  vi.mocked(apiClient).mockRejectedValue(
    new ApiError(403, "FORBIDDEN", "Denied"),
  );
  const other = mount(true, "project-b");
  await waitFor(() => expect(other.result.current.isPending).toBe(false));
  expect(other.result.current.canAccessSettings).toBe(false);
});
