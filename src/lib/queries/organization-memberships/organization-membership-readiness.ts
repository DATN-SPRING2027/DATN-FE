/**
 * Runtime readiness from the accepted C-02 decision (2026-10-12).
 * These gates control whether the UI offers a contract operation; they never
 * grant or infer actor authorization. The server remains authoritative.
 */
type ReadinessStatus = "READY" | "BLOCKED";
type Readiness = Readonly<{ status: ReadinessStatus; gates: readonly string[] }>;

export const organizationMembershipReadiness: Readonly<{
  invitationCommands: Readiness;
  recipientAcceptance: Readiness;
}> = {
  invitationCommands: {
    status: "BLOCKED",
    gates: ["A7_NOTIFICATION_CONTRACT_PROVIDER", "A8_COORDINATED_CUTOVER"],
  },
  recipientAcceptance: {
    status: "BLOCKED",
    gates: ["A7_LEGACY_OR_ORPHAN_RIGHTS_ACTIVATION_PROOF", "A8_COORDINATED_CUTOVER"],
  },
};
