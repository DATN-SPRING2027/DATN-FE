import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  createIdempotencyKey,
  inviteOrganizationMember,
  listOrganizationMemberships,
  suspendOrganizationMembership,
} from "./organization-memberships.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string | undefined, message: string) { super(message); }
  },
}));

const orgId = "0123456789abcdef01234567";
const membershipId = "1123456789abcdef01234567";

describe("Organization membership API service", () => {
  const api = vi.mocked(apiClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests only the accepted Organization membership fields and status filter", async () => {
    api.mockResolvedValue({
      data: [],
      pagination: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    await listOrganizationMemberships(orgId, { page: 2, pageSize: 20, status: "SUSPENDED" });
    expect(api).toHaveBeenCalledWith(
      `/iam/organizations/${orgId}/memberships?page=2&pageSize=20&status=SUSPENDED`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("sends the accepted invitation body, CSRF, and idempotency headers", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    api.mockResolvedValue({
      operationId: "5123456789abcdef01234567",
      membership: {
        id: membershipId,
        organizationId: orgId,
        userId: "2123456789abcdef01234567",
        status: "PENDING_INVITE",
        version: 1,
      },
    });
    await inviteOrganizationMember(orgId, { email: "member@example.com", reasonCode: "ACCESS_REQUEST" }, "0123456789abcdef");
    const [path, options] = api.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/iam/organizations/${orgId}/invitations`);
    expect(JSON.parse(String(options.body))).toEqual({ email: "member@example.com", reasonCode: "ACCESS_REQUEST" });
    expect(new Headers(options.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe("0123456789abcdef");
  });

  it("does not send mutation requests without the readable CSRF cookie", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
    await expect(inviteOrganizationMember(orgId, { email: "member@example.com", reasonCode: "ACCESS_REQUEST" }, "0123456789abcdef"))
      .rejects.toMatchObject({ status: 403, code: "AUTH_CSRF_INVALID" });
    expect(api).not.toHaveBeenCalled();
  });

  it("uses expected versions for suspension and validates resource identifiers", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    api.mockResolvedValue({
      operationId: "5123456789abcdef01234567",
      membership: { id: membershipId, organizationId: orgId, userId: "2123456789abcdef01234567", status: "SUSPENDED", version: 4 },
    });
    await suspendOrganizationMembership(orgId, membershipId, { expectedMembershipVersion: 3, reasonCode: "ACCESS_REVIEW" }, "0123456789abcdef");
    expect(JSON.parse(String((api.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ expectedMembershipVersion: 3, reasonCode: "ACCESS_REVIEW" });
    await expect(listOrganizationMemberships("bad-id", { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(ApiError);
  });

  it("creates idempotency keys accepted by the wire contract", () => {
    expect(createIdempotencyKey()).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
  });
});
