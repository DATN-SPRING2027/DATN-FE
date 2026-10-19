import { ApiError } from "@/lib/api-client";

export type ProjectMemberUser = Readonly<{
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
}>;

export type ProjectMembership = Readonly<{
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: string;
  user?: ProjectMemberUser | null;
}>;

export type ProjectMemberCandidate = Readonly<{
  userId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
  organizationMembershipStatus: "ACTIVE";
  isProjectMember: boolean;
}>;

export type ProjectMemberPage = Readonly<{
  data: readonly ProjectMembership[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>;
}>;

export type ProjectMemberFilter = Readonly<{
  page: number;
  pageSize: number;
  status?: "ACTIVE" | "INACTIVE";
}>;

// ResourceId is opaque in the accepted contract. Storage-format checks belong to BE.
export const isResourceId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function invalidResponse(): never {
  throw new ApiError(
    502,
    "INVALID_PROJECT_MEMBER_RESPONSE",
    "Unexpected Project member response",
  );
}

export function parseCandidate(value: unknown): ProjectMemberCandidate {
  if (
    !record(value) ||
    !isResourceId(value.userId) ||
    typeof value.email !== "string" ||
    value.organizationMembershipStatus !== "ACTIVE" ||
    typeof value.isProjectMember !== "boolean"
  ) {
    return invalidResponse();
  }
  return {
    userId: value.userId,
    email: value.email,
    ...(typeof value.fullName === "string" ? { fullName: value.fullName } : {}),
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    organizationMembershipStatus: "ACTIVE",
    isProjectMember: value.isProjectMember,
  };
}

export function parseMembership(
  value: unknown,
  organizationId: string,
  projectId: string,
): ProjectMembership {
  if (
    !record(value) ||
    !isResourceId(value.id) ||
    !isResourceId(value.userId) ||
    value.organizationId !== organizationId ||
    value.projectId !== projectId ||
    (value.status !== "ACTIVE" && value.status !== "INACTIVE") ||
    typeof value.joinedAt !== "string" ||
    !Number.isFinite(Date.parse(value.joinedAt))
  )
    return invalidResponse();

  let user: ProjectMemberUser | undefined;
  if (
    record(value.user) &&
    isResourceId(value.user.id) &&
    typeof value.user.email === "string"
  ) {
    user = {
      id: value.user.id,
      email: value.user.email,
      ...(typeof value.user.fullName === "string"
        ? { fullName: value.user.fullName }
        : {}),
      avatarUrl:
        typeof value.user.avatarUrl === "string" ? value.user.avatarUrl : null,
    };
  }

  return {
    id: value.id,
    organizationId,
    projectId,
    userId: value.userId,
    status: value.status,
    joinedAt: value.joinedAt,
    ...(user !== undefined ? { user } : {}),
  };
}

export function parseMemberPage(
  value: unknown,
  organizationId: string,
  projectId: string,
): ProjectMemberPage {
  if (!record(value) || !Array.isArray(value.data) || !record(value.pagination))
    return invalidResponse();
  const { page, pageSize, totalItems, totalPages } = value.pagination;
  if (
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    typeof totalItems !== "number" ||
    !Number.isSafeInteger(totalItems) ||
    totalItems < 0 ||
    typeof totalPages !== "number" ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < 0
  )
    return invalidResponse();
  return {
    data: value.data.map((item) =>
      parseMembership(item, organizationId, projectId),
    ),
    pagination: { page, pageSize, totalItems, totalPages },
  };
}
