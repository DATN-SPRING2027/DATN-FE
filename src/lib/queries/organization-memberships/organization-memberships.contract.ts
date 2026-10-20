import { ApiError } from "@/lib/api-client";

export const organizationMembershipStatuses = [
  "PENDING_INVITE",
  "ACTIVE",
  "SUSPENDED",
  "REMOVED",
] as const;

export type OrganizationMembershipStatus =
  (typeof organizationMembershipStatuses)[number];
export type MembershipListStatus = OrganizationMembershipStatus;
export type OrganizationRoleCode = "ADMIN" | "MEMBER";
export type MembershipActionReason = "ACCESS_REQUEST" | "ACCESS_REVIEW";
export type SuspensionReason = "SECURITY_INCIDENT" | "ACCESS_REVIEW";

export type OrganizationMemberUser = Readonly<{
  id: string;
  fullName: string;
  email: string;
  accountStatus: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
}>;

export type OrganizationMembership = Readonly<{
  id: string;
  organizationId: string;
  userId: string;
  status: OrganizationMembershipStatus;
  version: number;
  roleCode: OrganizationRoleCode | null;
  roleVersion: number;
  createdAt: string;
  updatedAt: string;
  user: OrganizationMemberUser | null;
}>;

export type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

export type OrganizationMembershipPage = Readonly<{
  data: readonly OrganizationMembership[];
  pagination: Pagination;
}>;

export type AdminInvitation = Readonly<{
  id: string;
  membershipId: string;
  organizationId: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED" | "SUPERSEDED";
  version: number;
  expiresAt: string;
  createdAt: string;
  membershipVersion: number;
  targetUserId: string;
  email: string;
}>;

export type AdminInvitationPage = Readonly<{
  data: readonly AdminInvitation[];
  pagination: Pagination;
}>;

export type RecipientInvitation = Readonly<{
  id: string;
  membershipId: string;
  organizationId: string;
  status: AdminInvitation["status"];
  version: number;
  expiresAt: string;
  createdAt: string;
  membershipVersion: number;
  organizationName: string;
}>;

export type RecipientInvitationPage = Readonly<{
  data: readonly RecipientInvitation[];
  pagination: Pagination;
}>;

export type MembershipMutationAck = Readonly<{
  operationId: string;
  membership: Readonly<{
    id: string;
    organizationId: string;
    userId: string;
    status: OrganizationMembershipStatus;
    version: number;
  }>;
  invitation?: Readonly<{
    id: string;
    status: AdminInvitation["status"];
    version: number;
    expiresAt: string;
  }>;
}>;

export type OrganizationRoleMutationAck = Readonly<{
  operationId: string;
  membership: Readonly<{
    id: string;
    organizationId: string;
    userId: string;
    status: OrganizationMembershipStatus;
    version: number;
  }>;
  role: Readonly<{ roleCode: OrganizationRoleCode; version: number }>;
}>;

export type InviteMemberInput = Readonly<{
  email: string;
  reasonCode: MembershipActionReason;
}>;
export type SuspendMembershipInput = Readonly<{
  expectedMembershipVersion: number;
  reasonCode: SuspensionReason;
}>;
export type SetOrganizationMembershipRoleInput = Readonly<{
  expectedMembershipVersion: number;
  expectedRoleVersion: number;
  roleCode: OrganizationRoleCode;
  reason: string;
}>;
export type ResendInvitationInput = Readonly<{
  expectedMembershipVersion: number;
  expectedInvitationVersion: number;
  reasonCode: MembershipActionReason;
}>;
export type CancelInvitationInput = Readonly<{
  expectedMembershipVersion: number;
  expectedInvitationVersion: number;
  reasonCode: "INVITATION_CANCELLED";
}>;

const resourceIdPattern = /^[a-fA-F0-9]{24}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const membershipStates = new Set<string>(organizationMembershipStatuses);
const invitationStates = new Set<string>([
  "PENDING",
  "ACCEPTED",
  "CANCELLED",
  "EXPIRED",
  "SUPERSEDED",
]);
const accountStates = new Set<string>(["ACTIVE", "SUSPENDED", "PENDING_INVITE"]);
const organizationRoleCodes = new Set<string>(["ADMIN", "MEMBER"]);

export function isOrganizationResourceId(value: string): boolean {
  return resourceIdPattern.test(value);
}

function invalidResponse(): ApiError {
  return new ApiError(
    502,
    "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE",
    "The Organization membership service returned an invalid response",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isDateTime(value: unknown): value is string {
  return typeof value === "string" && dateTimePattern.test(value) && Number.isFinite(Date.parse(value));
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parsePagination(value: unknown): Pagination {
  if (!isRecord(value)) throw invalidResponse();
  const { page, pageSize, totalItems, totalPages } = value;
  if (
    !isVersion(page) ||
    !isVersion(pageSize) ||
    pageSize > 100 ||
    !isNonnegativeInteger(totalItems) ||
    !isNonnegativeInteger(totalPages)
  ) throw invalidResponse();
  return { page, pageSize, totalItems, totalPages };
}

function parseUser(value: unknown): OrganizationMemberUser | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !resourceIdPattern.test(value.id) ||
    typeof value.fullName !== "string" ||
    !isEmail(value.email) ||
    typeof value.accountStatus !== "string" ||
    !accountStates.has(value.accountStatus)
  ) throw invalidResponse();
  return {
    id: value.id,
    fullName: value.fullName,
    email: value.email,
    accountStatus: value.accountStatus as OrganizationMemberUser["accountStatus"],
  };
}

function parseMembership(value: unknown, organizationId: string): OrganizationMembership {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" || !resourceIdPattern.test(value.id) ||
    value.organizationId !== organizationId ||
    typeof value.userId !== "string" || !resourceIdPattern.test(value.userId) ||
    typeof value.status !== "string" || !membershipStates.has(value.status) ||
    !isVersion(value.version) ||
    !(value.roleCode === null || (typeof value.roleCode === "string" && organizationRoleCodes.has(value.roleCode))) ||
    !isNonnegativeInteger(value.roleVersion) ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt)
  ) throw invalidResponse();
  return {
    id: value.id,
    organizationId,
    userId: value.userId,
    status: value.status as OrganizationMembershipStatus,
    version: value.version,
    roleCode: value.roleCode as OrganizationRoleCode | null,
    roleVersion: value.roleVersion,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    user: parseUser(value.user),
  };
}

function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): Readonly<{ data: readonly T[]; pagination: Pagination }> {
  if (!isRecord(value) || !Array.isArray(value.data) || value.data.length > 100) {
    throw invalidResponse();
  }
  return {
    data: value.data.map(parseItem),
    pagination: parsePagination(value.pagination),
  };
}

export function parseMembershipPage(
  value: unknown,
  organizationId: string,
): OrganizationMembershipPage {
  if (!isOrganizationResourceId(organizationId)) throw invalidResponse();
  return parsePage(value, (item) => parseMembership(item, organizationId));
}

export function parseAdminInvitationPage(
  value: unknown,
  organizationId: string,
): AdminInvitationPage {
  if (!isOrganizationResourceId(organizationId)) throw invalidResponse();
  return parsePage(value, (item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" || !resourceIdPattern.test(item.id) ||
      typeof item.membershipId !== "string" || !resourceIdPattern.test(item.membershipId) ||
      item.organizationId !== organizationId ||
      typeof item.status !== "string" || !invitationStates.has(item.status) ||
      !isVersion(item.version) ||
      !isDateTime(item.expiresAt) ||
      !isDateTime(item.createdAt) ||
      !isVersion(item.membershipVersion) ||
      typeof item.targetUserId !== "string" || !resourceIdPattern.test(item.targetUserId) ||
      !isEmail(item.email)
    ) throw invalidResponse();
    return {
      id: item.id,
      membershipId: item.membershipId,
      organizationId,
      status: item.status as AdminInvitation["status"],
      version: item.version,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      membershipVersion: item.membershipVersion,
      targetUserId: item.targetUserId,
      email: item.email,
    };
  });
}

export function parseRecipientInvitationPage(
  value: unknown,
): RecipientInvitationPage {
  return parsePage(value, (item) => {
    const fields = [
      "id",
      "membershipId",
      "organizationId",
      "status",
      "version",
      "expiresAt",
      "createdAt",
      "membershipVersion",
      "organizationName",
    ];
    if (
      !isRecord(item) ||
      Object.keys(item).length !== fields.length ||
      fields.some((field) => !Object.hasOwn(item, field)) ||
      typeof item.id !== "string" || !resourceIdPattern.test(item.id) ||
      typeof item.membershipId !== "string" || !resourceIdPattern.test(item.membershipId) ||
      typeof item.organizationId !== "string" || !resourceIdPattern.test(item.organizationId) ||
      typeof item.status !== "string" || !invitationStates.has(item.status) ||
      !isVersion(item.version) ||
      !isDateTime(item.expiresAt) ||
      !isDateTime(item.createdAt) ||
      !isVersion(item.membershipVersion) ||
      typeof item.organizationName !== "string"
    ) throw invalidResponse();
    return {
      id: item.id,
      membershipId: item.membershipId,
      organizationId: item.organizationId,
      status: item.status as RecipientInvitation["status"],
      version: item.version,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      membershipVersion: item.membershipVersion,
      organizationName: item.organizationName,
    };
  });
}

export function parseMutationAck(
  value: unknown,
  organizationId: string,
): MembershipMutationAck {
  if (!isRecord(value) || typeof value.operationId !== "string" || !resourceIdPattern.test(value.operationId)) {
    throw invalidResponse();
  }
  const rawMembership = value.membership;
  if (
    !isRecord(rawMembership) ||
    typeof rawMembership.id !== "string" || !resourceIdPattern.test(rawMembership.id) ||
    rawMembership.organizationId !== organizationId ||
    typeof rawMembership.userId !== "string" || !resourceIdPattern.test(rawMembership.userId) ||
    typeof rawMembership.status !== "string" || !membershipStates.has(rawMembership.status) ||
    !isVersion(rawMembership.version)
  ) throw invalidResponse();

  let invitation: MembershipMutationAck["invitation"];
  if (value.invitation !== undefined) {
    const rawInvitation = value.invitation;
    if (
      !isRecord(rawInvitation) ||
      typeof rawInvitation.id !== "string" || !resourceIdPattern.test(rawInvitation.id) ||
      typeof rawInvitation.status !== "string" || !invitationStates.has(rawInvitation.status) ||
      !isVersion(rawInvitation.version) ||
      !isDateTime(rawInvitation.expiresAt)
    ) throw invalidResponse();
    invitation = {
      id: rawInvitation.id,
      status: rawInvitation.status as AdminInvitation["status"],
      version: rawInvitation.version,
      expiresAt: rawInvitation.expiresAt,
    };
  }
  return {
    operationId: value.operationId,
    membership: {
      id: rawMembership.id,
      organizationId,
      userId: rawMembership.userId,
      status: rawMembership.status as OrganizationMembershipStatus,
      version: rawMembership.version,
    },
    ...(invitation ? { invitation } : {}),
  };
}

export function parseOrganizationRoleMutationAck(
  value: unknown,
  organizationId: string,
): OrganizationRoleMutationAck {
  if (
    !isRecord(value) ||
    typeof value.operationId !== "string" ||
    !resourceIdPattern.test(value.operationId) ||
    !isRecord(value.membership) ||
    !isRecord(value.role)
  ) throw invalidResponse();
  const membership = value.membership;
  const role = value.role;
  if (
    typeof membership.id !== "string" || !resourceIdPattern.test(membership.id) ||
    membership.organizationId !== organizationId ||
    typeof membership.userId !== "string" || !resourceIdPattern.test(membership.userId) ||
    typeof membership.status !== "string" || !membershipStates.has(membership.status) ||
    !isVersion(membership.version) ||
    typeof role.roleCode !== "string" || !organizationRoleCodes.has(role.roleCode) ||
    !isVersion(role.version)
  ) throw invalidResponse();
  return {
    operationId: value.operationId,
    membership: {
      id: membership.id,
      organizationId,
      userId: membership.userId,
      status: membership.status as OrganizationMembershipStatus,
      version: membership.version,
    },
    role: {
      roleCode: role.roleCode as OrganizationRoleCode,
      version: role.version,
    },
  };
}
