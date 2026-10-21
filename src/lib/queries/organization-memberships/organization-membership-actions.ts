import type {
  AdminInvitation,
  OrganizationMembership,
} from "./organization-memberships.contract";

export type MembershipAction = "suspend" | "resume" | "remove";
export type InvitationAction = "resend" | "cancel";

/** Returns presentation affordances only. The server still authorizes every command. */
export function getMembershipActions(
  membership: OrganizationMembership,
  actorId: string,
): readonly MembershipAction[] {
  if (membership.user === null || membership.userId === actorId) {
    return [];
  }
  if (membership.status === "ACTIVE") {
    return ["suspend", "remove"];
  }
  if (membership.status === "SUSPENDED") {
    return ["resume", "remove"];
  }
  return [];
}

/** Invitation lifecycle is separate from membership status and needs a fresh invitation row. */
export function getInvitationActions(
  invitation: AdminInvitation,
): readonly InvitationAction[] {
  return invitation.status === "PENDING" ? ["resend", "cancel"] : [];
}
