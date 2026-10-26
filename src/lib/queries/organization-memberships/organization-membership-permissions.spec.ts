import { expect, it } from "vitest";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import {
  canReadOrganizationMemberships,
  canManageOrganizationMemberships,
} from "./organization-membership-permissions";

const manager = {
  id: "user-a",
  email: "a@example.test",
  name: "Actor",
  context: "ORGANIZATION" as const,
  organizationId: "org-a",
  roles: ["ADMIN"],
};

it.each([
  ["MEMBER"],
  ["TEAM_LEADER"],
  ["LEADER"],
  ["MANAGER"],
  ["PLATFORM_OPERATOR"],
])("does not grant organization management to %s", (role) => {
  const user = { ...manager, roles: [role] };
  expect(canReadOrganizationMemberships(user)).toBe(false);
  expect(canManageOrganizationMemberships(user)).toBe(false);
});

it("requires organization context and a technical ADMIN role", () => {
  expect(canManageOrganizationMemberships(manager)).toBe(true);
  expect(
    canReadOrganizationMemberships({ ...manager, context: undefined }),
  ).toBe(true);
  expect(canManageOrganizationMemberships(undefined)).toBe(false);
  expect(
    canManageOrganizationMemberships({ ...manager, organizationId: "" }),
  ).toBe(false);
  expect(
    canManageOrganizationMemberships({
      ...manager,
      context: "PLATFORM",
    } as unknown as CurrentUserResponse),
  ).toBe(false);
  expect(
    canManageOrganizationMemberships({
      ...manager,
      context: "ACCOUNT",
    } as unknown as CurrentUserResponse),
  ).toBe(false);
});
