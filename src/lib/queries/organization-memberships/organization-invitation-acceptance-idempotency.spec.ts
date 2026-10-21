import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOrganizationInvitationAcceptanceKey,
  getOrganizationInvitationAcceptanceKey,
} from "./organization-invitation-acceptance-idempotency";

const createKey = vi.hoisted(() => vi.fn());
vi.mock("./organization-memberships.service", () => ({ createIdempotencyKey: createKey }));

const invitationId = "951a2b3c4d5e6f7a8b9c0d1e";

describe("shared invitation acceptance idempotency", () => {
  beforeEach(() => {
    sessionStorage.clear();
    createKey.mockReset().mockReturnValue("0123456789abcdef");
    clearOrganizationInvitationAcceptanceKey(`organizationInvitationAccept:${invitationId}:4`);
    clearOrganizationInvitationAcceptanceKey(`organizationInvitationAccept:${invitationId}:5`);
  });

  it("reuses one key for the same invitation and version across acceptance entry points", () => {
    const emailPage = getOrganizationInvitationAcceptanceKey(invitationId, 4);
    const onboardingInbox = getOrganizationInvitationAcceptanceKey(invitationId, 4);

    expect(emailPage).toEqual(onboardingInbox);
    expect(emailPage).toEqual({
      storageKey: `organizationInvitationAccept:${invitationId}:4`,
      idempotencyKey: "0123456789abcdef",
    });
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it("uses a new key when the invitation version changes", () => {
    createKey.mockReturnValueOnce("0123456789abcdef").mockReturnValueOnce("1123456789abcdef");

    const current = getOrganizationInvitationAcceptanceKey(invitationId, 4);
    const refreshed = getOrganizationInvitationAcceptanceKey(invitationId, 5);

    expect(refreshed.storageKey).not.toBe(current.storageKey);
    expect(refreshed.idempotencyKey).not.toBe(current.idempotencyKey);
    expect(createKey).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid invitation identities before creating a key", () => {
    expect(() => getOrganizationInvitationAcceptanceKey("not-an-id", 4)).toThrow();
    expect(() => getOrganizationInvitationAcceptanceKey(invitationId, 0)).toThrow();
    expect(createKey).not.toHaveBeenCalled();
  });

  it("does not send an operation when the stable retry key cannot be persisted", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => getOrganizationInvitationAcceptanceKey(invitationId, 4)).toThrow(
      "Invitation acceptance could not be safely retried.",
    );
    expect(sessionStorage.getItem(`organizationInvitationAccept:${invitationId}:4`)).toBeNull();
    setItem.mockRestore();
  });
});
