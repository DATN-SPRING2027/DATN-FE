"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { useTeam } from "@/lib/queries/teams/useTeams";
import type { TeamResource, TeamScope } from "@/lib/queries/teams/team.contract";
import TeamForm from "./TeamForm";
import TeamState from "./TeamState";
import TeamDialogShell from "./TeamDialogShell";

export type TeamDialogAction =
  | { kind: "create" }
  | { kind: "view" | "edit" | "archive" | "restore"; teamId: string };

export default function TeamManagementDialog({
  isOpen,
  action,
  scope,
  actor,
  onClose,
  onSuccess,
  onAction,
}: {
  isOpen: boolean;
  action: TeamDialogAction | null;
  scope: TeamScope;
  actor: string;
  onClose: () => void;
  onSuccess: (resource: TeamResource) => void;
  onAction: (action: TeamDialogAction) => void;
}) {
  const t = useTranslations("teamFoundation");
  const isCreate = action?.kind === "create";
  const query = useTeam(
    scope,
    actor,
    action && action.kind !== "create" ? action.teamId : "",
    isOpen && Boolean(action) && !isCreate,
  );
  const kind = action?.kind;
  const title =
    kind === "create"
      ? t("create")
      : kind === "edit"
        ? t("edit")
        : kind === "archive"
          ? t("archive")
          : kind === "restore"
            ? t("restore")
            : kind === "view"
              ? query.data?.team.name ?? t("detail")
              : t("detail");
  const description =
    kind === "create"
      ? t("createDescription")
      : kind === "edit"
        ? t("editDescription")
        : kind === "archive"
          ? t("archiveDescription", { name: query.data?.team.name ?? "" })
          : kind === "restore"
            ? t("restoreDescription", { name: query.data?.team.name ?? "" })
            : kind === "view"
              ? t("detailDescription")
              : undefined;

  return (
    <TeamDialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      destructive={kind === "archive"}
      focusField={kind === "create" || kind === "edit" || kind === "archive" || kind === "restore"}
    >
      {kind === "create" ? (
        <TeamForm
          scope={scope}
          actor={actor}
          operation="create"
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      ) : !action ? null : query.isPending || query.isFetching ? (
        <TeamState loading />
      ) : query.isError ? (
        <TeamState
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : !query.data ? null : (
        <DialogContent
          key={`${action.kind}:${query.data.etag}`}
          action={action}
          resource={query.data}
          scope={scope}
          actor={actor}
          onClose={onClose}
          onSuccess={onSuccess}
          onAction={onAction}
        />
      )}
    </TeamDialogShell>
  );
}

function DialogContent({
  action,
  resource,
  scope,
  actor,
  onClose,
  onSuccess,
  onAction,
}: {
  action: Exclude<TeamDialogAction, { kind: "create" }>;
  resource: TeamResource;
  scope: TeamScope;
  actor: string;
  onClose: () => void;
  onSuccess: (resource: TeamResource) => void;
  onAction: (action: TeamDialogAction) => void;
}) {
  const t = useTranslations("teamFoundation");
  const team = resource.team;

  if (action.kind === "edit" && team.status === "ACTIVE")
    return (
      <TeamForm
        scope={scope}
        actor={actor}
        resource={resource}
        operation="update"
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    );

  if (action.kind === "archive" || action.kind === "restore") {
    const operation = action.kind;
    return (
      <div>
        <TeamForm
          scope={scope}
          actor={actor}
          resource={resource}
          operation={operation}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    );
  }

  if (action.kind === "edit")
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {t("archivedError")}
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {(["name", "code", "description", "status"] as const).map((field) => (
          <div
            key={field}
            className={field === "description" ? "sm:col-span-2" : ""}
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              {t(field)}
            </dt>
            <dd className="mt-1.5 break-words text-sm font-medium text-gray-900 dark:text-gray-100">
              {field === "status" ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${team.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                >
                  {t(team.status)}
                </span>
              ) : field === "description" ? (
                team.description || t("noDescription")
              ) : (
                team[field]
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("close")}
        </Button>
        {team.status === "ACTIVE" ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAction({ kind: "edit", teamId: team.id })}
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => onAction({ kind: "archive", teamId: team.id })}
            >
              {t("archive")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => onAction({ kind: "restore", teamId: team.id })}
          >
            {t("restore")}
          </Button>
        )}
      </div>
    </div>
  );
}
