import { ApiError } from "@/lib/api-client";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import type {
  HandoverJobState,
  HandoverStatus,
  SourceRefKind,
  TaskTransferAggregateState,
  TaskTransferChildResultState,
} from "@/lib/queries/handovers/handover.types";

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

