import { describe, expect, it } from "vitest";
import {
  parseAdminInvitationPage,
  parseMembershipPage,
  parseMutationAck,
} from "./organization-memberships.contract";

const orgId = "0123456789abcdef01234567";
const membership = (status: string) => ({
  id: "1123456789abcdef01234567",
  organizationId: orgId,
  userId: "2123456789abcdef01234567",
  status,
  version: 3,
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

  it("validates invitation association and scope", () => {
    const invitation = {
      id: "4123456789abcdef01234567",
      membershipId: "1123456789abcdef01234567",
      organizationId: orgId,
      status: "PENDING",
      version: 2,
      expiresAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      membershipVersion: 3,
      targetUserId: "2123456789abcdef01234567",
      email: "member@example.com",
    };
    expect(parseAdminInvitationPage({ data: [invitation], pagination }, orgId).data[0]?.membershipId).toBe(membership("ACTIVE").id);
    expect(() => parseAdminInvitationPage({ data: [{ ...invitation, organizationId: "3123456789abcdef01234567" }], pagination }, orgId)).toThrow();
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
    expect(parseMutationAck(ack, orgId).membership.status).toBe("SUSPENDED");
    expect(() => parseMutationAck({ ...ack, membership: { ...ack.membership, organizationId: "3123456789abcdef01234567" } }, orgId)).toThrow();
    expect(() => parseMutationAck({ ...ack, membership: { ...ack.membership, status: "REMOVED" } }, orgId)).not.toThrow();
  });
});
