import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";

function isOrganizationAdmin(user: CurrentUserResponse | null | undefined): boolean {
  if (!user || (user.context !== undefined && user.context !== "ORGANIZATION") || !user.organizationId) {
    return false;
  }
  return Array.isArray(user.roles) && user.roles.includes("ADMIN");
}

/** Mirrors the backend contract: only the current Organization's ADMIN role may read memberships. */
export function canReadOrganizationMemberships(
  user: CurrentUserResponse | null | undefined,
): boolean {
  return isOrganizationAdmin(user);
}

/** Mirrors the backend contract: only the current Organization's ADMIN role may manage memberships. */
export function canManageOrganizationMemberships(
  user: CurrentUserResponse | null | undefined,
): boolean {
  return isOrganizationAdmin(user);
}
