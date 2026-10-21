import { apiClient, ApiError } from "@/lib/api-client";
import {
  isOrganizationResourceId,
  parseAdminInvitationPage,
  parseMembershipPage,
  parseMutationAck,
  parseOrganizationOverview,
  parseOrganizationRoleMutationAck,
  parseOrganizationSettings,
  type AdminInvitationPage,
  type CancelInvitationInput,
  type InviteMemberInput,
  type MembershipListStatus,
  type OrganizationMutationAck,
  type OrganizationMembershipPage,
  type OrganizationOverviewSummary,
  type OrganizationRoleMutationAck,
  type OrganizationSettingsSummary,
  type RemoveMembershipInput,
  type ResendInvitationInput,
  type ResumeMembershipInput,
  type SetOrganizationMembershipRoleInput,
  type SuspendMembershipInput,
  type UpdateOrganizationSettingsInput,
} from "./organization-memberships.contract";

export type MembershipListFilter = Readonly<{
  page: number;
  pageSize: number;
  status?: MembershipListStatus;
}>;

const statuses = new Set<string>(["PENDING_INVITE", "ACTIVE", "SUSPENDED", "REMOVED"]);
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

function requireOrganizationId(value: string): string {
  if (!isOrganizationResourceId(value)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid Organization context");
  }
  return encodeURIComponent(value);
}

function requireResourceId(value: string, name: string): string {
  if (!isOrganizationResourceId(value)) {
    throw new ApiError(422, "VALIDATION_FAILED", `Invalid ${name}`);
  }
  return encodeURIComponent(value);
}

function requireVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid expected version");
  }
  return value;
}

function requireNonnegativeVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid expected role version");
  }
  return value;
}

function requireNoInvitationMembership(value: number): 0 {
  if (value !== 0) {
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      "V3 invitations use 0 when no Membership row exists",
    );
  }
  return 0;
}

function requireIdempotencyKey(value: string): string {
  if (!idempotencyPattern.test(value)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid idempotency key");
  }
  return value;
}

function readCsrfToken(): string {
  if (typeof document === "undefined") {
    throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF context is unavailable");
  }
  const csrfCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("__Host-csrf="));
  const csrfToken = csrfCookie?.slice("__Host-csrf=".length);
  if (!csrfToken) {
    throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF token is unavailable");
  }
  return csrfToken;
}

function csrfHeaders(idempotencyKey: string): Headers {
  const key = requireIdempotencyKey(idempotencyKey);
  const csrfToken = readCsrfToken();
  return new Headers({ "X-CSRF-Token": csrfToken, "Idempotency-Key": key });
}

function assertFilter(filter: MembershipListFilter): void {
  if (
    !Number.isSafeInteger(filter.page) || filter.page < 1 ||
    !Number.isSafeInteger(filter.pageSize) || filter.pageSize < 1 || filter.pageSize > 100 ||
    (filter.status !== undefined && !statuses.has(filter.status))
  ) throw new ApiError(422, "VALIDATION_FAILED", "Invalid membership list filter");
}

function timeout(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(15_000);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

export async function listOrganizationMemberships(
  organizationId: string,
  filter: MembershipListFilter,
  signal?: AbortSignal,
): Promise<OrganizationMembershipPage> {
  const organization = requireOrganizationId(organizationId);
  assertFilter(filter);
  const params = new URLSearchParams({ page: String(filter.page), pageSize: String(filter.pageSize) });
  if (filter.status) params.set("status", filter.status);
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/memberships?${params.toString()}`,
    { signal: timeout(signal), cache: "no-store" },
  );
  return parseMembershipPage(response, organizationId);
}

export async function listOrganizationInvitations(
  organizationId: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<AdminInvitationPage> {
  const organization = requireOrganizationId(organizationId);
  assertFilter({ page, pageSize });
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/invitations?${params.toString()}`,
    { signal: timeout(signal), cache: "no-store" },
  );
  return parseAdminInvitationPage(response, organizationId);
}

export async function getOrganizationOverview(
  organizationId: string,
  signal?: AbortSignal,
): Promise<OrganizationOverviewSummary> {
  const organization = requireOrganizationId(organizationId);
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/overview`,
    { signal: timeout(signal), cache: "no-store" },
  );
  return parseOrganizationOverview(response, organizationId);
}

export async function getOrganizationSettings(
  organizationId: string,
  signal?: AbortSignal,
): Promise<OrganizationSettingsSummary> {
  const organization = requireOrganizationId(organizationId);
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/settings`,
    { signal: timeout(signal), cache: "no-store" },
  );
  return parseOrganizationSettings(response, organizationId);
}

export async function updateOrganizationSettings(
  organizationId: string,
  input: UpdateOrganizationSettingsInput,
): Promise<OrganizationSettingsSummary> {
  const organization = requireOrganizationId(organizationId);
  const csrfToken = readCsrfToken();
  const body: Record<string, unknown> = {
    expectedUpdatedAt: input.expectedUpdatedAt,
  };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new ApiError(422, "VALIDATION_FAILED", "Invalid organization name");
    }
    body.name = trimmed;
  }
  if (input.description !== undefined) {
    if (input.description !== null && input.description.length > 500) {
      throw new ApiError(422, "VALIDATION_FAILED", "Invalid organization description");
    }
    body.description = input.description;
  }
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/settings`,
    {
      method: "PATCH",
      headers: new Headers({ "X-CSRF-Token": csrfToken }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  return parseOrganizationSettings(response, organizationId);
}

function mutationOptions(idempotencyKey: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: csrfHeaders(idempotencyKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  };
}

async function mutate(
  path: string,
  organizationId: string,
  idempotencyKey: string,
  body: unknown,
): Promise<OrganizationMutationAck> {
  const response = await apiClient<unknown>(path, mutationOptions(idempotencyKey, body));
  return parseMutationAck(response, organizationId);
}

export function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function inviteOrganizationMember(
  organizationId: string,
  input: InviteMemberInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 ||
    !["ACCESS_REQUEST", "ACCESS_REVIEW"].includes(input.reasonCode)
  ) throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation input");
  if (
    (input.roleCode !== undefined && !["ADMIN", "MEMBER"].includes(input.roleCode)) ||
    (input.accessScope !== undefined && !["ORGANIZATION", "SPECIFIC_PROJECTS"].includes(input.accessScope)) ||
    (input.projectIds !== undefined && (!Array.isArray(input.projectIds) || input.projectIds.some((id) => !isOrganizationResourceId(id)))) ||
    (input.message !== undefined && (typeof input.message !== "string" || input.message.length > 500)) ||
    (input.expiresInDays !== undefined && ![7, 14, 30].includes(input.expiresInDays)) ||
    (input.requireApproval !== undefined && typeof input.requireApproval !== "boolean")
  ) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation input");
  }
  const body = {
    email: input.email,
    reasonCode: input.reasonCode,
    ...(input.roleCode !== undefined ? { roleCode: input.roleCode } : {}),
    ...(input.accessScope !== undefined ? { accessScope: input.accessScope } : {}),
    ...(input.projectIds !== undefined ? { projectIds: input.projectIds } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
    ...(input.expiresInDays !== undefined ? { expiresInDays: input.expiresInDays } : {}),
    ...(input.requireApproval !== undefined ? { requireApproval: input.requireApproval } : {}),
  };
  return mutate(`/iam/organizations/${organization}/invitations`, organizationId, idempotencyKey, body);
}

export function resendOrganizationInvitation(
  organizationId: string,
  invitationId: string,
  input: ResendInvitationInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const invitation = requireResourceId(invitationId, "invitation identifier");
  const body = {
    expectedMembershipVersion: requireNoInvitationMembership(input.expectedMembershipVersion),
    expectedInvitationVersion: requireVersion(input.expectedInvitationVersion),
    reasonCode: input.reasonCode,
  };
  if (!["ACCESS_REQUEST", "ACCESS_REVIEW"].includes(input.reasonCode)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation reason");
  }
  return mutate(`/iam/organizations/${organization}/invitations/${invitation}/resend`, organizationId, idempotencyKey, body);
}

export function cancelOrganizationInvitation(
  organizationId: string,
  invitationId: string,
  input: CancelInvitationInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const invitation = requireResourceId(invitationId, "invitation identifier");
  const body = {
    expectedMembershipVersion: requireNoInvitationMembership(input.expectedMembershipVersion),
    expectedInvitationVersion: requireVersion(input.expectedInvitationVersion),
    reasonCode: input.reasonCode,
  };
  if (input.reasonCode !== "INVITATION_CANCELLED") {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid invitation cancellation reason");
  }
  return mutate(`/iam/organizations/${organization}/invitations/${invitation}/cancel`, organizationId, idempotencyKey, body);
}

export function suspendOrganizationMembership(
  organizationId: string,
  membershipId: string,
  input: SuspendMembershipInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const membership = requireResourceId(membershipId, "membership identifier");
  const body = {
    expectedMembershipVersion: requireVersion(input.expectedMembershipVersion),
    reasonCode: input.reasonCode,
  };
  if (!["SECURITY_INCIDENT", "ACCESS_REVIEW"].includes(input.reasonCode)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid suspension reason");
  }
  return mutate(`/iam/organizations/${organization}/memberships/${membership}/suspend`, organizationId, idempotencyKey, body);
}

export function resumeOrganizationMembership(
  organizationId: string,
  membershipId: string,
  input: ResumeMembershipInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const membership = requireResourceId(membershipId, "membership identifier");
  const body = {
    expectedMembershipVersion: requireVersion(input.expectedMembershipVersion),
    reasonCode: input.reasonCode,
  };
  if (!["ACCESS_REQUEST", "ACCESS_REVIEW", "SECURITY_INCIDENT"].includes(input.reasonCode)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid reactivation reason");
  }
  return mutate(`/iam/organizations/${organization}/memberships/${membership}/resume`, organizationId, idempotencyKey, body);
}

export function removeOrganizationMembership(
  organizationId: string,
  membershipId: string,
  input: RemoveMembershipInput,
  idempotencyKey: string,
): Promise<OrganizationMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const membership = requireResourceId(membershipId, "membership identifier");
  const body = {
    expectedMembershipVersion: requireVersion(input.expectedMembershipVersion),
    reasonCode: input.reasonCode,
  };
  if (
    !["ACCESS_REQUEST", "ACCESS_REVIEW", "SECURITY_INCIDENT"].includes(
      input.reasonCode,
    )
  ) {
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid removal reason");
  }
  return mutate(`/iam/organizations/${organization}/memberships/${membership}/remove`, organizationId, idempotencyKey, body);
}

export async function setOrganizationMembershipRole(
  organizationId: string,
  membershipId: string,
  input: SetOrganizationMembershipRoleInput,
  idempotencyKey: string,
): Promise<OrganizationRoleMutationAck> {
  const organization = requireOrganizationId(organizationId);
  const membership = requireResourceId(membershipId, "membership identifier");
  const reason = input.reason.trim();
  if (
    !["ADMIN", "MEMBER"].includes(input.roleCode) ||
    !reason ||
    input.reason.length > 500
  ) throw new ApiError(422, "VALIDATION_FAILED", "Invalid organization role input");
  const body = {
    expectedMembershipVersion: requireVersion(input.expectedMembershipVersion),
    expectedRoleVersion: requireNonnegativeVersion(input.expectedRoleVersion),
    roleCode: input.roleCode,
    reason,
  };
  const response = await apiClient<unknown>(
    `/iam/organizations/${organization}/memberships/${membership}/role`,
    mutationOptions(idempotencyKey, body),
  );
  return parseOrganizationRoleMutationAck(response, organizationId);
}
