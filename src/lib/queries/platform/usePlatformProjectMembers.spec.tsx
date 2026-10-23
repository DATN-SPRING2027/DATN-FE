import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { usePlatformProjectMembershipsQuery } from "./usePlatformOperations";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const organizationId = "651a2b3c4d5e6f7a8b9c0d22";
const userId = "651a2b3c4d5e6f7a8b9c0d23";
const member = {
  id: "651a2b3c4d5e6f7a8b9c0d24",
  projectId,
  organizationId,
  userId,
  status: "ACTIVE",
  joinedAt: "2026-10-01T00:00:00.000Z",
  user: {
    id: userId,
    fullName: "Member",
    email: "member@example.test",
    accountStatus: "ACTIVE",
  },
};
const clients: QueryClient[] = [];
function setup(enabled = true, id = projectId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      usePlatformProjectMembershipsQuery(
        id,
        organizationId,
        { page: 1 },
        enabled,
      ),
    { wrapper },
  );
}
function respond(row: unknown) {
  vi.mocked(apiClient).mockResolvedValue({
    data: [row],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  });
}
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.mocked(apiClient).mockReset();
});
describe("Platform Project member projection", () => {
  it("projects allowlisted identity fields and supports missing accounts", async () => {
    respond({
      ...member,
      tokenHash: "private",
      user: { ...member.user, passwordHash: "private" },
    });
    const first = setup();
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(first.result.current.data?.data[0]).toEqual(member);
    first.unmount();
    respond({ ...member, user: null });
    const second = setup();
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(second.result.current.data?.data[0].user).toBeNull();
  });
  it.each([
    { projectId: organizationId },
    { organizationId: projectId },
    { user: { ...member.user, id: projectId } },
    { status: "UNKNOWN" },
    { joinedAt: "invalid" },
    { user: { ...member.user, accountStatus: "UNKNOWN" } },
  ])(
    "rejects malformed or cross-scope membership rows %j",
    async (override) => {
      respond({ ...member, ...override });
      const { result } = setup();
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
    },
  );
  it("does not fetch without read access or a valid project locator", () => {
    setup(false);
    setup(true, "invalid");
    expect(apiClient).not.toHaveBeenCalled();
  });
});
