import { ApiError } from "@/lib/api-client";

export type ProjectMembership = Readonly<{
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: string;
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
  // Project responses do not include a user profile or role. Keep that projection explicit.
  return {
    id: value.id,
    organizationId,
    projectId,
    userId: value.userId,
    status: value.status,
    joinedAt: value.joinedAt,
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
