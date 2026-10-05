"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import ProjectCreateForm from "./ProjectCreateForm";
import ProjectState from "./ProjectState";
import ProjectCard from "./ProjectCard";

function OrganizationProjects({ organizationId }: { organizationId: string }) {
  const t = useTranslations("projects");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Project["status"]>();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Project>();
  const projects = useProjectsQuery(organizationId, {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  return (
    <div className="space-y-6">
      {created && !projects.isError && (
        <div role="status">
          <Alert
            variant="success"
            title={t("created")}
            message={created.name}
          />
          <Link
            className="text-brand-500 dark:text-brand-400"
            href={`/projects/${encodeURIComponent(created.id)}`}
          >
            {t("view")}
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {t("workspace")}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("workspaceHint")}
          </p>
        </div>
        <Button
          className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          onClick={() => {
            setCreating(!creating);
            setCreated(undefined);
          }}
        >
          {t(creating ? "cancel" : "create")}
        </Button>
      </div>
      {creating && (
        <ProjectCreateForm
          organizationId={organizationId}
          onCreated={(project) => {
            setCreated(project);
            setCreating(false);
            setPage(1);
          }}
        />
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5 dark:border-gray-800">
        <div className="w-full sm:w-56">
          <Label htmlFor="project-status">{t("status")}</Label>
          <Select
            id="project-status"
            defaultValue="all"
            options={[
              { value: "all", label: t("all") },
              { value: "ACTIVE", label: t("active") },
              { value: "ARCHIVED", label: t("archived") },
            ]}
            onChange={(value) => {
              setStatus(
                value === "all" ? undefined : (value as Project["status"]),
              );
              setPage(1);
            }}
          />
        </div>
        {projects.isSuccess && !projects.isFetching && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("totalProjects", { count: projects.data.pagination.totalItems })}
          </p>
        )}
      </div>
      {(projects.isPending || projects.isFetching) && <ProjectState />}
      {projects.isError && (
        <ProjectState
          error={projects.error}
          retry={() => {
            void projects.refetch();
          }}
        />
      )}
      {projects.isSuccess && !projects.isFetching && (
        <>
          {projects.data.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-800 dark:text-white/90">
                {t("emptyTitle")}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("empty")}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.data.data.map((project) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("pageOf", {
                page: projects.data.pagination.page,
                total: Math.max(1, projects.data.pagination.totalPages),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                disabled={page >= projects.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default function ProjectWorkspace() {
  const t = useTranslations("projects");
  const user = useCurrentUserQuery();
  return (
    <ComponentCard title={t("title")} desc={t("organizationScope")}>
      {user.isPending ? (
        <ProjectState />
      ) : user.isError ? (
        <ProjectState
          error={user.error}
          retry={() => {
            void user.refetch();
          }}
        />
      ) : user.data?.organizationId ? (
        <OrganizationProjects
          key={`${user.data.id}:${user.data.organizationId}`}
          organizationId={user.data.organizationId}
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </ComponentCard>
  );
}
