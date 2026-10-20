"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useModal } from "@/hooks/useModal";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";
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
  const user = useCurrentUserQuery();
  if (user.isPending) return <TeamState loading />;
  if (user.isError) return <TeamState error={user.error} />;
  if (!user.data?.organizationId)
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
  const scope = { organizationId: user.data.organizationId, projectId };
  return (
    <ScopedTeams
      key={`${user.data.id}:${scope.organizationId}:${projectId}:${teamId ?? ""}:${mode}`}
      scope={scope}
      actor={user.data.id}
      teamId={teamId}
      mode={mode}
      embedded={embedded}
    />
  );
}
function ScopedTeams({
  scope,
  actor,
  teamId,
  mode,
  embedded,
}: {
  scope: TeamScope;
  actor: string;
  teamId?: string;
  mode: "list" | "create" | "detail" | "edit";
  embedded: boolean;
}) {
  const t = useTranslations("teamFoundation");
  const router = useRouter();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [dialogAction, setDialogAction] = useState<TeamDialogAction | null>(
    null,
  );
  const base = `/projects/${encodeURIComponent(scope.projectId)}/teams`;
  function openDialog(action: TeamDialogAction) {
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
          <TeamDirectory scope={scope} actor={actor} onAction={openDialog} />
          <TeamManagementDialog
            isOpen={modal.isOpen}
            action={dialogAction}
            scope={scope}
            actor={actor}
            onClose={closeDialog}
            onSuccess={completeDialog}
            onAction={setDialogAction}
          />
        </>
      ) : mode === "create" ? (
        <ComponentCard title={t("information")} className="rounded-xl">
          <TeamForm
            scope={scope}
            actor={actor}
            operation="create"
            onSuccess={(r) =>
              router.push(`${base}/${encodeURIComponent(r.team.id)}`)
            }
          />
        </ComponentCard>
      ) : (
        <TeamDetails
          scope={scope}
          actor={actor}
          id={teamId!}
          edit={mode === "edit"}
          base={base}
        />
      )}
    </section>
  );
}
function TeamDirectory({
  scope,
  actor,
  onAction,
}: {
  scope: TeamScope;
  actor: string;
  onAction: (action: TeamDialogAction) => void;
}) {
  const t = useTranslations("teamFoundation");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TeamFilter>("ACTIVE");
  const query = useTeams(scope, actor, page, status);
  const list = query.data?.data ?? [];
  return (
    <TeamDirectoryTable
      items={list}
      createAction={{
        label: t("create"),
        onClick: () => onAction({ kind: "create" }),
      }}
      status={status}
      onStatusChange={(next) => {
        setStatus(next);
        setPage(1);
      }}
      totalItems={
        query.data && !query.isError
          ? query.data.pagination.totalItems
          : undefined
      }
      page={page}
      totalPages={query.data?.pagination.totalPages ?? 0}
      isPageChanging={query.isFetching}
      onPageChange={setPage}
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
      stateContent={
        query.isPending || query.isFetching ? (
          <TeamState loading />
        ) : query.isError ? (
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
        return <TeamRowActions team={team} onAction={onAction} />;
      }}
    />
  );
}
function TeamDetails({
  scope,
  actor,
  id,
  edit,
  base,
}: {
  scope: TeamScope;
  actor: string;
  id: string;
  edit: boolean;
  base: string;
}) {
  const t = useTranslations("teamFoundation");
  const router = useRouter();
  const query = useTeam(scope, actor, id);
  const [lifecycle, setLifecycle] = useState<"archive" | "restore">();
  if (query.isPending || query.isFetching) return <TeamState loading />;
  if (query.isError)
    return (
      <TeamState
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const resource = query.data;
  const team = resource.team;
  function completed() {
    setLifecycle(undefined);
    router.push(`${base}/${encodeURIComponent(id)}`);
    void query.refetch();
  }
  return (
    <ComponentCard title={t("information")} className="rounded-xl">
      {edit ? (
        team.status === "ARCHIVED" ? (
          <p role="alert">{t("archivedError")}</p>
        ) : (
          <TeamForm
            scope={scope}
            actor={actor}
            resource={resource}
            operation="update"
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
          <div className="flex flex-wrap items-center gap-4">
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
          </div>
          {lifecycle && (
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
