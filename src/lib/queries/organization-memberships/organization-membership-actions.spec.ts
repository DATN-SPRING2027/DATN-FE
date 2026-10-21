import { describe, expect, it } from "vitest";
import {
  getInvitationActions,
  getMembershipActions,
} from "./organization-membership-actions";
import type { AdminInvitation, OrganizationMembership } from "./organization-memberships.contract";

const member = (status: OrganizationMembership["status"], hasUser = true): OrganizationMembership => ({
  id: "1123456789abcdef01234567",
  organizationId: "0123456789abcdef01234567",
  userId: "2123456789abcdef01234567",
  status,
  version: 1,
  roleCode: "MEMBER",
  roleVersion: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  user: hasUser ? { id: "2123456789abcdef01234567", fullName: "Member", email: "m@example.com", accountStatus: "ACTIVE" } : null,
});

const invitation = (status: AdminInvitation["status"]): AdminInvitation => ({
  id: "3123456789abcdef01234567",
  organizationId: "0123456789abcdef01234567",
  status,
  version: 1,
  membershipVersion: 1,
  expiresAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  invitedEmail: "m@example.com",
});

describe("documented Organization lifecycle affordances", () => {
  it.each([
    ["PENDING_INVITE", []],
    ["ACTIVE", ["suspend"]],
    ["SUSPENDED", []],
    ["REMOVED", []],
  ] as const)("maps %s membership state to approved actions", (status, expected) => {
    expect(getMembershipActions(member(status), "9123456789abcdef01234567")).toEqual(expected);
  });

  it("does not present a command when membership user details are unavailable", () => {
    expect(getMembershipActions(member("ACTIVE", false), "9123456789abcdef01234567")).toEqual([]);
  });

  it("does not offer self-suspension", () => {
    expect(getMembershipActions(member("ACTIVE"), "2123456789abcdef01234567")).toEqual([]);
  });

  it("offers invitation actions only while the accepted invitation is pending", () => {
    expect(getInvitationActions(invitation("PENDING"))).toEqual(["resend", "cancel"]);
    expect(getInvitationActions(invitation("ACCEPTED"))).toEqual([]);
  });
});
