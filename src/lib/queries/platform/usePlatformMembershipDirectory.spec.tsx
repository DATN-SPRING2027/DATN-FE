import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  usePlatformMembershipDirectoryQuery,
  type PlatformMembershipFilters,
} from "./usePlatformConsole";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const organizationId = "651a2b3c4d5e6f7a8b9c0d21";
const row = {
  id: "751a2b3c4d5e6f7a8b9c0d21",
  organizationId,
  userId: "851a2b3c4d5e6f7a8b9c0d21",
  status: "ACTIVE",
  version: 2,
  hasPersistedVersion: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  user: {
    id: "851a2b3c4d5e6f7a8b9c0d21",
    email: "member@example.test",
    fullName: "Member",
    accountStatus: "ACTIVE",
  },
  organization: { id: organizationId, name: "North Star", slug: "north-star" },
  organizationRoles: ["MEMBER"],
};
const filters: PlatformMembershipFilters = {
  page: 1,
  search: "",
  status: "",
  organizationId: "",
};
const clients: QueryClient[] = [];
function setup(input = filters, enabled = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePlatformMembershipDirectoryQuery(input, enabled), {
    wrapper,
  });
}
function respond(value: unknown = row) {
  vi.mocked(apiClient).mockResolvedValue({
    data: [value],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  });
}
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.mocked(apiClient).mockReset();
});

describe("Platform global membership directory", () => {
  it("does not request membership data without read permission", () => {
    setup(filters, false);
    expect(apiClient).not.toHaveBeenCalled();
  });
  it("queries the global API with encoded server filters and safely projects metadata", async () => {
    respond({
      ...row,
      tokenHash: "secret",
      organization: { ...row.organization, privateSettings: "secret" },
    });
    const { result } = setup({
      ...filters,
      search: "A&B",
      organizationId,
      status: "ACTIVE",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [path, options] = vi.mocked(apiClient).mock.calls[0];
    const url = new URL(String(path), "http://localhost");
    expect(url.pathname).toBe("/iam/platform/memberships");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      pageSize: "10",
      search: "A&B",
      status: "ACTIVE",
      organizationId,
    });
    expect(options?.cache).toBe("no-store");
    expect(result.current.data?.data[0]).toEqual(row);
  });
  it.each([
    {
      ...row,
      organization: { ...row.organization, id: "651a2b3c4d5e6f7a8b9c0d22" },
    },
    { ...row, organizationId: "invalid" },
    { ...row, organizationId: "651a2b3c4d5e6f7a8b9c0d22" },
  ])(
    "rejects malformed or cross-scope organization metadata",
    async (value) => {
      respond(value);
      const { result } = setup({ ...filters, organizationId });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
      expect(apiClient).toHaveBeenCalledTimes(1);
    },
  );
});
