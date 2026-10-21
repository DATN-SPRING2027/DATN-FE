import { createIdempotencyKey } from "./organization-memberships.service";

const idempotencyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

export type OrganizationInvitationAcceptanceKey = Readonly<{
  storageKey: string;
  idempotencyKey: string;
}>;

function storageKeyFor(invitationId: string, invitationVersion: number): string {
  if (!/^[a-f\d]{24}$/i.test(invitationId) || !Number.isSafeInteger(invitationVersion) || invitationVersion < 1) {
    throw new Error("Invitation acceptance could not be safely retried.");
  }
  return `organizationInvitationAccept:${invitationId}:${invitationVersion}`;
}

export function getOrganizationInvitationAcceptanceKey(
  invitationId: string,
  invitationVersion: number,
): OrganizationInvitationAcceptanceKey {
  const storageKey = storageKeyFor(invitationId, invitationVersion);
  if (typeof window === "undefined") {
    throw new Error("Invitation acceptance could not be safely retried.");
  }

  let existing: string | null;
  try {
    existing = window.sessionStorage.getItem(storageKey);
  } catch {
    throw new Error("Invitation acceptance could not be safely retried.");
  }
  if (!existing || !idempotencyPattern.test(existing)) {
    existing = null;
  }
  if (existing && idempotencyPattern.test(existing)) {
    return { storageKey, idempotencyKey: existing };
  }

  const idempotencyKey = createIdempotencyKey();
  if (!idempotencyPattern.test(idempotencyKey)) {
    throw new Error("Invitation acceptance could not be safely retried.");
  }

  try {
    window.sessionStorage.setItem(storageKey, idempotencyKey);
  } catch {
    throw new Error("Invitation acceptance could not be safely retried.");
  }
  return { storageKey, idempotencyKey };
}

export function clearOrganizationInvitationAcceptanceKey(storageKey: string): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey);
  } catch {
    // Keeping the completed key is safe; a later retry reuses the same operation identity.
  }
}
