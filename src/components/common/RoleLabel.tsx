"use client";

import { useTranslations } from "next-intl";

export type RoleLabelKey =
  | "platformOperator"
  | "organizationAdmin"
  | "teamLeader"
  | "member"
  | "unknown";

export function getRoleLabelKey(roleCode: string): RoleLabelKey {
  switch (roleCode) {
    case "PLATFORM_OPERATOR":
      return "platformOperator";
    case "ADMIN":
      return "organizationAdmin";
    case "TEAM_LEADER":
    case "LEADER":
      return "teamLeader";
    case "MEMBER":
      return "member";
    default:
      return "unknown";
  }
}

export function useRoleDisplayLabel() {
  const t = useTranslations("roleLabels");
  return (roleCode: string) => t(getRoleLabelKey(roleCode));
}

export default function RoleLabel({ roleCode }: { roleCode: string }) {
  const roleLabel = useRoleDisplayLabel();
  return <span>{roleLabel(roleCode)}</span>;
}
