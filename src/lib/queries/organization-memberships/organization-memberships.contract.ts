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
export type InvitationAccessScope = "ORGANIZATION" | "SPECIFIC_PROJECTS";
export type InvitationExpiryDays = 7 | 14 | 30;
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
  organizationId: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED" | "SUPERSEDED";
  version: number;
  expiresAt: string;
  createdAt: string;
  invitedEmail: string;
}>;

export type AdminInvitationPage = Readonly<{
  data: readonly AdminInvitation[];
  pagination: Pagination;
}>;

export type RecipientInvitation = Readonly<{
  id: string;
  organizationId: string;
  status: AdminInvitation["status"];
  version: number;
  expiresAt: string;
  createdAt: string;
  invitedEmail: string;
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

export type InvitationMutationAck = Readonly<{
  operationId: string;
  invitation: Readonly<{
    id: string;
    status: AdminInvitation["status"];
    version: number;
    expiresAt: string;
  }>;
}>;

export type OrganizationMutationAck =
  | MembershipMutationAck
  | InvitationMutationAck
  | OrganizationRoleMutationAck;
export type InviteMemberInput = Readonly<{
  roleCode?: OrganizationRoleCode;
  projectRoleCode?: "TEAM_LEADER" | "MEMBER";
  emails?: readonly string[];
  accessScope?: InvitationAccessScope;
  projectIds?: readonly string[];
  message?: string;
  expiresInDays?: InvitationExpiryDays;
  requireApproval?: boolean;
  email: string;
  reasonCode: MembershipActionReason;
}>;
export type SuspendMembershipInput = Readonly<{
  expectedMembershipVersion: number;
  reasonCode: SuspensionReason;
  handovers?: readonly ProjectLeaderHandover[];
}>;
export type ProjectLeaderHandover = Readonly<{ projectId: string; replacementUserId: string }>;
export type SetOrganizationMembershipRoleInput = Readonly<{
  expectedMembershipVersion: number;
  expectedRoleVersion: number;
  roleCode: OrganizationRoleCode;
  reason: string;
}>;
export type ResendInvitationInput = Readonly<{
  expectedMembershipVersion: 0;
  expectedInvitationVersion: number;
  reasonCode: MembershipActionReason;
}>;
export type CancelInvitationInput = Readonly<{
  expectedMembershipVersion: 0;
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
      item.organizationId !== organizationId ||
      typeof item.status !== "string" || !invitationStates.has(item.status) ||
      !isVersion(item.version) ||
      !isDateTime(item.expiresAt) ||
      !isDateTime(item.createdAt) ||
      !isEmail(item.invitedEmail)
    ) throw invalidResponse();
    return {
      id: item.id,
      organizationId,
      status: item.status as AdminInvitation["status"],
      version: item.version,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      invitedEmail: item.invitedEmail,
    };
  });
}

export function parseRecipientInvitationPage(
  value: unknown,
): RecipientInvitationPage {
  return parsePage(value, (item) => {
    const fields = [
      "id",
      "organizationId",
      "status",
      "version",
      "expiresAt",
      "createdAt",
      "invitedEmail",
      "organizationName",
    ];
    if (
      !isRecord(item) ||
      Object.keys(item).length !== fields.length ||
      fields.some((field) => !Object.hasOwn(item, field)) ||
      typeof item.id !== "string" || !resourceIdPattern.test(item.id) ||
      typeof item.organizationId !== "string" || !resourceIdPattern.test(item.organizationId) ||
      typeof item.status !== "string" || !invitationStates.has(item.status) ||
      !isVersion(item.version) ||
      !isDateTime(item.expiresAt) ||
      !isDateTime(item.createdAt) ||
      !isEmail(item.invitedEmail) ||
      typeof item.organizationName !== "string"
    ) throw invalidResponse();
    return {
      id: item.id,
      organizationId: item.organizationId,
      status: item.status as RecipientInvitation["status"],
      version: item.version,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      invitedEmail: item.invitedEmail,
      organizationName: item.organizationName,
    };
  });
}

export function parseMutationAck(
  value: unknown,
  organizationId: string,
): OrganizationMutationAck {
  if (!isRecord(value) || typeof value.operationId !== "string" || !resourceIdPattern.test(value.operationId)) {
    throw invalidResponse();
  }
  if (value.membership === undefined) {
    const rawInvitation = value.invitation;
    if (
      Object.keys(value).length !== 2 ||
      !isRecord(rawInvitation) ||
      typeof rawInvitation.id !== "string" || !resourceIdPattern.test(rawInvitation.id) ||
      typeof rawInvitation.status !== "string" || !invitationStates.has(rawInvitation.status) ||
      !isVersion(rawInvitation.version) ||
      !isDateTime(rawInvitation.expiresAt)
    ) throw invalidResponse();
    return {
      operationId: value.operationId,
      invitation: {
        id: rawInvitation.id,
        status: rawInvitation.status as AdminInvitation["status"],
        version: rawInvitation.version,
        expiresAt: rawInvitation.expiresAt,
      },
    };
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


export type ResumeMembershipInput = Readonly<{
  expectedMembershipVersion: number;
  reasonCode: MembershipActionReason | SuspensionReason;
}>;
export type RemoveMembershipInput = Readonly<{
  expectedMembershipVersion: number;
  reasonCode: MembershipActionReason | SuspensionReason;
  handovers?: readonly ProjectLeaderHandover[];
}>;
export type OrganizationManagerSummary = Readonly<{
  userId: string;
  fullName: string;
  email: string;
  accountStatus: string;
}>;
export type LeaderlessProjectItem = Readonly<{
  id: string;
  name: string;
  code: string;
  visibility: "PRIVATE" | "PUBLIC";
  status: "ACTIVE" | "ARCHIVED";
  activeMemberCount: number;
  effectiveLeaderCount: number;
  updatedAt: string;
}>;
export type OrganizationOverviewSummary = Readonly<{
  organization: Readonly<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    plan: "FREE" | "ENTERPRISE";
    status: "ACTIVE";
    createdAt: string;
    updatedAt: string;
  }>;
  metrics: Readonly<{
    activeMembers: number;
    suspendedMembers: number;
    pendingInvitations: number;
    totalProjects: number;
    activeProjects: number;
    archivedProjects: number;
    leaderlessProjectsCount: number;
  }>;
  leaderlessProjects: readonly LeaderlessProjectItem[];
  managers: readonly OrganizationManagerSummary[];
}>;
export type OrganizationSettingsSummary = Readonly<{
  organization: Readonly<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    plan: "FREE" | "ENTERPRISE";
    status: "ACTIVE";
    createdAt: string;
    updatedAt: string;
  }>;
  editableFields: readonly ("name" | "description")[];
  managers: readonly OrganizationManagerSummary[];
  availablePermissions: readonly string[];
}>;
export type UpdateOrganizationSettingsInput = Readonly<{
  expectedUpdatedAt: string;
  name?: string;
  description?: string | null;
}>;

function parseOrganizationCore(
  value: unknown,
  organizationId: string,
): OrganizationOverviewSummary["organization"] {
  if (
    !isRecord(value) ||
    value.id !== organizationId ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string" ||
    !(value.description === null || value.description === undefined || typeof value.description === "string") ||
    !(value.plan === "FREE" || value.plan === "ENTERPRISE") ||
    value.status !== "ACTIVE" ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt)
  ) {
    throw invalidResponse();
  }
  return {
    id: organizationId,
    name: value.name,
    slug: value.slug,
    description: typeof value.description === "string" ? value.description : null,
    plan: value.plan,
    status: "ACTIVE",
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseManagerSummary(value: unknown): OrganizationManagerSummary {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    !resourceIdPattern.test(value.userId) ||
    typeof value.fullName !== "string" ||
    !isEmail(value.email) ||
    typeof value.accountStatus !== "string"
  ) {
    throw invalidResponse();
  }
  return {
    userId: value.userId,
    fullName: value.fullName,
    email: value.email,
    accountStatus: value.accountStatus,
  };
}

export function parseOrganizationOverview(
  value: unknown,
  organizationId: string,
): OrganizationOverviewSummary {
  if (!isOrganizationResourceId(organizationId) || !isRecord(value)) {
    throw invalidResponse();
  }
  const organization = parseOrganizationCore(value.organization, organizationId);
  const metrics = value.metrics;
  if (
    !isRecord(metrics) ||
    !isNonnegativeInteger(metrics.activeMembers) ||
    !isNonnegativeInteger(metrics.suspendedMembers) ||
    !isNonnegativeInteger(metrics.pendingInvitations) ||
    !isNonnegativeInteger(metrics.totalProjects) ||
    !isNonnegativeInteger(metrics.activeProjects) ||
    !isNonnegativeInteger(metrics.archivedProjects) ||
    !isNonnegativeInteger(metrics.leaderlessProjectsCount) ||
    !Array.isArray(value.leaderlessProjects) ||
    !Array.isArray(value.managers)
  ) {
    throw invalidResponse();
  }
  const leaderlessProjects: LeaderlessProjectItem[] = value.leaderlessProjects.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !resourceIdPattern.test(item.id) ||
      typeof item.name !== "string" ||
      typeof item.code !== "string" ||
      !(item.visibility === "PRIVATE" || item.visibility === "PUBLIC") ||
      !(item.status === "ACTIVE" || item.status === "ARCHIVED") ||
      !isNonnegativeInteger(item.activeMemberCount) ||
      !isNonnegativeInteger(item.effectiveLeaderCount) ||
      !isDateTime(item.updatedAt)
    ) {
      throw invalidResponse();
    }
    return {
      id: item.id,
      name: item.name,
      code: item.code,
      visibility: item.visibility,
      status: item.status,
      activeMemberCount: item.activeMemberCount,
      effectiveLeaderCount: item.effectiveLeaderCount,
      updatedAt: item.updatedAt,
    };
  });
  return {
    organization,
    metrics: {
      activeMembers: metrics.activeMembers,
      suspendedMembers: metrics.suspendedMembers,
      pendingInvitations: metrics.pendingInvitations,
      totalProjects: metrics.totalProjects,
      activeProjects: metrics.activeProjects,
      archivedProjects: metrics.archivedProjects,
      leaderlessProjectsCount: metrics.leaderlessProjectsCount,
    },
    leaderlessProjects,
    managers: value.managers.map(parseManagerSummary),
  };
}

export function parseOrganizationSettings(
  value: unknown,
  organizationId: string,
): OrganizationSettingsSummary {
  if (!isOrganizationResourceId(organizationId) || !isRecord(value)) {
    throw invalidResponse();
  }
  const organization = parseOrganizationCore(value.organization, organizationId);
  if (
    !Array.isArray(value.editableFields) ||
    !Array.isArray(value.managers) ||
    !Array.isArray(value.availablePermissions)
  ) {
    throw invalidResponse();
  }
  const editableFields = value.editableFields.filter(
    (field): field is "name" | "description" => field === "name" || field === "description",
  );
  const availablePermissions = value.availablePermissions.filter(
    (perm): perm is string => typeof perm === "string",
  );
  return {
    organization,
    editableFields,
    managers: value.managers.map(parseManagerSummary),
    availablePermissions,
  };
}
