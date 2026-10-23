import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, apiClient: vi.fn() };
});

const mockedApiClient = vi.mocked(apiClient);
const permissions: PlatformPermission[] = [
  "platform.users.account.read",
  "platform.projects.project.read",
];

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

describe("Platform operations view model filters", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedApiClient.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });
  });

  it("loads the user directory with All statuses and omits the status query", async () => {
    const { result } = renderHook(
      () =>
        usePlatformOperationsViewModel({
          section: "users",
          permissions,
          operatorId: "651a2b3c4d5e6f7a8b9c0d1e",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith(
        "/iam/platform/users?page=1&pageSize=25",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
    expect(result.current.status).toBe("");
  });

  it("requests the chosen user page size from the Platform API", async () => {
    const { result } = renderHook(
      () =>
        usePlatformOperationsViewModel({
          section: "users",
          permissions,
          operatorId: "651a2b3c4d5e6f7a8b9c0d1e",
        }),
      { wrapper: createWrapper() },
    );
    act(() => result.current.setUserPageSize(15));
    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith(
        "/iam/platform/users?page=1&pageSize=15",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });

  it("sends the chosen organization as the approved user-list filter", async () => {
    const organizationId = "651a2b3c4d5e6f7a8b9c0d21";
    const { result } = renderHook(
      () =>
        usePlatformOperationsViewModel({
          section: "users",
          permissions,
          operatorId: "651a2b3c4d5e6f7a8b9c0d1e",
        }),
      { wrapper: createWrapper() },
    );
    act(() => result.current.setUserOrganizationId(organizationId));
    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith(
        `/iam/platform/users?page=1&pageSize=25&organizationId=${organizationId}`,
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });

  it("does not carry a Projects status filter into the user directory", async () => {
    const { result, rerender } = renderHook(
      ({ section }: { section: "projects" | "users" }) =>
        usePlatformOperationsViewModel({
          section,
          permissions,
          operatorId: "651a2b3c4d5e6f7a8b9c0d1e",
        }),
      {
        initialProps: { section: "projects" as "projects" | "users" },
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.setStatus("PUBLIC"));
    rerender({ section: "users" });

    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith(
        "/iam/platform/users?page=1&pageSize=25",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
    expect(result.current.status).toBe("");
  });
});
