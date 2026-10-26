import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import type { Project } from "@/lib/queries/projects/useProjects";
import { isEffectiveProjectLeader } from "@/lib/queries/projects/project-permissions";
import { canManageOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import type { WorkItem } from "./work-types";

/** UI projection of the approved Workspace Task policy; BE remains authoritative. */
export function canManageProjectWork(
  user: CurrentUserResponse | null | undefined,
  project: Project | null | undefined,
): boolean {
  if (
    !user?.organizationId ||
    !project ||
    project.status !== "ACTIVE" ||
    user.organizationId !== project.organizationId
  )
    return false;
  return (
    canManageOrganizationMemberships(user) ||
    isEffectiveProjectLeader(user, project)
  );
}

export function canModifyProjectTask(
  user: CurrentUserResponse | null | undefined,
  project: Project | null | undefined,
  task: { createdBy: string; assigneeId: string | null },
): boolean {
  if (
    !user?.organizationId ||
    !project ||
    project.status !== "ACTIVE" ||
    user.organizationId !== project.organizationId
  )
    return false;
  return (
    canManageProjectWork(user, project) ||
    task.createdBy === user.id ||
    task.assigneeId === user.id
  );
}

export function applyTaskPermissions(
  user: CurrentUserResponse | null | undefined,
  project: Project | null | undefined,
  item: WorkItem,
): WorkItem {
  return {
    ...item,
    readOnly: !canModifyProjectTask(user, project, {
      createdBy: item.reporter.id,
      assigneeId: item.assignee.id,
    }),
    subtaskItems: item.subtaskItems?.map((sub) => ({
      ...sub,
      readOnly: !canModifyProjectTask(user, project, {
        createdBy: sub.reporter?.id ?? "",
        assigneeId: sub.assignee?.id ?? null,
      }),
    })),
  };
}
