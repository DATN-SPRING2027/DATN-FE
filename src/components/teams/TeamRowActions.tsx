"use client";

import { useTranslations } from "next-intl";
import type { Team } from "@/lib/queries/teams/team.contract";
import TeamActionMenu, { type TeamMenuAction } from "./TeamActionMenu";
import type { TeamDialogAction } from "./TeamManagementDialog";

type TeamRowAction = Extract<TeamDialogAction, { teamId: string }>;

export default function TeamRowActions({
  team,
  canManage,
  onAction,
}: {
  team: Team;
  canManage: boolean;
  onAction: (action: TeamDialogAction) => void;
}) {
  const t = useTranslations("teamFoundation");
  const actions: TeamMenuAction[] = [
    {
      kind: "view",
      label: t("view"),
      accessibleLabel: t("viewNamed", { name: team.name }),
    },
    ...(canManage && team.status === "ACTIVE"
      ? [
          {
            kind: "archive",
            label: t("archive"),
            destructive: true,
          },
        ]
      : []),
  ];

  return (
    <TeamActionMenu
      triggerLabel={t("actionsFor", { name: team.name })}
      actions={actions}
      onAction={(kind) =>
        onAction({ kind: kind as TeamRowAction["kind"], teamId: team.id })
      }
    />
  );
}
