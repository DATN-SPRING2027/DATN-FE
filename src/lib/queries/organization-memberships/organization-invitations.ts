import { apiClient, ApiError } from "@/lib/api-client";
import { parseMutationAck, type OrganizationMutationAck } from "./organization-memberships.contract";

export type ResolvedOrganizationInvitation = Readonly<{
  id: string;
  organizationId: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED" | "SUPERSEDED";
  version: number;
  expiresAt: string;
  createdAt: string;
  invitedEmail: string;
  organizationName: string;
}>;

const idPattern = /^[a-f\d]{24}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43,128}$/;

function parseInvitationDetail(value: unknown): ResolvedOrganizationInvitation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidResponse();
  const root = value as Record<string, unknown>;
  const raw = root.invitation;
  if (Object.keys(root).length !== 1 || typeof raw !== "object" || raw === null || Array.isArray(raw)) throw invalidResponse();
  const invitation = raw as Record<string, unknown>;
  if (
    Object.keys(invitation).length !== 8 ||
    typeof invitation.id !== "string" || !idPattern.test(invitation.id) ||
    typeof invitation.organizationId !== "string" || !idPattern.test(invitation.organizationId) ||
    !["PENDING", "ACCEPTED", "CANCELLED", "EXPIRED", "SUPERSEDED"].includes(String(invitation.status)) ||
    !Number.isSafeInteger(invitation.version) || Number(invitation.version) < 1 ||
    typeof invitation.expiresAt !== "string" || !Number.isFinite(Date.parse(invitation.expiresAt)) ||
    typeof invitation.createdAt !== "string" || !Number.isFinite(Date.parse(invitation.createdAt)) ||
    typeof invitation.invitedEmail !== "string" || invitation.invitedEmail.length > 254 ||
    typeof invitation.organizationName !== "string"
  ) throw invalidResponse();
  return invitation as ResolvedOrganizationInvitation;
}

function invalidResponse(): ApiError {
  return new ApiError(502, "INVALID_ORGANIZATION_INVITATION_RESPONSE", "The invitation service returned an invalid response");
}

function requireId(value: string): string {
  if (!idPattern.test(value)) throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation identifier");
  return encodeURIComponent(value);
}

function csrfHeaders(idempotencyKey: string): Headers {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw new ApiError(422, "VALIDATION_FAILED", "Invalid idempotency key");
  if (typeof document === "undefined") throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF context is unavailable");
  const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("__Host-csrf="));
  if (!cookie) throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF token is unavailable");
  return new Headers({ "X-CSRF-Token": cookie.slice("__Host-csrf=".length), "Idempotency-Key": idempotencyKey });
}

export async function resolveOrganizationInvitation(token: string): Promise<ResolvedOrganizationInvitation> {
  if (!tokenPattern.test(token)) throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation token");
  return parseInvitationDetail(await apiClient<unknown>("/auth/invitations/resolve", {
    method: "POST",
    body: JSON.stringify({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }));
}

export async function getOrganizationInvitation(invitationId: string): Promise<ResolvedOrganizationInvitation> {
  const invitation = requireId(invitationId);
  return parseInvitationDetail(await apiClient<unknown>(`/auth/invitations/${invitation}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }));
}

export async function acceptOrganizationInvitation(
  invitationId: string,
  organizationId: string,
  expectedInvitationVersion: number,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const invitation = requireId(invitationId);
  if (!Number.isSafeInteger(expectedInvitationVersion) || expectedInvitationVersion < 1) throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation version");
  return parseMutationAck(await apiClient<unknown>(`/auth/invitations/${invitation}/accept`, {
    method: "POST",
    headers: csrfHeaders(idempotencyKey),
    body: JSON.stringify({ expectedInvitationVersion }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }), organizationId);
}

export function invitationReturnTo(invitationId: string): string {
  return `/organization/invitations?invitationId=${encodeURIComponent(requireId(invitationId))}`;
}

export function isSafeInvitationReturnTo(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  try {
    const url = new URL(value, "https://continuum.invalid");
    return url.origin === "https://continuum.invalid" && url.pathname === "/organization/invitations" && idPattern.test(url.searchParams.get("invitationId") ?? "");
  } catch {
    return false;
  }
}
