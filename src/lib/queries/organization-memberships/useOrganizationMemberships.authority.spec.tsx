import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import { useSetOrganizationMembershipRole } from "./useOrganizationMemberships";

vi.mock("./organization-memberships.service", async (original) => ({
  ...(await original<typeof import("./organization-memberships.service")>()),
  setOrganizationMembershipRole: vi.fn().mockResolvedValue({}),
}));

it("invalidates cached identity and Project permission probes after changing an organization role", async () => {
  const client = new QueryClient();
  const keys = [
    authKeys.currentUser(),
    ["project-settings-access", "org-a", "project-a"],
    ["project-visibility-access", "org-a", "project-a"],
    ["projects", "org-a", "detail", "project-a"],
  ];
  for (const key of keys) client.setQueryData(key, { cachedAuthority: true });
  const { result } = renderHook(
    () => useSetOrganizationMembershipRole("actor", "org-a"),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await act(async () => {
    await result.current.mutateAsync({
      input: {
        membershipId: "membership-a",
        roleCode: "MEMBER",
        expectedMembershipVersion: 1,
        expectedRoleVersion: 1,
        reason: "Scope correction",
      },
      idempotencyKey: "test-key",
    });
  });
  for (const key of keys)
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
