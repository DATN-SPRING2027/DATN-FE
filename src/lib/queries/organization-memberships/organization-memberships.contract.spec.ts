import { describe, expect, it } from "vitest";
import {
  parseAdminInvitationPage,
  parseMembershipPage,
  parseMutationAck,
  parseOrganizationRoleMutationAck,
  parseRecipientInvitationPage,
} from "./organization-memberships.contract";

const orgId = "0123456789abcdef01234567";
const membership = (status: string) => ({
  id: "1123456789abcdef01234567",
  organizationId: orgId,
  userId: "2123456789abcdef01234567",
  status,
  version: 3,
  roleCode: "MEMBER",
  roleVersion: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  user: {
    id: "2123456789abcdef01234567",
    fullName: "A Member",
    email: "member@example.com",
    accountStatus: "ACTIVE",
  },
});
const pagination = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };

describe("Organization membership accepted contract parsers", () => {
  it.each(["PENDING_INVITE", "ACTIVE", "SUSPENDED", "REMOVED"] as const)(
    "accepts the documented %s lifecycle state",
    (status) => {
      expect(parseMembershipPage({ data: [membership(status)], pagination }, orgId).data[0]?.status).toBe(status);
    },
  );

  it("rejects unknown states and cross-Organization rows", () => {
    expect(() => parseMembershipPage({ data: [membership("DELETED")], pagination }, orgId)).toThrow();
    expect(() => parseMembershipPage({ data: [{ ...membership("ACTIVE"), organizationId: "3123456789abcdef01234567" }], pagination }, orgId)).toThrow();
  });

  it("validates email-bound invitation scope without requiring a Membership", () => {
    const invitation = {
      id: "4123456789abcdef01234567",
      organizationId: orgId,
      status: "PENDING",
      version: 2,
      membershipVersion: 3,
      expiresAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      invitedEmail: "member@example.com",
    };
    expect(parseAdminInvitationPage({ data: [invitation], pagination }, orgId).data[0]?.invitedEmail).toBe(invitation.invitedEmail);
    expect(() => parseAdminInvitationPage({ data: [{ ...invitation, organizationId: "3123456789abcdef01234567" }], pagination }, orgId)).toThrow();
  });

  it("parses the recipient invitation page without accepting admin-only fields", () => {
    const invitation = {
      id: "4123456789abcdef01234567",
      organizationId: orgId,
      status: "PENDING",
      version: 2,
      expiresAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      invitedEmail: "member@example.com",
      organizationName: "Continuum",
    };
    expect(
      parseRecipientInvitationPage({ data: [invitation], pagination }).data[0],
    ).toEqual(invitation);
    expect(() =>
      parseRecipientInvitationPage({ data: [{ ...invitation, targetUserId: membership("ACTIVE").userId }], pagination }),
    ).toThrow();
  });

  it("accepts only a well-formed mutation acknowledgement scoped to this Organization", () => {
    const ack = {
      operationId: "5123456789abcdef01234567",
      membership: {
        id: membership("ACTIVE").id,
        organizationId: orgId,
        userId: membership("ACTIVE").userId,
        status: "SUSPENDED",
        version: 4,
      },
    };
    const parsed = parseMutationAck(ack, orgId);
    expect("membership" in parsed && parsed.membership.status).toBe("SUSPENDED");
    expect(() => parseMutationAck({ ...ack, membership: { ...ack.membership, organizationId: "3123456789abcdef01234567" } }, orgId)).toThrow();
    expect(() => parseMutationAck({ ...ack, membership: { ...ack.membership, status: "REMOVED" } }, orgId)).not.toThrow();
  });

  it("requires Organization role metadata and accepts an unassigned role at version zero", () => {
    const value = membership("ACTIVE");
    expect(parseMembershipPage({ data: [{ ...value, roleCode: null, roleVersion: 0 }], pagination }, orgId).data[0]).toMatchObject({
      roleCode: null,
      roleVersion: 0,
    });
    expect(() => parseMembershipPage({ data: [{ ...value, roleCode: "TEAM_LEADER" }], pagination }, orgId)).toThrow();
    expect(() => parseMembershipPage({ data: [{ ...value, roleVersion: -1 }], pagination }, orgId)).toThrow();
  });

  it("validates role mutation acknowledgement role and Organization scope", () => {
    const ack = {
      operationId: "5123456789abcdef01234567",
      membership: {
        id: membership("ACTIVE").id,
        organizationId: orgId,
        userId: membership("ACTIVE").userId,
        status: "ACTIVE",
        version: 3,
      },
      role: { roleCode: "ADMIN", version: 1 },
    };
    expect(parseOrganizationRoleMutationAck(ack, orgId).role).toEqual(ack.role);
    expect(() => parseOrganizationRoleMutationAck({ ...ack, role: { ...ack.role, roleCode: "TEAM_LEADER" } }, orgId)).toThrow();
    expect(() => parseOrganizationRoleMutationAck({ ...ack, membership: { ...ack.membership, organizationId: "3123456789abcdef01234567" } }, orgId)).toThrow();
  });

  it("parses invitation-only mutation acknowledgements", () => {
    const ack = {
      operationId: "5123456789abcdef01234567",
      invitation: {
        id: "4123456789abcdef01234567",
        status: "PENDING",
        version: 1,
        expiresAt: "2026-02-01T00:00:00.000Z",
      },
    };
    expect(parseMutationAck(ack, orgId)).toEqual(ack);
    expect(() => parseMutationAck({ ...ack, membership: {} }, orgId)).toThrow();
  });
});
