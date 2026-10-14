import type {
  AdminInvitation,
  OrganizationMembership,
} from "./organization-memberships.contract";

export type MembershipAction = "suspend";
export type InvitationAction = "resend" | "cancel";

/** Returns presentation affordances only. The server still authorizes every command. */
export function getMembershipActions(
  membership: OrganizationMembership,
  actorId: string,
): readonly MembershipAction[] {
  if (membership.status === "ACTIVE" && membership.user !== null && membership.userId !== actorId) {
    return ["suspend"];
  }
  return [];
}

/** Invitation lifecycle is separate from membership status and needs a fresh invitation row. */
export function getInvitationActions(
  invitation: AdminInvitation,
): readonly InvitationAction[] {
  return invitation.status === "PENDING" ? ["resend", "cancel"] : [];
}
