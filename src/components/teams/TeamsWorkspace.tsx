"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useModal } from "@/hooks/useModal";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import { isEffectiveProjectLeader } from "@/lib/queries/projects/project-permissions";
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { teamKeys, useTeam, useTeams } from "@/lib/queries/teams/useTeams";
import type { TeamFilter, TeamScope } from "@/lib/queries/teams/team.contract";
import TeamDirectoryTable from "./TeamDirectoryTable";
import Button from "@/components/ui/button/Button";
import ComponentCard from "@/components/common/ComponentCard";
import TeamForm from "./TeamForm";
import TeamState from "./TeamState";
import TeamManagementDialog, {
  type TeamDialogAction,
} from "./TeamManagementDialog";
import TeamRowActions from "./TeamRowActions";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";

type TeamDirectoryState = {
  query: ReturnType<typeof useTeams>;
  page: number;
  status: TeamFilter;
  onPageChange: (page: number) => void;
  onStatusChange: (status: TeamFilter) => void;
};

export default function TeamsWorkspace({
  projectId,
  teamId,
  mode = "list",
  embedded = false,
}: {
  projectId: string;
  teamId?: string;
  mode?: "list" | "create" | "detail" | "edit";
  embedded?: boolean;
}) {
  const [selection, setSelection] = useState<{ scope: string; page: number; status: TeamFilter }>();
  const user = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(user.error);
  const visibleUser = userAccessLost ? undefined : user.data;
  const project = useProjectQuery(visibleUser?.organizationId ?? "", projectId);
  const isProjectLeader = !isAccessOrResourceUnavailableError(project.error) && project.data?.id === projectId && isEffectiveProjectLeader(visibleUser, project.data);
  const scope = { organizationId: visibleUser?.organizationId ?? "", projectId };
  const directoryScope = `${visibleUser?.id ?? ""}:${scope.organizationId}:${projectId}:${mode}`;
  const { page, status } = selection?.scope === directoryScope ? selection : { page: 1, status: "ACTIVE" as const };
  const listAccess = useTeams(scope, visibleUser?.id ?? "", page, status, mode === "list" || (isProjectLeader && mode === "create"));
  const detailAccess = useTeam(scope, visibleUser?.id ?? "", teamId ?? "", isProjectLeader && (mode === "detail" || mode === "edit"), true);
  // Current Team reads require both team.read and team:children.manage on BE.
  // Project leadership alone does not establish this delegation.
  const teamAccess = mode === "detail" || mode === "edit" ? detailAccess : listAccess;
  // Retain a mounted draft after a transient read failure, but never allow a
  // command until a current read succeeds. Access denials discard cached UI.
  const canManage = isProjectLeader && Boolean(teamAccess.data) && !isAccessOrResourceUnavailableError(teamAccess.error);
  if (user.isPending && !visibleUser) return <TeamState loading />;
  if (user.isError && !visibleUser) return <TeamState error={user.error} />;
  if (!visibleUser?.organizationId)
    return (
      <TeamState
        error={
          new ApiError(
            401,
            "AUTHENTICATION_FAILED",
            "Organization context unavailable",
          )
        }
      />
    );
  if ((mode === "create" || mode === "edit") && !canManage) {
    return project.isPending || (isProjectLeader && teamAccess.isPending)
      ? <TeamState loading />
      : <TeamState error={project.error ?? teamAccess.error ?? new ApiError(403, "FORBIDDEN", "Project leadership and Team delegation are required.")} retry={isProjectLeader ? () => void teamAccess.refetch() : undefined} />;
  }
  return (
    <ScopedTeams
      key={`${visibleUser.id}:${scope.organizationId}:${projectId}:${teamId ?? ""}:${mode}`}
      scope={scope}
      actor={visibleUser.id}
      canManage={canManage}
      accessChecking={teamAccess.fetchStatus !== "idle" || !teamAccess.isSuccess}
      accessError={teamAccess.error}
      retryAccess={() => void teamAccess.refetch()}
      directory={{ query: listAccess, page, status, onPageChange: (next) => setSelection({ scope: directoryScope, page: next, status }), onStatusChange: (next) => setSelection({ scope: directoryScope, page: 1, status: next }) }}
      teamId={teamId}
      mode={mode}
      embedded={embedded}
    />
  );
}
function ScopedTeams({
  scope,
  actor,
  canManage,
  accessChecking,
  accessError,
  retryAccess,
  directory,
  teamId,
  mode,
  embedded,
}: {
  scope: TeamScope;
  actor: string;
  canManage: boolean;
  accessChecking: boolean;
  accessError: Error | null;
  retryAccess: () => void;
  directory: TeamDirectoryState;
  teamId?: string;
  mode: "list" | "create" | "detail" | "edit";
  embedded: boolean;
}) {
  const t = useTranslations("teamFoundation");
  const common = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [dialogAction, setDialogAction] = useState<TeamDialogAction | null>(
    null,
  );
  // A denied read dismisses management, rather than merely hiding it until
  // the next successful refresh. Transient failures keep canManage stable.
  if (!canManage && dialogAction && dialogAction.kind !== "view") {
    setDialogAction(null);
    modal.closeModal();
  }
  const base = `/projects/${encodeURIComponent(scope.projectId)}/teams`;
  const managementEnabled = canManage && !accessChecking;
  function openDialog(action: TeamDialogAction) {
    if (action.kind !== "view" && !managementEnabled) return;
    setDialogAction(action);
    modal.openModal();
  }
  function closeDialog() {
    modal.closeModal();
    setDialogAction(null);
  }
  function completeDialog() {
    closeDialog();
    void queryClient.invalidateQueries({
      queryKey: teamKeys(scope, actor),
      refetchType: "active",
    });
  }
  return (
    <section
      aria-label={t("title")}
      className="w-full min-w-0 space-y-6 text-gray-900 dark:text-white"
    >
      {!embedded && (
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white/95">
              {t(
                mode === "list"
                  ? "title"
                  : mode === "create"
                    ? "create"
                    : mode === "edit"
                      ? "edit"
                      : "detail",
              )}
            </h1>
            {mode === "list" && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("listDescription")}
              </p>
            )}
          </div>
          {mode === "list" ? (
            <div className="flex flex-wrap items-center gap-3">
              {!embedded && (
                <Link
                  href={`/projects/${encodeURIComponent(scope.projectId)}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-gray-600 transition-colors hover:text-brand-600 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-brand-400"
                >
                  {t("backProject")}
                </Link>
              )}
            </div>
          ) : (
            <Link
              href={base}
              className="inline-flex min-h-11 items-center text-sm font-medium text-gray-600 transition-colors hover:text-brand-600 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-brand-400"
            >
              {t("back")}
            </Link>
          )}
        </header>
      )}
      {mode === "list" ? (
        <>
          <TeamDirectory directory={directory} canManage={managementEnabled} onAction={openDialog} />
          <TeamManagementDialog
            isOpen={modal.isOpen && (dialogAction?.kind === "view" || canManage)}
            action={dialogAction}
            scope={scope}
            actor={actor}
            canManage={managementEnabled}
            onClose={closeDialog}
            onSuccess={completeDialog}
            onAction={openDialog}
          />
        </>
      ) : mode === "create" ? (
        <ComponentCard title={t("information")} className="rounded-xl">
          {accessError && <BackgroundRefreshError retryLabel={common("retry")} onRetry={retryAccess}>{common("updateFailed")}</BackgroundRefreshError>}
          <TeamForm
            scope={scope}
            actor={actor}
            operation="create"
            disabled={!managementEnabled}
            onSuccess={(r) =>
              router.push(`${base}/${encodeURIComponent(r.team.id)}`)
            }
          />
        </ComponentCard>
      ) : (
        <TeamDetails
          scope={scope}
          actor={actor}
          canManage={canManage}
          accessChecking={accessChecking}
          id={teamId!}
          edit={mode === "edit"}
          base={base}
        />
      )}
    </section>
  );
}
function TeamDirectory({
  directory,
  canManage,
  onAction,
}: {
  directory: TeamDirectoryState;
  canManage: boolean;
  onAction: (action: TeamDialogAction) => void;
}) {
  const t = useTranslations("teamFoundation");
  const common = useTranslations("common");
  const { query, page, status, onPageChange, onStatusChange } = directory;
  const accessLost = isAccessOrResourceUnavailableError(query.error);
  const visibleData = accessLost ? undefined : query.data;
  const list = visibleData?.data ?? [];
  return (
    <TeamDirectoryTable
      items={list}
      createAction={canManage ? {
        label: t("create"),
        onClick: () => onAction({ kind: "create" }),
      } : undefined}
      status={status}
      onStatusChange={onStatusChange}
      totalItems={visibleData?.pagination.totalItems}
      page={page}
      totalPages={visibleData?.pagination.totalPages ?? 0}
      isPageChanging={query.isFetching}
      isBusy={query.isFetching && Boolean(visibleData)}
      onPageChange={onPageChange}
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
        emptyMessage: t("empty"),
        paginationLabel: t("pagination"),
        pageLabel: (currentPage) => t("page", { page: currentPage }),
        pageSummary: (currentPage, pages) =>
          t("pageSummary", { page: currentPage, totalPages: pages }),
        previous: t("previous"),
        next: t("next"),
      }}
      statusContent={
        !accessLost && query.isFetching && visibleData ? (
          <UpdatingStatus>{common("updating")}</UpdatingStatus>
        ) : !accessLost && query.isRefetchError && visibleData ? (
          <BackgroundRefreshError
            retryLabel={common("retry")}
            onRetry={() => void query.refetch()}
          >
            {common("updateFailed")}
          </BackgroundRefreshError>
        ) : null
      }
      stateContent={
        query.isPending && !visibleData ? (
          <TeamState loading />
        ) : query.isError && !visibleData ? (
          <TeamState
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : undefined
      }
      renderActions={(row) => {
        const team = list.find((item) => item.id === row.id)!;
        return <TeamRowActions team={team} canManage={canManage} onAction={onAction} />;
      }}
    />
  );
}
function TeamDetails({
  scope,
  actor,
  canManage,
  accessChecking,
  id,
  edit,
  base,
}: {
  scope: TeamScope;
  actor: string;
  canManage: boolean;
  accessChecking: boolean;
  id: string;
  edit: boolean;
  base: string;
}) {
  const t = useTranslations("teamFoundation");
  const common = useTranslations("common");
  const router = useRouter();
  const query = useTeam(scope, actor, id);
  const managementEnabled = canManage && !accessChecking && query.isSuccess && query.fetchStatus === "idle";
  const accessLost = isAccessOrResourceUnavailableError(query.error);
  const resource = accessLost ? undefined : query.data;
  const [lifecycle, setLifecycle] = useState<"archive" | "restore">();
  if (query.isPending && !resource) return <TeamState loading />;
  if (query.isError && !resource)
    return (
      <TeamState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (!resource) return <TeamState loading />;
  const team = resource.team;
  function completed() {
    setLifecycle(undefined);
    router.push(`${base}/${encodeURIComponent(id)}`);
    void query.refetch();
  }
  return (
    <ComponentCard title={t("information")} className="rounded-xl">
      {!accessLost && query.isFetching && <UpdatingStatus>{common("updating")}</UpdatingStatus>}
      {!accessLost && query.isRefetchError && (
        <BackgroundRefreshError
          className="mb-4"
          retryLabel={common("retry")}
          onRetry={() => void query.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      {edit ? (
        team.status === "ARCHIVED" ? (
          <p role="alert">{t("archivedError")}</p>
        ) : (
          <TeamForm
            scope={scope}
            actor={actor}
            resource={resource}
            operation="update"
            disabled={!managementEnabled}
            onSuccess={completed}
          />
        )
      ) : (
        <>
          <h2 className="text-xl font-semibold">{team.name}</h2>
          <dl className="grid gap-6 sm:grid-cols-2">
            {(["code", "description", "status"] as const).map((k) => (
              <div key={k}>
                <dt className="text-sm text-gray-600 dark:text-gray-400">
                  {t(k)}
                </dt>
                <dd className="mt-2 text-sm break-words">
                  {k === "status" ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${team.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                    >
                      {t(team.status)}
                    </span>
                  ) : (
                    (team[k] ?? t("noDescription"))
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {managementEnabled && <div className="flex flex-wrap items-center gap-4">
            {team.status === "ACTIVE" && (
              <Link
                href={`${base}/${encodeURIComponent(id)}/edit`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand-600 underline underline-offset-4 hover:text-brand-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t("edit")}
              </Link>
            )}
            <Button
              variant="outline"
              onClick={() =>
                setLifecycle(team.status === "ACTIVE" ? "archive" : "restore")
              }
            >
              {t(team.status === "ACTIVE" ? "archive" : "restore")}
            </Button>
          </div>}
          {canManage && lifecycle && (
            <section className="space-y-4 border-t border-gray-200 pt-5 dark:border-gray-800">
              <h3 className="font-medium">
                {t(
                  lifecycle === "archive" ? "confirmArchive" : "confirmRestore",
                )}
              </h3>
              <TeamForm
                key={`${id}:${resource.etag}:${lifecycle}`}
                scope={scope}
                actor={actor}
                resource={resource}
                operation={lifecycle}
                disabled={!managementEnabled}
                onSuccess={completed}
              />
              <Button variant="outline" onClick={() => setLifecycle(undefined)}>
                {t("cancel")}
              </Button>
            </section>
          )}
        </>
      )}
    </ComponentCard>
  );
}
