"use client";

import PlatformProjectMetadataForm from "./PlatformProjectMetadataForm";
import PlatformProjectMembers from "./PlatformProjectMembers";
import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  TextField,
  box,
  cell,
  input,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformProjectsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const roleLabels = useTranslations("roleLabels");
  const {
    canReadProjects,
    search,
    setSearch,
    setPage,
    status,
    setStatus,
    projects,
    setSelectedId,
    selectedId,
    selectedProject,
    canManageProjects,
  } = model;
  return (
    <div className="space-y-6">
      {!canReadProjects ? (
        <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
          Your Platform session does not grant platform.projects.project.read.
        </p>
      ) : (
        <>
          <section className={`${box} overflow-hidden`}>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-sm font-bold">Projects</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Project metadata only. Tenant content is never exposed here.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  className={input}
                  aria-label="Search projects"
                  placeholder="Search projects"
                  value={search}
                  maxLength={100}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <select
                  className={input}
                  aria-label="Project visibility"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All visibility</option>
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
            </div>
            {projects.isPending ? (
              <Loading />
            ) : projects.isError ? (
              <ErrorState retry={() => void projects.refetch()} />
            ) : projects.data?.data.length ? (
              <DirectoryTable
                headers={[
                  "Project",
                  "Organization",
                  "Visibility",
                  "Members",
                  "Action",
                ]}
              >
                {projects.data.data.map((project) => (
                  <tr key={project.id}>
                    <td className={cell}>
                      <strong>{project.name}</strong>
                      <span className="font-mono mt-1 block text-[10px] text-gray-500">
                        {project.code}
                      </span>
                    </td>
                    <td className={cell}>{project.organization.name}</td>
                    <td className={cell}>
                      <StatusBadge
                        status={project.visibility}
                        label={project.visibility}
                      />
                    </td>
                    <td className={cell}>{project.memberCount}</td>
                    <td className={cell}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedId(project.id)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </DirectoryTable>
            ) : (
              <EmptyState
                title="No projects"
                body="The Platform API returned no projects for these filters."
              />
            )}
            {projects.data?.pagination && (
              <PlatformPagination
                ariaLabel="Projects"
                page={projects.data.pagination.page}
                totalPages={projects.data.pagination.totalPages}
                totalItems={projects.data.pagination.totalItems}
                onPageChange={setPage}
              />
            )}
          </section>
          {selectedId && (
            <section className={`${box} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold">Project detail</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedId("")}
                >
                  Close
                </Button>
              </div>
              {selectedProject.isPending ? (
                <Loading columns={3} />
              ) : selectedProject.isError || !selectedProject.data ? (
                <ErrorState retry={() => void selectedProject.refetch()} />
              ) : (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField
                      label="Project"
                      value={selectedProject.data.name}
                    />
                    <TextField
                      label="Organization"
                      value={`${selectedProject.data.organization.name} · ${selectedProject.data.organization.slug}`}
                    />
                    <TextField
                      label="Visibility"
                      value={selectedProject.data.visibility}
                    />
                    <TextField
                      label="Status and members"
                      value={`${selectedProject.data.status} · ${selectedProject.data.memberCount}`}
                    />
                  </dl>
                  <p className="mt-3 text-xs text-gray-500">
                    {roleLabels("teamLeaders")}:{" "}
                    {selectedProject.data.leaders
                      .map((leader) => `${leader.fullName} (${leader.email})`)
                      .join(", ") || "None"}
                    {selectedProject.data.leadersTruncated
                      ? " · list truncated"
                      : ""}
                  </p>
                  <PlatformProjectMetadataForm
                    key={`metadata-${selectedProject.data.id}`}
                    project={selectedProject.data}
                    canManage={canManageProjects}
                    reload={async () => {
                      const result = await selectedProject.refetch();
                      if (result.error) throw result.error;
                      return result.data;
                    }}
                  />
                  <PlatformProjectMembers
                    key={`members-${selectedProject.data.id}`}
                    projectId={selectedProject.data.id}
                    organizationId={selectedProject.data.organization.id}
                  />
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
