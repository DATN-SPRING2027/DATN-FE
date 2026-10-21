"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import {
  csrfHeaders,
  platformApiClient,
  platformKeys,
  type PlatformPage,
} from "./usePlatformConsole";

const idPattern = /^[a-f\d]{24}$/i;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const safeRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const userStatuses = new Set(["ACTIVE", "SUSPENDED", "PENDING_INVITE"]);
const userListStatuses = new Set([
  ...userStatuses,
  "ARCHIVED",
]);
const roles = new Set(["ADMIN", "MEMBER"]);
const sessionStatuses = new Set(["ACTIVE", "REVOKED", "EXPIRED"]);
const sessionContexts = new Set(["ACCOUNT", "ORGANIZATION", "PLATFORM"]);
const projectVisibilities = new Set(["PUBLIC", "PRIVATE"]);
const projectStatuses = new Set(["ACTIVE", "ARCHIVED"]);
const serviceIds = new Set([
  "iam",
  "capture",
  "jira",
  "lifecycle",
  "chat",
  "handover",
  "ingestion",
  "notification",
]);
const readinessStates = new Set([
  "READY",
  "DEGRADED",
  "UNAVAILABLE",
  "UNKNOWN",
]);
const availabilityStates = new Set(["AVAILABLE", "UNAVAILABLE"]);
const jobStatuses = new Set([
  "WAITING",
  "ACTIVE",
  "COMPLETED",
  "FAILED",
  "DELAYED",
  "PAUSED",
  "WAITING_CHILDREN",
  "UNKNOWN",
]);
const integrationStatuses = new Set(["CONNECTED", "EXPIRED", "REVOKED"]);
const incidentStatuses = new Set(["OPEN", "ACKNOWLEDGED", "RESOLVED"]);
const incidentSeverities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const incidentServices = serviceIds;
const auditActions = new Set([
  "organization.create",
  "platform.authority.granted",
  "platform.authority.revoked",
  "platform.user.status.changed",
  "platform.user.profile.updated",
  "platform.user.archived",
  "platform.session.revoked",
  "platform.sessions.revoked_all",
  "ORGANIZATION_MEMBERSHIP_SUSPENDED",
  "platform.organization.metadata.changed",
  "platform.project.metadata.changed",
  "platform.incident.created",
  "platform.incident.acknowledged",
  "platform.incident.resolved",
  "platform.incident.note.added",
  "platform.job.retry",
  "platform.job.cancel",
]);
const auditResources = new Set([
  "ORGANIZATION",
  "PLATFORM_AUTHORITY",
  "ORGANIZATION_MEMBERSHIP",
  "USER",
  "PROJECT",
  "SESSION",
  "INCIDENT",
  "JOB",
]);

export type PlatformUserRecord = Readonly<{
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  archivedAt: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
  createdAt: string;
  updatedAt: string;
  memberships: readonly Readonly<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    status: string;
    organizationRoles: readonly string[];
  }>[];
  membershipsTruncated: boolean;
  lastLoginAt?: string | null;
  effectivePlatformPermissions?: readonly Readonly<{
    permission: string;
    scope: string;
    status: string;
    source: string;
    grantedAt: string | null;
    expiresAt: string | null;
    effective: boolean;
  }>[];
}>;
export type PlatformProjectRecord = Readonly<{
  id: string;
  organization: Readonly<{ id: string; name: string; slug: string }>;
  name: string;
  code: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: "ACTIVE" | "ARCHIVED";
  memberCount: number;
  leaders: readonly Readonly<{ id: string; email: string; fullName: string }>[];
  leadersTruncated: boolean;
  createdAt: string;
  updatedAt: string;
}>;
export type PlatformOrganizationInvitation = Readonly<{
  id: string;
  membershipId: string | null;
  organizationId: string;
  status: "PENDING";
  version: number;
  expiresAt: string;
  createdAt: string;
  membershipVersion: number;
  targetUserId: string | null;
  email: string;
}>;
export type PlatformDashboardRecord = Readonly<{
  organizations: Readonly<{ total: number }>;
  users: Readonly<{
    total: number;
    active: number;
    suspended: number;
    pendingInvite: number;
  }>;
  projects: Readonly<{ total: number; active: number; archived: number }>;
  memberships: Readonly<{
    total: number;
    active: number;
    suspended: number;
    pendingInvite: number;
    removed: number;
  }>;
  generatedAt: string;
  serviceHealth: Readonly<{
    status: string;
    total: number | null;
    ready: number | null;
    degraded: number | null;
    unavailable: number | null;
    lastCheckedAt: string | null;
  }>;
  recentOperationalActivity: Readonly<{
    availability: string;
    items: readonly Readonly<{
      action: string;
      resourceType: string;
      occurredAt: string;
    }>[];
  }>;
}>;
export type PlatformServiceRecord = Readonly<{
  id: string;
  name: string;
  status: string;
  availability: string;
  liveness: string;
  readiness: string;
  dependencies: Readonly<Record<string, unknown>>;
  lastCheckedAt: string | null;
  diagnosticsSummary: string;
}>;
export type PlatformQueueRecord = Readonly<{
  id: string;
  status: string;
  availability: string;
  paused: boolean | null;
  workers: number | null;
  depth: number | null;
  counts: Readonly<Record<string, number>> | null;
  lastCheckedAt: string;
}>;
export type PlatformJobRecord = Readonly<{
  id: string;
  queueId: string;
  status: string;
  attemptsMade: number;
  attempts: number;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
  failureSummary?: string;
}>;
export type PlatformIntegrationRecord = Readonly<{
  id: string;
  provider: "JIRA";
  organizationId: string;
  projectId: string;
  status: string;
  lastSyncAt: string | null;
  lastFailureAt: string | null;
  lastFailureSummary: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type PlatformIncidentRecord = Readonly<{
  id: string;
  title: string;
  severity: string;
  status: string;
  affectedServiceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}>;
export type PlatformIncidentHistory = Readonly<{
  id: string;
  incidentId: string;
  action: string;
  fromStatus?: string;
  toStatus: string;
  version: number;
  actorUserId: string;
  occurredAt: string;
  note?: string;
}>;
export type PlatformAuditEvent = Readonly<{
  eventId: string;
  occurredAt: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  scope: "PLATFORM";
  result: "SUCCESS";
  organizationId?: string;
  reasonCode?: string;
  requestId?: string;
  changedFields?: readonly ("fullName" | "avatarUrl")[];
  changes?: Readonly<
    Record<
      string,
      Readonly<{
        from: string | number | boolean | null;
        to: string | number | boolean | null;
      }>
    >
  >;
}>;
export type PlatformTrace = Readonly<{
  requestId: string;
  events: readonly PlatformAuditEvent[];
  truncated: boolean;
}>;

export type PlatformPageFilter = Readonly<{ page?: number; pageSize?: number }>;
export type PlatformUserFilters = PlatformPageFilter &
  Readonly<{
    search?: string;
    status?: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE" | "ARCHIVED";
    organizationId?: string;
    roleCode?: "ADMIN" | "MEMBER";
  }>;
export type PlatformProjectFilters = PlatformPageFilter &
  Readonly<{
    search?: string;
    organizationId?: string;
    visibility?: "PUBLIC" | "PRIVATE";
    status?: "ACTIVE" | "ARCHIVED";
  }>;
export type PlatformJobFilters = PlatformPageFilter &
  Readonly<{ queueId?: string; status?: string }>;
export type PlatformIntegrationFilters = PlatformPageFilter &
  Readonly<{ organizationId?: string; projectId?: string; status?: string }>;
export type PlatformIncidentFilters = PlatformPageFilter &
  Readonly<{ status?: string; severity?: string; affectedServiceId?: string }>;
export type PlatformAuditFilters = PlatformPageFilter &
  Readonly<{
    actorUserId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    organizationId?: string;
    from?: string;
    to?: string;
  }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(value: unknown, max = 2048): value is string {
  return typeof value === "string" && value.length <= max;
}
function isId(value: unknown): value is string {
  return typeof value === "string" && idPattern.test(value);
}
function isTimestamp(value: unknown): value is string {
  return (
    isText(value, 64) &&
    timestampPattern.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function optionalTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}
function isSafeProfileAvatarUrl(value: string): boolean {
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
function invalidResponse(): ApiError {
  return new ApiError(
    502,
    "INVALID_PLATFORM_RESPONSE",
    "The Platform API returned an invalid response",
  );
}
function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw invalidResponse();
  return value;
}
function requireText(value: unknown, max = 2048): string {
  if (!isText(value, max)) throw invalidResponse();
  return value;
}
function requireInteger(value: unknown, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw invalidResponse();
  return value;
}
function requireTimestamp(value: unknown): string {
  if (!isTimestamp(value)) throw invalidResponse();
  return value;
}
function requireId(value: unknown): string {
  if (!isId(value)) throw invalidResponse();
  return value;
}
function safeDependencyMap(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value) || Object.keys(value).length > 40)
    throw invalidResponse();
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      !/^[A-Za-z0-9_.-]{1,80}$/.test(key) ||
      /(secret|password|token|credential|api.?key|payload|stack|raw.?error)/i.test(
        key,
      )
    )
      continue;
    if (typeof item === "string") clean[key] = item.slice(0, 160);
    else if (typeof item === "number" && Number.isFinite(item))
      clean[key] = item;
    else if (typeof item === "boolean" || item === null) clean[key] = item;
    else if (isRecord(item)) {
      const statusFields = [
        "status",
        "availability",
        "readiness",
        "liveness",
        "healthy",
      ];
      const status = Object.fromEntries(
        statusFields
          .filter(
            (field) =>
              typeof item[field] === "string" ||
              typeof item[field] === "boolean",
          )
          .map((field) => [field, item[field]]),
      );
      if (Object.keys(status).length) clean[key] = status;
    }
  }
  return clean;
}
function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): PlatformPage<T> {
  const row = requireRecord(value);
  const pagination = requireRecord(row.pagination);
  if (!Array.isArray(row.data) || row.data.length > 100)
    throw invalidResponse();
  return {
    data: row.data.map(parseItem),
    pagination: {
      page: requireInteger(pagination.page, 1),
      pageSize: requireInteger(pagination.pageSize, 1),
      totalItems: requireInteger(pagination.totalItems),
      totalPages: requireInteger(pagination.totalPages),
    },
  };
}
function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") query.set(key, String(value));
  return query.toString();
}
function pageValues(filter: PlatformPageFilter) {
  return { page: filter.page ?? 1, pageSize: filter.pageSize ?? 25 };
}
function parseUser(value: unknown): PlatformUserRecord {
  const row = requireRecord(value);
  const avatarUrl =
    row.avatarUrl === undefined || row.avatarUrl === null
      ? null
      : requireText(row.avatarUrl, 2000);
  if (
    !userStatuses.has(String(row.status)) ||
    (avatarUrl !== null && !isSafeProfileAvatarUrl(avatarUrl)) ||
    (row.archivedAt !== undefined &&
      row.archivedAt !== null &&
      !isTimestamp(row.archivedAt)) ||
    !Array.isArray(row.memberships) ||
    row.memberships.length > 100 ||
    typeof row.membershipsTruncated !== "boolean"
  )
    throw invalidResponse();
  const memberships = row.memberships.map((item) => {
    const member = requireRecord(item);
    if (
      !isText(member.status, 32) ||
      !Array.isArray(member.organizationRoles) ||
      member.organizationRoles.some((role) => !roles.has(String(role)))
    )
      throw invalidResponse();
    return {
      organizationId: requireId(member.organizationId),
      organizationName: requireText(member.organizationName, 200),
      organizationSlug: requireText(member.organizationSlug, 100),
      status: member.status,
      organizationRoles: [...new Set(member.organizationRoles as string[])],
    };
  });
  const result: PlatformUserRecord = {
    id: requireId(row.id),
    email: requireText(row.email, 254),
    fullName: requireText(row.fullName, 200),
    avatarUrl,
    archivedAt:
      row.archivedAt === undefined || row.archivedAt === null
        ? null
        : requireTimestamp(row.archivedAt),
    status: row.status as PlatformUserRecord["status"],
    createdAt: requireTimestamp(row.createdAt),
    updatedAt: requireTimestamp(row.updatedAt),
    memberships,
    membershipsTruncated: row.membershipsTruncated,
  };
  const optional: Partial<PlatformUserRecord> = {};
  if (Object.hasOwn(row, "lastLoginAt")) {
    if (!optionalTimestamp(row.lastLoginAt)) throw invalidResponse();
    Object.assign(optional, { lastLoginAt: row.lastLoginAt });
  }
  if (Object.hasOwn(row, "effectivePlatformPermissions")) {
    if (
      !Array.isArray(row.effectivePlatformPermissions) ||
      row.effectivePlatformPermissions.length > 100
    )
      throw invalidResponse();
    Object.assign(optional, {
      effectivePlatformPermissions: row.effectivePlatformPermissions.map(
        (item) => {
          const permission = requireRecord(item);
          if (
            typeof permission.effective !== "boolean" ||
            !optionalTimestamp(permission.grantedAt ?? null) ||
            !optionalTimestamp(permission.expiresAt ?? null)
          )
            throw invalidResponse();
          return {
            permission: requireText(permission.permission, 160),
            scope: requireText(permission.scope, 80),
            status: requireText(permission.status, 40),
            source: requireText(permission.source, 80),
            grantedAt: (permission.grantedAt ?? null) as string | null,
            expiresAt: (permission.expiresAt ?? null) as string | null,
            effective: permission.effective,
          };
        },
      ),
    });
  }
  return { ...result, ...optional };
}
function parseSession(value: unknown) {
  const row = requireRecord(value);
  if (
    !sessionContexts.has(String(row.context)) ||
    !sessionStatuses.has(String(row.status)) ||
    !Object.hasOwn(row, "organizationId")
  )
    throw invalidResponse();
  if (row.organizationId !== null && !isId(row.organizationId))
    throw invalidResponse();
  const id = requireText(row.id, 128);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw invalidResponse();
  return {
    id,
    userId: requireId(row.userId),
    context: row.context as string,
    organizationId: row.organizationId as string | null,
    status: row.status as string,
    createdAt: requireTimestamp(row.createdAt),
    updatedAt: requireTimestamp(row.updatedAt),
    expiresAt: requireTimestamp(row.expiresAt),
  };
}
function parseProject(value: unknown): PlatformProjectRecord {
  const row = requireRecord(value);
  const organization = requireRecord(row.organization);
  if (
    !projectVisibilities.has(String(row.visibility)) ||
    !projectStatuses.has(String(row.status)) ||
    typeof row.leadersTruncated !== "boolean" ||
    !Array.isArray(row.leaders) ||
    row.leaders.length > 100
  )
    throw invalidResponse();
  return {
    id: requireId(row.id),
    organization: {
      id: requireId(organization.id),
      name: requireText(organization.name, 200),
      slug: requireText(organization.slug, 100),
    },
    name: requireText(row.name, 200),
    code: requireText(row.code, 100),
    visibility: row.visibility as PlatformProjectRecord["visibility"],
    status: row.status as PlatformProjectRecord["status"],
    memberCount: requireInteger(row.memberCount),
    leaders: row.leaders.map((item) => {
      const leader = requireRecord(item);
      return {
        id: requireId(leader.id),
        email: requireText(leader.email, 254),
        fullName: requireText(leader.fullName, 200),
      };
    }),
    leadersTruncated: row.leadersTruncated,
    createdAt: requireTimestamp(row.createdAt),
    updatedAt: requireTimestamp(row.updatedAt),
  };
}
function parseOrganization(value: unknown) {
  const row = requireRecord(value);
  if (row.plan !== "FREE" && row.plan !== "ENTERPRISE") throw invalidResponse();
  return {
    id: requireId(row.id),
    name: requireText(row.name, 200),
    slug: requireText(row.slug, 100),
    plan: row.plan,
    createdAt: requireTimestamp(row.createdAt),
    updatedAt: requireTimestamp(row.updatedAt),
  } as const;
}
function parseAuditEvent(value: unknown): PlatformAuditEvent {
  const row = requireRecord(value);
  if (
    !auditActions.has(String(row.action)) ||
    !auditResources.has(String(row.resourceType)) ||
    row.scope !== "PLATFORM" ||
    row.result !== "SUCCESS"
  )
    throw invalidResponse();
  const result: PlatformAuditEvent = {
    eventId: requireText(row.eventId, 128),
    occurredAt: requireTimestamp(row.occurredAt),
    actorUserId: requireId(row.actorUserId),
    action: row.action as string,
    resourceType: row.resourceType as string,
    resourceId: requireText(row.resourceId, 240),
    scope: "PLATFORM",
    result: "SUCCESS",
  };
  const optional: Partial<PlatformAuditEvent> = {};
  if (row.organizationId !== undefined)
    Object.assign(optional, { organizationId: requireId(row.organizationId) });
  if (row.reasonCode !== undefined)
    Object.assign(optional, { reasonCode: requireText(row.reasonCode, 64) });
  if (row.requestId !== undefined)
    Object.assign(optional, { requestId: requireText(row.requestId, 128) });
  if (row.changedFields !== undefined) {
    if (
      !Array.isArray(row.changedFields) ||
      row.changedFields.length > 2 ||
      row.changedFields.some(
        (field) => field !== "fullName" && field !== "avatarUrl",
      )
    )
      throw invalidResponse();
    Object.assign(optional, {
      changedFields: [...new Set(row.changedFields as ("fullName" | "avatarUrl")[])],
    });
  }
  if (row.changes !== undefined) {
    const changes = requireRecord(row.changes);
    const clean: Record<
      string,
      {
        from: string | number | boolean | null;
        to: string | number | boolean | null;
      }
    > = {};
    for (const [key, value] of Object.entries(changes).slice(0, 40)) {
      if (
        !/^[A-Za-z0-9_.-]{1,80}$/.test(key) ||
        /(secret|password|token|credential|api.?key|content|payload)/i.test(key)
      )
        continue;
      const change = requireRecord(value);
      const valid = (item: unknown) =>
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean";
      if (!valid(change.from) || !valid(change.to)) throw invalidResponse();
      clean[key] = {
        from: change.from as string | number | boolean | null,
        to: change.to as string | number | boolean | null,
      };
    }
    Object.assign(optional, { changes: clean });
  }
  return { ...result, ...optional };
}
function parseIncident(value: unknown): PlatformIncidentRecord {
  const row = requireRecord(value);
  if (
    !incidentSeverities.has(String(row.severity)) ||
    !incidentStatuses.has(String(row.status)) ||
    !incidentServices.has(String(row.affectedServiceId)) ||
    !optionalTimestamp(row.acknowledgedAt) ||
    !optionalTimestamp(row.resolvedAt)
  )
    throw invalidResponse();
  return {
    id: requireId(row.id),
    title: requireText(row.title, 200),
    severity: row.severity as string,
    status: row.status as string,
    affectedServiceId: row.affectedServiceId as string,
    version: requireInteger(row.version, 1),
    createdAt: requireTimestamp(row.createdAt),
    updatedAt: requireTimestamp(row.updatedAt),
    createdBy: requireId(row.createdBy),
    updatedBy: requireId(row.updatedBy),
    acknowledgedAt: row.acknowledgedAt as string | null,
    resolvedAt: row.resolvedAt as string | null,
  };
}
function newRequestId(): string {
  const requestId = globalThis.crypto?.randomUUID?.();
  if (!requestId || !safeRequestIdPattern.test(requestId))
    throw new ApiError(
      500,
      "REQUEST_ID_UNAVAILABLE",
      "A request identifier could not be created",
    );
  return requestId;
}
function mutationHeaders(requestId = newRequestId()) {
  const headers = csrfHeaders();
  headers.set("X-Request-ID", requestId);
  return headers;
}
function idempotentHeaders() {
  return csrfHeaders(globalThis.crypto.randomUUID());
}
function invalidateOperations(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: platformKeys.all }),
    client.invalidateQueries({
      queryKey: [...platformKeys.all, "audit-events"],
    }),
  ]);
}
function invalidateOnConflict(
  client: ReturnType<typeof useQueryClient>,
  error: unknown,
) {
  if (error instanceof ApiError && error.status === 409)
    void invalidateOperations(client);
}

export function usePlatformUsersQuery(
  filters: PlatformUserFilters,
  enabled: boolean,
) {
  if (filters.status !== undefined && !userListStatuses.has(filters.status))
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid user filter");
  const query = queryString({
    ...pageValues(filters),
    search: filters.search?.trim(),
    status: filters.status,
    organizationId: filters.organizationId,
    roleCode: filters.roleCode,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "users", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/users?${query}`, {
          cache: "no-store",
        }),
        parseUser,
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformUserQuery(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "user", userId],
    queryFn: async () =>
      parseUser(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(userId)}`,
          { cache: "no-store" },
        ),
      ),
    enabled: enabled && idPattern.test(userId),
    retry: false,
  });
}
export function usePlatformUserOrganizationsQuery(
  userId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: [...platformKeys.all, "user", userId, "organizations", page],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(userId)}/organizations?page=${page}&pageSize=25`,
          { cache: "no-store" },
        ),
        (item) => {
          const row = requireRecord(item);
          return {
            organizationId: requireId(row.organizationId),
            organizationName: requireText(row.organizationName, 200),
            organizationSlug: requireText(row.organizationSlug, 100),
            status: requireText(row.status, 32),
            organizationRoles:
              Array.isArray(row.organizationRoles) &&
              row.organizationRoles.every((role) => roles.has(String(role)))
                ? [...new Set(row.organizationRoles as string[])]
                : (() => {
                    throw invalidResponse();
                  })(),
          };
        },
      ),
    enabled: enabled && idPattern.test(userId),
    retry: false,
  });
}
export function usePlatformUserSessionsQuery(
  userId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: [...platformKeys.all, "user", userId, "sessions", page],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(userId)}/sessions?page=${page}&pageSize=25`,
          { cache: "no-store" },
        ),
        parseSession,
      ),
    enabled: enabled && idPattern.test(userId),
    retry: false,
  });
}
export function usePlatformUserSessionQuery(
  userId: string,
  sessionId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...platformKeys.all, "user", userId, "session", sessionId],
    queryFn: async () =>
      parseSession(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        ),
      ),
    enabled:
      enabled &&
      idPattern.test(userId) &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(sessionId),
    retry: false,
  });
}
export function usePlatformOrganizationInvitationsQuery(
  organizationId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: [
      ...platformKeys.all,
      "organization",
      organizationId,
      "invitations",
      page,
    ],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/organizations/${encodeURIComponent(organizationId)}/invitations?page=${page}&pageSize=25`,
          { cache: "no-store" },
        ),
        (item) => {
          const invitation = requireRecord(item);
          if (invitation.status !== "PENDING") throw invalidResponse();
          return {
            id: requireId(invitation.id),
            membershipId: invitation.membershipId === null ? null : requireId(invitation.membershipId),
            organizationId: requireId(invitation.organizationId),
            status: "PENDING" as const,
            version: requireInteger(invitation.version, 1),
            expiresAt: requireTimestamp(invitation.expiresAt),
            createdAt: requireTimestamp(invitation.createdAt),
            membershipVersion: requireInteger(invitation.membershipVersion, 0),
            targetUserId: invitation.targetUserId === null ? null : requireId(invitation.targetUserId),
            email: requireText(invitation.email, 254),
          } satisfies PlatformOrganizationInvitation;
        },
      ),
    enabled: enabled && idPattern.test(organizationId),
    retry: false,
  });
}
export function usePlatformChangeOrganizationMetadataMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        organizationId: string;
        name?: string;
        slug?: string;
        expectedUpdatedAt: string;
        reasonCode: "ACCESS_REVIEW" | "SECURITY_INCIDENT";
      }>,
    ) => {
      if (
        !idPattern.test(input.organizationId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        (!input.name && !input.slug) ||
        (input.name !== undefined &&
          (!input.name.trim() || input.name.length > 200)) ||
        (input.slug !== undefined &&
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid Organization metadata operation",
        );
      const { organizationId, ...body } = input;
      const updated = parseOrganization(
        await platformApiClient<unknown>(
          `/iam/platform/organizations/${encodeURIComponent(organizationId)}`,
          {
            method: "PATCH",
            headers: mutationHeaders(),
            body: JSON.stringify(body),
            cache: "no-store",
          },
        ),
      );
      if (updated.id !== organizationId) throw invalidResponse();
      return updated;
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformUpdateUserProfileMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        userId: string;
        fullName?: string;
        avatarUrl?: string | null;
        expectedUpdatedAt: string;
      }>,
    ) => {
      if (
        !idPattern.test(input.userId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        (input.fullName === undefined && input.avatarUrl === undefined) ||
        (input.fullName !== undefined &&
          (!input.fullName.trim() || input.fullName.trim().length > 200)) ||
        (input.avatarUrl !== undefined &&
          input.avatarUrl !== null &&
          !isSafeProfileAvatarUrl(input.avatarUrl))
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid Platform user profile update",
        );
      const body = {
        ...(input.fullName === undefined
          ? {}
          : { fullName: input.fullName.trim() }),
        ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
        expectedUpdatedAt: input.expectedUpdatedAt,
      };
      const updated = parseUser(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(input.userId)}`,
          {
            method: "PATCH",
            headers: mutationHeaders(),
            body: JSON.stringify(body),
            cache: "no-store",
          },
        ),
      );
      if (updated.id !== input.userId) throw invalidResponse();
      return updated;
    },
    retry: false,
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}

export function usePlatformArchiveUserMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        userId: string;
        expectedUpdatedAt: string;
        reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
      }>,
    ) => {
      if (
        !idPattern.test(input.userId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        !["SECURITY_INCIDENT", "ACCESS_REVIEW"].includes(input.reasonCode)
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid Platform user archive operation",
        );
      const archived = parseUser(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(input.userId)}/archive`,
          {
            method: "POST",
            headers: mutationHeaders(),
            body: JSON.stringify({
              expectedUpdatedAt: input.expectedUpdatedAt,
              reasonCode: input.reasonCode,
            }),
            cache: "no-store",
          },
        ),
      );
      if (
        archived.id !== input.userId ||
        archived.status !== "SUSPENDED" ||
        !archived.archivedAt
      )
        throw invalidResponse();
      return archived;
    },
    retry: false,
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}

export function usePlatformRestoreUserMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        userId: string;
        expectedUpdatedAt: string;
        reasonCode: "ACCESS_REVIEW";
      }>,
    ) => {
      if (
        !idPattern.test(input.userId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        input.reasonCode !== "ACCESS_REVIEW"
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid Platform user restore operation",
        );
      const restored = parseUser(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(input.userId)}/restore`,
          {
            method: "POST",
            headers: mutationHeaders(),
            body: JSON.stringify({
              expectedUpdatedAt: input.expectedUpdatedAt,
              reasonCode: input.reasonCode,
            }),
            cache: "no-store",
          },
        ),
      );
      if (
        restored.id !== input.userId ||
        restored.status !== "SUSPENDED" ||
        restored.archivedAt !== null
      )
        throw invalidResponse();
      return restored;
    },
    retry: false,
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}

export function usePlatformChangeUserStatusMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        userId: string;
        status: "ACTIVE" | "SUSPENDED";
        expectedUpdatedAt: string;
        reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
      }>,
    ) => {
      if (
        !idPattern.test(input.userId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        !userStatuses.has(input.status)
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid user status operation",
        );
      const updated = parseUser(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(input.userId)}/status`,
          {
            method: "PATCH",
            headers: mutationHeaders(),
            body: JSON.stringify({
              status: input.status,
              expectedUpdatedAt: input.expectedUpdatedAt,
              reasonCode: input.reasonCode,
            }),
            cache: "no-store",
          },
        ),
      );
      if (updated.id !== input.userId || updated.status !== input.status)
        throw invalidResponse();
      return updated;
    },
    retry: false,
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformRevokeSessionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        userId: string;
        sessionId: string;
        expectedUpdatedAt: string;
        reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
      }>,
    ) => {
      if (
        !idPattern.test(input.userId) ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(input.sessionId) ||
        !isTimestamp(input.expectedUpdatedAt)
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid session operation",
        );
      const updated = parseSession(
        await platformApiClient<unknown>(
          `/iam/platform/users/${encodeURIComponent(input.userId)}/sessions/${encodeURIComponent(input.sessionId)}/revoke`,
          {
            method: "POST",
            headers: mutationHeaders(),
            body: JSON.stringify({
              expectedUpdatedAt: input.expectedUpdatedAt,
              reasonCode: input.reasonCode,
            }),
            cache: "no-store",
          },
        ),
      );
      if (
        updated.id !== input.sessionId ||
        updated.userId !== input.userId ||
        updated.status !== "REVOKED"
      )
        throw invalidResponse();
      return updated;
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformProjectsQuery(
  filters: PlatformProjectFilters,
  enabled: boolean,
) {
  const query = queryString({
    ...pageValues(filters),
    search: filters.search?.trim(),
    organizationId: filters.organizationId,
    visibility: filters.visibility,
    status: filters.status,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "projects", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/projects?${query}`, {
          cache: "no-store",
        }),
        parseProject,
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformProjectQuery(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "project", projectId],
    queryFn: async () =>
      parseProject(
        await platformApiClient<unknown>(
          `/iam/platform/projects/${encodeURIComponent(projectId)}`,
          { cache: "no-store" },
        ),
      ),
    enabled: enabled && idPattern.test(projectId),
    retry: false,
  });
}
export function usePlatformChangeProjectMetadataMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        projectId: string;
        name?: string;
        code?: string;
        visibility?: "PUBLIC" | "PRIVATE";
        expectedUpdatedAt: string;
        reasonCode: "ACCESS_REVIEW" | "SECURITY_INCIDENT";
      }>,
    ) => {
      if (
        !idPattern.test(input.projectId) ||
        !isTimestamp(input.expectedUpdatedAt) ||
        (!input.name && !input.code && !input.visibility)
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid project metadata operation",
        );
      const { projectId, ...body } = input;
      const updated = parseProject(
        await platformApiClient<unknown>(
          `/iam/platform/projects/${encodeURIComponent(projectId)}`,
          {
            method: "PATCH",
            headers: mutationHeaders(),
            body: JSON.stringify(body),
            cache: "no-store",
          },
        ),
      );
      if (updated.id !== projectId) throw invalidResponse();
      return updated;
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformDashboardQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "dashboard"],
    queryFn: async () => {
      const row = requireRecord(
        await platformApiClient<unknown>("/iam/platform/dashboard", {
          cache: "no-store",
        }),
      );
      const counts = (value: unknown, keys: readonly string[]) => {
        const v = requireRecord(value);
        const result: Record<string, number> = {};
        for (const key of keys) result[key] = requireInteger(v[key]);
        return result;
      };
      const health = requireRecord(row.serviceHealth);
      const activity = requireRecord(row.recentOperationalActivity);
      if (
        !Array.isArray(activity.items) ||
        activity.items.length > 5 ||
        !["AVAILABLE", "UNAVAILABLE"].includes(String(activity.availability))
      )
        throw invalidResponse();
      const nullableNumber = (value: unknown) =>
        value === null ? null : requireInteger(value);
      const lastCheckedAt =
        health.lastCheckedAt === null
          ? null
          : requireTimestamp(health.lastCheckedAt);
      return {
        organizations: counts(row.organizations, [
          "total",
        ]) as PlatformDashboardRecord["organizations"],
        users: counts(row.users, [
          "total",
          "active",
          "suspended",
          "pendingInvite",
        ]) as PlatformDashboardRecord["users"],
        projects: counts(row.projects, [
          "total",
          "active",
          "archived",
        ]) as PlatformDashboardRecord["projects"],
        memberships: counts(row.memberships, [
          "total",
          "active",
          "suspended",
          "pendingInvite",
          "removed",
        ]) as PlatformDashboardRecord["memberships"],
        generatedAt: requireTimestamp(row.generatedAt),
        serviceHealth: {
          status: requireText(health.status, 32),
          total: nullableNumber(health.total),
          ready: nullableNumber(health.ready),
          degraded: nullableNumber(health.degraded),
          unavailable: nullableNumber(health.unavailable),
          lastCheckedAt,
        },
        recentOperationalActivity: {
          availability: activity.availability as string,
          items: activity.items.map((item) => {
            const event = requireRecord(item);
            if (
              !auditActions.has(String(event.action)) ||
              !auditResources.has(String(event.resourceType))
            )
              throw invalidResponse();
            return {
              action: event.action as string,
              resourceType: event.resourceType as string,
              occurredAt: requireTimestamp(event.occurredAt),
            };
          }),
        },
      } satisfies PlatformDashboardRecord;
    },
    enabled,
    retry: false,
    staleTime: 15_000,
  });
}
export function usePlatformServicesQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "services"],
    queryFn: async () => {
      const row = requireRecord(
        await platformApiClient<unknown>("/iam/platform/services", {
          cache: "no-store",
        }),
      );
      if (!Array.isArray(row.data) || row.data.length > 100)
        throw invalidResponse();
      return row.data.map((item) => {
        const service = requireRecord(item);
        if (
          !serviceIds.has(String(service.id)) ||
          !availabilityStates.has(String(service.availability)) ||
          !availabilityStates.has(String(service.liveness)) ||
          !readinessStates.has(String(service.status)) ||
          !readinessStates.has(String(service.readiness))
        )
          throw invalidResponse();
        return {
          id: service.id as string,
          name: requireText(service.name, 100),
          status: service.status as string,
          availability: service.availability as string,
          liveness: service.liveness as string,
          readiness: service.readiness as string,
          dependencies: safeDependencyMap(service.dependencies),
          lastCheckedAt:
            service.lastCheckedAt === null
              ? null
              : requireTimestamp(service.lastCheckedAt),
          diagnosticsSummary: requireText(service.diagnosticsSummary, 300),
        } satisfies PlatformServiceRecord;
      });
    },
    enabled,
    retry: false,
  });
}
export function usePlatformQueuesQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "queues"],
    queryFn: async () => {
      const row = requireRecord(
        await platformApiClient<unknown>("/iam/platform/queues", { cache: "no-store" }),
      );
      if (!Array.isArray(row.data) || row.data.length > 100)
        throw invalidResponse();
      return row.data.map((item) => {
        const queue = requireRecord(item);
        if (
          !availabilityStates.has(String(queue.availability)) ||
          !["READY", "DEGRADED", "UNAVAILABLE"].includes(
            String(queue.status),
          ) ||
          !(queue.paused === null || typeof queue.paused === "boolean")
        )
          throw invalidResponse();
        const numberOrNull = (v: unknown) =>
          v === null ? null : requireInteger(v);
        let counts: Readonly<Record<string, number>> | null = null;
        if (queue.counts !== null) {
          const c = requireRecord(queue.counts);
          counts = Object.fromEntries(
            Object.entries(c)
              .filter(([key]) => /^[A-Za-z]{1,32}$/.test(key))
              .map(([key, v]) => [key, requireInteger(v)]),
          );
        }
        return {
          id: requireText(queue.id, 100),
          status: queue.status as string,
          availability: queue.availability as string,
          paused: queue.paused as boolean | null,
          workers: numberOrNull(queue.workers),
          depth: numberOrNull(queue.depth),
          counts,
          lastCheckedAt: requireTimestamp(queue.lastCheckedAt),
        } satisfies PlatformQueueRecord;
      });
    },
    enabled,
    retry: false,
  });
}
export function usePlatformJobsQuery(
  filters: PlatformJobFilters,
  enabled: boolean,
) {
  const query = queryString({
    ...pageValues(filters),
    queueId: filters.queueId,
    status: filters.status,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "jobs", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/jobs?${query}`, {
          cache: "no-store",
        }),
        (item) => {
          const job = requireRecord(item);
          if (
            !jobStatuses.has(String(job.status)) ||
            !optionalTimestamp(job.createdAt) ||
            !optionalTimestamp(job.processedAt) ||
            !optionalTimestamp(job.finishedAt)
          )
            throw invalidResponse();
          return {
            id: requireText(job.id, 200),
            queueId: requireText(job.queueId, 100),
            status: job.status as string,
            attemptsMade: requireInteger(job.attemptsMade),
            attempts: requireInteger(job.attempts),
            createdAt: job.createdAt as string | null,
            processedAt: job.processedAt as string | null,
            finishedAt: job.finishedAt as string | null,
            ...(job.failureSummary === undefined
              ? {}
              : { failureSummary: requireText(job.failureSummary, 100) }),
          };
        },
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformJobCommandMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        queueId: string;
        jobId: string;
        action: "retry" | "cancel";
        expectedStatus: "FAILED" | "WAITING" | "DELAYED";
      }>,
    ) => {
      if (
        !/^[A-Za-z0-9._:-]{1,100}$/.test(input.queueId) ||
        !/^[A-Za-z0-9._:-]{1,200}$/.test(input.jobId) ||
        (input.action === "retry"
          ? input.expectedStatus !== "FAILED"
          : !["WAITING", "DELAYED"].includes(input.expectedStatus))
      )
        throw new ApiError(422, "VALIDATION_FAILED", "Invalid job command");
      const { queueId, jobId, action, expectedStatus } = input;
      const result = requireRecord(
        await platformApiClient<unknown>(
          `/iam/platform/jobs/${encodeURIComponent(queueId)}/${encodeURIComponent(jobId)}/${action}`,
          {
            method: "POST",
            headers: idempotentHeaders(),
            body: JSON.stringify({ expectedStatus }),
            cache: "no-store",
          },
        ),
      );
      const expectedCommand = action === "retry" ? "RETRY" : "CANCEL";
      const expectedOutcome = action === "retry" ? "RETRY_QUEUED" : "CANCELLED";
      if (
        result.queueId !== queueId ||
        result.jobId !== jobId ||
        result.command !== expectedCommand ||
        result.outcome !== expectedOutcome
      )
        throw invalidResponse();
      return {
        queueId,
        jobId,
        command: expectedCommand,
        outcome: expectedOutcome,
        completedAt: requireTimestamp(result.completedAt),
      };
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformAiOperationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "ai-operations"],
    queryFn: async () => {
      const service = requireRecord(
        await platformApiClient<unknown>("/iam/platform/ai/operations", {
          cache: "no-store",
        }),
      );
      if (
        service.id !== "sag" ||
        service.name !== "SAG" ||
        !readinessStates.has(String(service.status)) ||
        !availabilityStates.has(String(service.availability)) ||
        !["ALIVE", "UNAVAILABLE"].includes(String(service.liveness)) ||
        !["READY", "UNAVAILABLE"].includes(String(service.readiness))
      )
        throw invalidResponse();
      return {
        id: "sag" as const,
        name: "SAG" as const,
        status: service.status as string,
        availability: service.availability as string,
        liveness: service.liveness as string,
        readiness: service.readiness as string,
        dependencies: safeDependencyMap(service.dependencies),
        lastCheckedAt: requireTimestamp(service.lastCheckedAt),
        diagnosticsSummary: requireText(service.diagnosticsSummary, 300),
      };
    },
    enabled,
    retry: false,
  });
}
export function usePlatformIntegrationsQuery(
  filters: PlatformIntegrationFilters,
  enabled: boolean,
) {
  const query = queryString({
    ...pageValues(filters),
    organizationId: filters.organizationId,
    projectId: filters.projectId,
    status: filters.status,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "integrations", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/integrations?${query}`, {
          cache: "no-store",
        }),
        (item) => {
          const integration = requireRecord(item);
          if (
            integration.provider !== "JIRA" ||
            !integrationStatuses.has(String(integration.status)) ||
            !optionalTimestamp(integration.lastSyncAt) ||
            !optionalTimestamp(integration.lastFailureAt) ||
            !(
              integration.lastFailureSummary === null ||
              isText(integration.lastFailureSummary, 200)
            )
          )
            throw invalidResponse();
          return {
            id: requireId(integration.id),
            provider: "JIRA" as const,
            organizationId: requireId(integration.organizationId),
            projectId: requireId(integration.projectId),
            status: integration.status as string,
            lastSyncAt: integration.lastSyncAt as string | null,
            lastFailureAt: integration.lastFailureAt as string | null,
            lastFailureSummary: integration.lastFailureSummary as string | null,
            createdAt: requireTimestamp(integration.createdAt),
            updatedAt: requireTimestamp(integration.updatedAt),
          };
        },
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformIncidentsQuery(
  filters: PlatformIncidentFilters,
  enabled: boolean,
) {
  const query = queryString({
    ...pageValues(filters),
    status: filters.status,
    severity: filters.severity,
    affectedServiceId: filters.affectedServiceId,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "incidents", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/incidents?${query}`, {
          cache: "no-store",
        }),
        parseIncident,
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformIncidentQuery(incidentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "incident", incidentId],
    queryFn: async () =>
      parseIncident(
        await platformApiClient<unknown>(
          `/iam/platform/incidents/${encodeURIComponent(incidentId)}`,
          { cache: "no-store" },
        ),
      ),
    enabled: enabled && idPattern.test(incidentId),
    retry: false,
  });
}
export function usePlatformIncidentHistoryQuery(
  incidentId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: [...platformKeys.all, "incident", incidentId, "history", page],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/incidents/${encodeURIComponent(incidentId)}/history?page=${page}&pageSize=25`,
          { cache: "no-store" },
        ),
        (item) => {
          const h = requireRecord(item);
          if (
            !incidentStatuses.has(String(h.toStatus)) ||
            !["CREATED", "ACKNOWLEDGED", "RESOLVED", "NOTE_ADDED"].includes(
              String(h.action),
            ) ||
            (h.fromStatus !== undefined &&
              !incidentStatuses.has(String(h.fromStatus)))
          )
            throw invalidResponse();
          return {
            id: requireId(h.id),
            incidentId: requireId(h.incidentId),
            action: h.action as string,
            ...(h.fromStatus === undefined
              ? {}
              : { fromStatus: h.fromStatus as string }),
            toStatus: h.toStatus as string,
            version: requireInteger(h.version, 1),
            actorUserId: requireId(h.actorUserId),
            occurredAt: requireTimestamp(h.occurredAt),
            ...(h.note === undefined
              ? {}
              : { note: requireText(h.note, 2000) }),
          };
        },
      ),
    enabled: enabled && idPattern.test(incidentId),
    retry: false,
  });
}
export function usePlatformCreateIncidentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        title: string;
        severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        affectedServiceId: string;
      }>,
    ) => {
      if (
        !input.title.trim() ||
        input.title.length > 160 ||
        !incidentSeverities.has(input.severity) ||
        !incidentServices.has(input.affectedServiceId)
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid incident details",
        );
      const created = parseIncident(
        await platformApiClient<unknown>("/iam/platform/incidents", {
          method: "POST",
          headers: idempotentHeaders(),
          body: JSON.stringify({
            title: input.title.trim(),
            severity: input.severity,
            affectedServiceId: input.affectedServiceId,
          }),
          cache: "no-store",
        }),
      );
      return created;
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformIncidentActionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Readonly<{
        incidentId: string;
        action: "acknowledge" | "resolve" | "notes";
        expectedVersion: number;
        note: string;
      }>,
    ) => {
      if (
        !idPattern.test(input.incidentId) ||
        !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion < 1 ||
        !input.note.trim() ||
        input.note.length > 2000
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid incident operation",
        );
      const { incidentId, action, expectedVersion, note } = input;
      const updated = parseIncident(
        await platformApiClient<unknown>(
          `/iam/platform/incidents/${encodeURIComponent(incidentId)}/${action}`,
          {
            method: "POST",
            headers: idempotentHeaders(),
            body: JSON.stringify({ expectedVersion, note: note.trim() }),
            cache: "no-store",
          },
        ),
      );
      if (updated.id !== incidentId) throw invalidResponse();
      return updated;
    },
    onSuccess: () => invalidateOperations(client),
    onError: (error) => invalidateOnConflict(client, error),
  });
}
export function usePlatformRequestTraceQuery(
  requestId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...platformKeys.all, "trace", requestId],
    queryFn: async () => {
      const row = requireRecord(
        await platformApiClient<unknown>(
          `/iam/platform/diagnostics/traces/${encodeURIComponent(requestId)}`,
          { cache: "no-store" },
        ),
      );
      if (
        row.requestId !== requestId ||
        typeof row.truncated !== "boolean" ||
        !Array.isArray(row.events) ||
        row.events.length > 50
      )
        throw invalidResponse();
      return {
        requestId,
        truncated: row.truncated,
        events: row.events.map(parseAuditEvent),
      } satisfies PlatformTrace;
    },
    enabled: enabled && safeRequestIdPattern.test(requestId),
    retry: false,
  });
}
export function usePlatformAuditEventsQuery(
  filters: PlatformAuditFilters,
  enabled: boolean,
) {
  const query = queryString({
    ...pageValues(filters),
    actorUserId: filters.actorUserId,
    action: filters.action,
    resourceType: filters.resourceType,
    resourceId: filters.resourceId,
    organizationId: filters.organizationId,
    from: filters.from,
    to: filters.to,
  });
  return useQuery({
    queryKey: [...platformKeys.all, "audit-events", query],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(`/iam/platform/audit/events?${query}`, {
          cache: "no-store",
        }),
        parseAuditEvent,
      ),
    enabled,
    retry: false,
  });
}
export function usePlatformAuditEventQuery(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...platformKeys.all, "audit-event", eventId],
    queryFn: async () =>
      parseAuditEvent(
        await platformApiClient<unknown>(
          `/iam/platform/audit/events/${encodeURIComponent(eventId)}`,
          { cache: "no-store" },
        ),
      ),
    enabled: enabled && eventId.length > 0 && eventId.length <= 128,
    retry: false,
  });
}
export function usePlatformAuditResourceHistoryQuery(
  resourceType: string,
  resourceId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: [
      ...platformKeys.all,
      "audit-history",
      resourceType,
      resourceId,
      page,
    ],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/audit/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/history?page=${page}&pageSize=25`,
          { cache: "no-store" },
        ),
        parseAuditEvent,
      ),
    enabled:
      enabled &&
      auditResources.has(resourceType) &&
      resourceId.length > 0 &&
      resourceId.length <= 240,
    retry: false,
  });
}
