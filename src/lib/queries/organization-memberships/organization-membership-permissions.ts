import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";

/**
 * Evaluates whether the current authenticated identity has effective permission
 * to read organization memberships.
 *
 * If effective permissions are exposed on the session/user object, that takes precedence.
 * Otherwise, falls back to the current organization role (ADMIN).
 */
export function canReadOrganizationMemberships(
  user: CurrentUserResponse | null | undefined,
): boolean {
  if (!user || user.context === "ACCOUNT" || !user.organizationId) {
    return false;
  }
  const permissions = (user as { permissions?: readonly string[] }).permissions;
  if (Array.isArray(permissions)) {
    return permissions.includes("organization.memberships.read");
  }
  return Array.isArray(user.roles) && user.roles.includes("ADMIN");
}

/**
 * Evaluates whether the current authenticated identity has effective permission
 * to manage organization memberships (invite, suspend, cancel).
 *
 * If effective permissions are exposed on the session/user object, that takes precedence.
 * Otherwise, falls back to the current organization role (ADMIN).
 */
export function canManageOrganizationMemberships(
  user: CurrentUserResponse | null | undefined,
): boolean {
  if (!user || user.context === "ACCOUNT" || !user.organizationId) {
    return false;
  }
  const permissions = (user as { permissions?: readonly string[] }).permissions;
  if (Array.isArray(permissions)) {
    return permissions.includes("organization.memberships.manage");
  }
  return Array.isArray(user.roles) && user.roles.includes("ADMIN");
}
