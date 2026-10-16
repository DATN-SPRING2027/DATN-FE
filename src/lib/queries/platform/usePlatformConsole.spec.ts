import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { parsePlatformMembershipSuspensionAcknowledgement } from "./usePlatformConsole";

const organizationId = "651a2b3c4d5e6f7a8b9c0d21";
const membershipId = "751a2b3c4d5e6f7a8b9c0d21";
const userId = "851a2b3c4d5e6f7a8b9c0d21";

describe("parsePlatformMembershipSuspensionAcknowledgement", () => {
  it("accepts the safe acknowledgement with an ObjectId operation ID and incremented version", () => {
    expect(parsePlatformMembershipSuspensionAcknowledgement({
      operationId: "951a2b3c4d5e6f7a8b9c0d21",
      membership: { id: membershipId, organizationId, userId, status: "SUSPENDED", version: 3 },
    }, organizationId, membershipId, 2)).toEqual({
      operationId: "951a2b3c4d5e6f7a8b9c0d21",
      membership: { id: membershipId, organizationId, userId, status: "SUSPENDED", version: 3 },
    });
  });

  it.each([
    { operationId: 123, membership: { id: membershipId, organizationId, userId, status: "SUSPENDED", version: 3 } },
    { operationId: "not-an-object-id", membership: { id: membershipId, organizationId, userId, status: "SUSPENDED", version: 3 } },
    { operationId: "951a2b3c4d5e6f7a8b9c0d21", membership: { id: membershipId, organizationId, userId, status: "SUSPENDED", version: 4 } },
    { operationId: "951a2b3c4d5e6f7a8b9c0d21", membership: { id: membershipId, organizationId: "wrong", userId, status: "SUSPENDED", version: 3 } },
    { operationId: "951a2b3c4d5e6f7a8b9c0d21", membership: { id: membershipId, organizationId, userId, status: "ACTIVE", version: 3 } },
  ])("rejects malformed or mismatched acknowledgements", (value) => {
    expect(() => parsePlatformMembershipSuspensionAcknowledgement(value, organizationId, membershipId, 2))
      .toThrowError(ApiError);
  });
});
