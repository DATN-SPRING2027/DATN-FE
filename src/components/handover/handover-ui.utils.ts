import { ApiError } from "@/lib/api-client";
import type {
  ProjectMemberCandidate,
  ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import type {
  HandoverJobState,
  HandoverStatus,
  SourceRefKind,
  TaskTransferAggregateState,
  TaskTransferChildResultState,
} from "@/lib/queries/handovers/handover.types";
import type { HandoverMemberOption } from "./HandoverMemberSelect";

export function extractHandoverErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.code && error.message) {
      return `${error.message} (${error.code})`;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function formatShortId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function resolveMemberName(
  userId: string | null | undefined,
  membersById: ReadonlyMap<string, ProjectMembership>,
  unassignedLabel: string,
): string {
  if (!userId) return unassignedLabel;
  const member = membersById.get(userId);
  if (member?.user?.fullName?.trim()) {
    return member.user.fullName.trim();
  }
  if (member?.user?.email?.trim()) {
    return member.user.email.trim();
  }
  return `User ${formatShortId(userId)}`;
}

export function formatMemberOptionLabel(member: ProjectMembership): string {
  return (
    member.user?.fullName?.trim() ||
    member.user?.email?.trim() ||
    `User ${formatShortId(member.userId)}`
  );
}

function getMembershipRoleCode(member: ProjectMembership): string | undefined {
  const maybeRole = (member as { role?: unknown }).role;
  return typeof maybeRole === "string" && maybeRole.trim().length > 0
    ? maybeRole.trim()
    : undefined;
}

export function buildOrganizationSuccessorOptions(input: {
  activeProjectMembers: readonly ProjectMembership[];
  orgCandidates?: readonly ProjectMemberCandidate[];
  departingUserId: string;
  currentUserId?: string;
  leaderUserIds?: ReadonlySet<string>;
}): {
  options: readonly HandoverMemberOption[];
  activeProjectUserIds: ReadonlySet<string>;
} {
  const {
    activeProjectMembers,
    orgCandidates = [],
    departingUserId,
    currentUserId,
    leaderUserIds,
  } = input;

  const trimmedDeparting = departingUserId.trim();
  const activeProjectUserIds = new Set<string>();
  const projectGroup: HandoverMemberOption[] = [];
  const orgGroup: HandoverMemberOption[] = [];

  for (const member of activeProjectMembers) {
    activeProjectUserIds.add(member.userId);
    if (member.userId === trimmedDeparting) continue;
    projectGroup.push({
      userId: member.userId,
      fullName: formatMemberOptionLabel(member),
      email: member.user?.email?.trim() || undefined,
      avatarUrl: member.user?.avatarUrl ?? null,
      status: "ACTIVE",
      roleCode: leaderUserIds?.has(member.userId)
        ? "TEAM_LEADER"
        : getMembershipRoleCode(member),
      isCurrentUser: Boolean(currentUserId && member.userId === currentUserId),
      membershipScope: "PROJECT",
    });
  }

  for (const candidate of orgCandidates) {
    if (candidate.organizationMembershipStatus !== "ACTIVE") continue;
    if (candidate.isProjectMember) {
      if (!activeProjectUserIds.has(candidate.userId)) {
        activeProjectUserIds.add(candidate.userId);
        if (candidate.userId !== trimmedDeparting) {
          projectGroup.push({
            userId: candidate.userId,
            fullName:
              candidate.fullName?.trim() ||
              candidate.email?.trim() ||
              `User ${formatShortId(candidate.userId)}`,
            email: candidate.email?.trim() || undefined,
            avatarUrl: candidate.avatarUrl ?? null,
            status: "ACTIVE",
            roleCode: leaderUserIds?.has(candidate.userId)
              ? "TEAM_LEADER"
              : undefined,
            isCurrentUser: Boolean(
              currentUserId && candidate.userId === currentUserId,
            ),
            membershipScope: "PROJECT",
          });
        }
      }
      continue;
    }

    if (
      activeProjectUserIds.has(candidate.userId) ||
      candidate.userId === trimmedDeparting
    ) {
      continue;
    }

    orgGroup.push({
      userId: candidate.userId,
      fullName:
        candidate.fullName?.trim() ||
        candidate.email?.trim() ||
        `User ${formatShortId(candidate.userId)}`,
      email: candidate.email?.trim() || undefined,
      avatarUrl: candidate.avatarUrl ?? null,
      status: "ACTIVE",
      isCurrentUser: Boolean(
        currentUserId && candidate.userId === currentUserId,
      ),
      membershipScope: "ORG_CANDIDATE",
    });
  }

  projectGroup.sort((a, b) => a.fullName.localeCompare(b.fullName));
  orgGroup.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    options: [...projectGroup, ...orgGroup],
    activeProjectUserIds,
  };
}

export async function ensureProjectMemberBeforeHandover(input: {
  successorUserId: string | null;
  activeProjectUserIds: ReadonlySet<string>;
  addProjectMember: (userId: string) => Promise<unknown>;
}): Promise<boolean> {
  const { successorUserId, activeProjectUserIds, addProjectMember } = input;
  if (!successorUserId || activeProjectUserIds.has(successorUserId)) {
    return false;
  }

  try {
    await addProjectMember(successorUserId);
    return true;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "PROJECT_MEMBERSHIP_ALREADY_ACTIVE"
    ) {
      return false;
    }
    throw error;
  }
}

export function formatUtcDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export function formatUtcDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export function statusBadgeColor(
  status: HandoverStatus,
): "primary" | "success" | "light" {
  switch (status) {
    case "OPEN":
      return "primary";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "light";
  }
}

export function jobBadgeColor(
  state: HandoverJobState,
): "primary" | "success" | "warning" | "error" | "light" {
  switch (state) {
    case "SUCCEEDED":
      return "success";
    case "PENDING":
    case "RUNNING":
      return "primary";
    case "SUPERSEDED":
      return "warning";
    case "FAILED":
      return "error";
    case "CANCELLED":
      return "light";
  }
}

export function transferBadgeColor(
  state: TaskTransferAggregateState | TaskTransferChildResultState,
): "primary" | "success" | "warning" | "error" | "light" {
  switch (state) {
    case "CONFIRMED":
      return "success";
    case "PENDING":
      return "primary";
    case "PARTIAL":
    case "UNKNOWN":
      return "warning";
    case "CONFLICT":
    case "FAILED":
      return "error";
  }
}

export function buildSourceWorkspaceHref(
  projectId: string,
  kind: SourceRefKind,
  sourceId: string,
): string | null {
  const encodedProj = encodeURIComponent(projectId);
  const encodedSrc = encodeURIComponent(sourceId);
  switch (kind) {
    case "PROJECT_DOCUMENT":
      return `/projects/${encodedProj}/documents?documentId=${encodedSrc}`;
    case "TASK_NOTE":
      return `/projects/${encodedProj}/work-notes?noteId=${encodedSrc}`;
    case "WORK_REPORT":
      return `/projects/${encodedProj}/work-reports?reportId=${encodedSrc}`;
    case "KNOWLEDGE_OBJECT":
      return null;
  }
}
