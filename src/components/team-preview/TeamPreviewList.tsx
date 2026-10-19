"use client";

import { useTranslations } from "next-intl";
import TeamActionMenu from "@/components/teams/TeamActionMenu";
import TeamDirectoryTable, {
  type TeamDirectoryStatus,
} from "@/components/teams/TeamDirectoryTable";
import type { TeamPreviewItem } from "./team-preview.model";
import { useState } from "react";

export default function TeamPreviewList({
  items,
  onAction,
  onCreate,
  emptyMessage,
}: {
  items: readonly TeamPreviewItem[];
  onCreate: () => void;
  emptyMessage?: string;
  onAction: (kind: "view" | "delete", team: TeamPreviewItem) => void;
}) {
  const t = useTranslations("teamPreview");
  const [status, setStatus] = useState<TeamDirectoryStatus>("ACTIVE");
  const visibleItems = items.filter(
    (team) => status === "ALL" || team.status === status,
  );

  return (
    <TeamDirectoryTable
      items={visibleItems.map((team) => ({
        id: team.fixtureKey,
        name: team.name,
        code: team.code,
        status: team.status,
      }))}
      status={status}
      onStatusChange={setStatus}
      totalItems={visibleItems.length}
      createAction={{ label: t("create"), onClick: onCreate }}
      copy={{
        statusFilter: t("status"),
        statuses: {
          ACTIVE: t("ACTIVE"),
          ARCHIVED: t("ARCHIVED"),
          ALL: t("ALL"),
        },
        teamCount: (count) => t("teamCount", { count }),
        headers: {
          name: t("name"),
          code: t("code"),
          status: t("status"),
          actions: t("actions"),
        },
        tableCaption: t("directory"),
        emptyMessage: emptyMessage ?? t("emptyFilter"),
        paginationLabel: t("pagination"),
        pageLabel: (page) => t("page", { page }),
        pageSummary: (page, totalPages) =>
          t("pageSummary", { page, totalPages }),
        previous: t("previous"),
        next: t("next"),
      }}
      renderActions={(row) => {
        const team = visibleItems.find((item) => item.fixtureKey === row.id)!;
        return (
          <TeamActionMenu
            triggerLabel={t("actionsFor", { name: team.name })}
            actions={[
              {
                kind: "view",
                label: t("view"),
                accessibleLabel: t("viewNamed", { name: team.name }),
              },
              {
                kind: "delete",
                label: t("delete"),
                accessibleLabel: t("deleteNamed", { name: team.name }),
                destructive: true,
              },
            ]}
            onAction={(kind) => onAction(kind as "view" | "delete", team)}
          />
        );
      }}
    />
  );
}
