import type { Project } from "./useProjects";

/** Uses the server's effective Leader summary for this Project, never a global role label. */
export function isEffectiveProjectLeader(
  actor: { id: string; organizationId?: string } | null | undefined,
  project: Project | null | undefined,
): boolean {
  return Boolean(
    actor?.organizationId &&
    project?.status === "ACTIVE" &&
    project.organizationId === actor.organizationId &&
    project.leaders?.some((leader) => leader.userId === actor.id),
  );
}
