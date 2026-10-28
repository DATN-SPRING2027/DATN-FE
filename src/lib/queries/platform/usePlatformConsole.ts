"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import { platformSessionQueryKey } from "./platform-session.key";

export function platformApiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(15_000);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  return apiClient<T>(endpoint, { ...options, signal });
}

export const platformPermissions = [
  "organization.create",
  "platform.ai.operations.read",
  "platform.audit.read",
  "platform.dashboard.summary.read",
  "platform.diagnostics.trace.read",
  "platform.health.read",
  "platform.incidents.incident.manage",
  "platform.incidents.incident.read",
  "platform.integrations.integration.manage",
  "platform.integrations.integration.read",
  "platform.jobs.job.manage",
  "platform.jobs.job.read",
  "platform.memberships.invitation.manage",
  "platform.memberships.lifecycle.manage",
  "platform.memberships.membership.read",
  "platform.memberships.role.manage",
  "platform.organizations.organization.manage",
  "platform.organizations.organization.read",
  "platform.projects.project.manage",
  "platform.projects.project.read",
  "platform.services.service.read",
  "platform.sessions.session.manage",
  "platform.sessions.session.read",
  "platform.users.account.manage",
  "platform.users.account.read",
] as const;

export type PlatformPermission = (typeof platformPermissions)[number];
export type PlatformSession = Readonly<{
  id: string;
  email: string;
  name: string;
  context: "PLATFORM";
  permissions: readonly PlatformPermission[];
}>;
export type PlatformOrganization = Readonly<{
  id: string;
  name: string;
  slug: string;
  plan: "FREE" | "ENTERPRISE";
  createdAt: string;
  updatedAt: string;
}>;
export type PlatformPage<T> = Readonly<{
  data: readonly T[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>;
}>;
export type PlatformUser = Readonly<{
  id: string;
  email: string;
  fullName: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
}>;
export type PlatformMembership = Readonly<{
  id: string;
  organizationId: string;
  userId: string;
  status: "PENDING_INVITE" | "ACTIVE" | "SUSPENDED" | "REMOVED";
  version: number;
  hasPersistedVersion?: boolean;
  createdAt: string;
  updatedAt: string;
  user: Readonly<{
    id: string;
    email: string;
    fullName: string;
    accountStatus: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
  }> | null;
  organizationRoles: readonly ("ADMIN" | "MEMBER")[];
}>;
export type PlatformDirectoryMembership = PlatformMembership &
  Readonly<{
    organization: Readonly<{ id: string; name: string; slug: string }> | null;
  }>;
export type PlatformMembershipFilters = Readonly<{
  page: number;
  search: string;
  status: PlatformMembership["status"] | "";
  organizationId: string;
}>;

export type PlatformMembershipSuspensionAcknowledgement = Readonly<{
  operationId: string;
  membership: Readonly<{
    id: string;
    organizationId: string;
    userId: string;
    status: "SUSPENDED";
    version: number;
  }>;
}>;
export type PlatformAuditRecord = Readonly<{
  action: string;
  targetResource:
    "ORGANIZATION" | "PLATFORM_AUTHORITY" | "ORGANIZATION_MEMBERSHIP";
  targetResourceId: string;
  actorUserId: string;
  occurredAt: string;
}>;

const resourceIdPattern = /^[a-f\d]{24}$/i;
const dateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const permissionSet = new Set<string>(platformPermissions);
const membershipStatuses = new Set([
  "PENDING_INVITE",
  "ACTIVE",
  "SUSPENDED",
  "REMOVED",
]);

function invalidResponse(): ApiError {
  return new ApiError(
    502,
    "INVALID_PLATFORM_RESPONSE",
    "The Platform API returned an invalid response",
  );
}

export function parsePlatformMembershipSuspensionAcknowledgement(
  value: unknown,
  organizationId: string,
  membershipId: string,
  expectedVersion: number,
): PlatformMembershipSuspensionAcknowledgement {
  if (
    !record(value) ||
    typeof value.operationId !== "string" ||
    !resourceIdPattern.test(value.operationId) ||
    !record(value.membership) ||
    value.membership.id !== membershipId ||
    value.membership.organizationId !== organizationId ||
    typeof value.membership.userId !== "string" ||
    !resourceIdPattern.test(value.membership.userId) ||
    value.membership.status !== "SUSPENDED" ||
    typeof value.membership.version !== "number" ||
    !Number.isSafeInteger(value.membership.version) ||
    value.membership.version !== expectedVersion + 1
  )
    throw invalidResponse();

  return {
    operationId: value.operationId,
    membership: {
      id: value.membership.id,
      organizationId: value.membership.organizationId,
      userId: value.membership.userId,
      status: "SUSPENDED",
      version: value.membership.version,
    },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    dateTimePattern.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseOrganization(value: unknown): PlatformOrganization {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !resourceIdPattern.test(value.id) ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string" ||
    (value.plan !== "FREE" && value.plan !== "ENTERPRISE") ||
    !dateTime(value.createdAt) ||
    !dateTime(value.updatedAt)
  )
    throw invalidResponse();
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    plan: value.plan,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): PlatformPage<T> {
  if (!record(value) || !Array.isArray(value.data) || !record(value.pagination))
    throw invalidResponse();
  const { page, pageSize, totalItems, totalPages } = value.pagination;
  if (
    !Number.isSafeInteger(page) ||
    Number(page) < 1 ||
    !Number.isSafeInteger(pageSize) ||
    Number(pageSize) < 1 ||
    Number(pageSize) > 100 ||
    !Number.isSafeInteger(totalItems) ||
    Number(totalItems) < 0 ||
    !Number.isSafeInteger(totalPages) ||
    Number(totalPages) < 0 ||
    value.data.length > 100
  )
    throw invalidResponse();
  return {
    data: value.data.map(parseItem),
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      totalItems: Number(totalItems),
      totalPages: Number(totalPages),
    },
  };
}

function parsePlatformUser(value: unknown): PlatformUser {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !resourceIdPattern.test(value.id) ||
    typeof value.email !== "string" ||
    value.email.length > 254 ||
    typeof value.fullName !== "string" ||
    !["ACTIVE", "SUSPENDED", "PENDING_INVITE"].includes(String(value.status))
  )
    throw invalidResponse();
  return {
    id: value.id,
    email: value.email,
    fullName: value.fullName,
    status: value.status as PlatformUser["status"],
  };
}

function parseMembership(
  value: unknown,
  organizationId: string,
): PlatformMembership {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !resourceIdPattern.test(value.id) ||
    value.organizationId !== organizationId ||
    typeof value.userId !== "string" ||
    !resourceIdPattern.test(value.userId) ||
    typeof value.status !== "string" ||
    !membershipStatuses.has(value.status) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    (value.hasPersistedVersion !== undefined &&
      typeof value.hasPersistedVersion !== "boolean") ||
    !dateTime(value.createdAt) ||
    !dateTime(value.updatedAt) ||
    !Array.isArray(value.organizationRoles)
  )
    throw invalidResponse();
  let user: PlatformMembership["user"] = null;
  if (value.user !== null) {
    if (
      !record(value.user) ||
      typeof value.user.id !== "string" ||
      !resourceIdPattern.test(value.user.id) ||
      typeof value.user.email !== "string" ||
      typeof value.user.fullName !== "string" ||
      typeof value.user.accountStatus !== "string" ||
      !["ACTIVE", "SUSPENDED", "PENDING_INVITE"].includes(
        value.user.accountStatus,
      )
    )
      throw invalidResponse();
    user = {
      id: value.user.id,
      email: value.user.email,
      fullName: value.user.fullName,
      accountStatus: value.user.accountStatus as NonNullable<
        PlatformMembership["user"]
      >["accountStatus"],
    };
  }
  if (
    value.organizationRoles.some(
      (role) => role !== "ADMIN" && role !== "MEMBER",
    )
  )
    throw invalidResponse();
  return {
    id: value.id,
    organizationId,
    userId: value.userId,
    status: value.status as PlatformMembership["status"],
    version: Number(value.version),
    hasPersistedVersion: value.hasPersistedVersion !== false,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    user,
    organizationRoles: [
      ...new Set(value.organizationRoles),
    ] as PlatformMembership["organizationRoles"],
  };
}

export function csrfHeaders(idempotencyKey?: string): Headers {
  if (typeof document === "undefined")
    throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF context is unavailable");
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("__Host-csrf="));
  const token = cookie?.slice("__Host-csrf=".length);
  if (!token)
    throw new ApiError(403, "AUTH_CSRF_INVALID", "CSRF token is unavailable");
  const headers = new Headers({ "X-CSRF-Token": token });
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return headers;
}

export const platformKeys = {
  all: ["platform-console"] as const,
  session: () => platformSessionQueryKey,
  organizations: () => [...platformKeys.all, "organizations"] as const,
  organizationsPage: (page: number) =>
    [...platformKeys.organizations(), page] as const,
  organization: (id: string) =>
    [...platformKeys.all, "organization", id] as const,
  memberships: (id: string) =>
    [...platformKeys.all, "organization", id, "memberships"] as const,
  membershipsPage: (id: string, page: number) =>
    [...platformKeys.memberships(id), page] as const,
  membershipDirectory: () => [...platformKeys.all, "memberships"] as const,
  health: () => [...platformKeys.all, "health"] as const,
  audit: () => [...platformKeys.all, "audit"] as const,
};

export async function loadPlatformSession() {
  const value: unknown = await platformApiClient("/auth/platform/me", {
    cache: "no-store",
  });
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !resourceIdPattern.test(value.id) ||
    typeof value.email !== "string" ||
    typeof value.name !== "string" ||
    value.context !== "PLATFORM" ||
    !Array.isArray(value.permissions) ||
    value.permissions.some(
      (permission) =>
        typeof permission !== "string" || !permissionSet.has(permission),
    )
  )
    throw invalidResponse();
  return {
    id: value.id,
    email: value.email,
    name: value.name,
    context: "PLATFORM" as const,
    permissions: [...new Set(value.permissions)] as PlatformPermission[],
  } satisfies PlatformSession;
}

export function usePlatformSessionQuery() {
  return useQuery({
    queryKey: platformKeys.session(),
    queryFn: loadPlatformSession,
    retry: false,
    staleTime: 20_000,
  });
}

export function usePlatformOrganizationsQuery(
  enabled: boolean,
  page = 1,
  pageSize = 100,
) {
  return useQuery({
    queryKey:
      pageSize === 100
        ? platformKeys.organizationsPage(page)
        : [...platformKeys.organizationsPage(page), pageSize],
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/organizations?page=${page}&pageSize=${pageSize}`,
          { cache: "no-store" },
        ),
        parseOrganization,
      ),
    enabled,
    retry: false,
    staleTime: 15_000,
  });
}

export function usePlatformOrganizationQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: platformKeys.organization(id),
    queryFn: async () =>
      parseOrganization(
        await platformApiClient<unknown>(
          `/iam/platform/organizations/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        ),
      ),
    enabled: enabled && resourceIdPattern.test(id),
    retry: false,
  });
}

export function usePlatformUserLookupMutation() {
  return useMutation({
    mutationKey: [...platformKeys.all, "user-lookup"],
    mutationFn: async (email: string) =>
      parsePlatformUser(
        await platformApiClient<unknown>("/iam/platform/users/lookup", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({ email }),
          cache: "no-store",
        }),
      ),
  });
}

export function usePlatformMembershipsQuery(
  organizationId: string,
  enabled: boolean,
  page = 1,
) {
  return useQuery({
    queryKey: platformKeys.membershipsPage(organizationId, page),
    queryFn: async () =>
      parsePage(
        await platformApiClient<unknown>(
          `/iam/platform/organizations/${encodeURIComponent(organizationId)}/memberships?page=${page}&pageSize=100`,
          { cache: "no-store" },
        ),
        (item) => parseMembership(item, organizationId),
      ),
    enabled: enabled && resourceIdPattern.test(organizationId),
    retry: false,
    staleTime: 10_000,
  });
}

export function usePlatformMembershipDirectoryQuery(
  filters: PlatformMembershipFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...platformKeys.membershipDirectory(), 10, filters],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        page: String(filters.page),
        pageSize: "10",
      });
      if (filters.search) query.set("search", filters.search);
      if (filters.status) query.set("status", filters.status);
      if (filters.organizationId)
        query.set("organizationId", filters.organizationId);
      return parsePage<PlatformDirectoryMembership>(
        await platformApiClient<unknown>(`/iam/platform/memberships?${query}`, {
          cache: "no-store",
          signal,
        }),
        (value) => {
          if (
            !record(value) ||
            typeof value.organizationId !== "string" ||
            !resourceIdPattern.test(value.organizationId) ||
            (filters.organizationId &&
              value.organizationId !== filters.organizationId)
          )
            throw invalidResponse();
          const membership = parseMembership(value, value.organizationId);
          let organization: PlatformDirectoryMembership["organization"] = null;
          if (value.organization !== undefined && value.organization !== null) {
            const row = value.organization;
            if (
              !record(row) ||
              row.id !== membership.organizationId ||
              typeof row.name !== "string" ||
              typeof row.slug !== "string"
            )
              throw invalidResponse();
            organization = {
              id: membership.organizationId,
              name: row.name,
              slug: row.slug,
            };
          }
          return { ...membership, organization };
        },
      );
    },
    enabled,
    retry: false,
    staleTime: 10_000,
  });
}

export function useSuspendPlatformMembershipMutation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...platformKeys.all, "membership-suspend"],
    mutationFn: async (
      input: Readonly<{
        membershipId: string;
        expectedMembershipVersion: number;
        reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
      }>,
    ) => {
      if (
        !resourceIdPattern.test(organizationId) ||
        !resourceIdPattern.test(input.membershipId) ||
        !Number.isSafeInteger(input.expectedMembershipVersion) ||
        input.expectedMembershipVersion < 1
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid membership operation",
        );
      const idempotencyKey = globalThis.crypto.randomUUID();
      const value = await platformApiClient<unknown>(
        `/iam/platform/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(input.membershipId)}/suspend`,
        {
          method: "POST",
          headers: csrfHeaders(idempotencyKey),
          body: JSON.stringify({
            expectedMembershipVersion: input.expectedMembershipVersion,
            reasonCode: input.reasonCode,
          }),
          cache: "no-store",
        },
      );
      return parsePlatformMembershipSuspensionAcknowledgement(
        value,
        organizationId,
        input.membershipId,
        input.expectedMembershipVersion,
      );
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: platformKeys.memberships(organizationId),
        }),
        client.invalidateQueries({
          queryKey: platformKeys.membershipDirectory(),
        }),
      ]),
  });
}

export function useCreatePlatformOrganizationMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...platformKeys.all, "organization-create"],
    mutationFn: async (
      input: Readonly<{
        name: string;
        slug: string;
        plan: "FREE" | "ENTERPRISE";
        firstAdminUserId: string;
      }>,
    ) => {
      if (
        !input.name.trim() ||
        input.name.length > 200 ||
        !/^[a-f\d]{24}$/i.test(input.firstAdminUserId) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
        input.slug.length > 100
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid Organization input",
        );
      return parseOrganization(
        await platformApiClient<unknown>("/iam/platform/organizations", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify(input),
          cache: "no-store",
        }),
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.all }),
  });
}

export function usePlatformHealthQuery(enabled: boolean) {
  return useQuery({
    queryKey: platformKeys.health(),
    queryFn: async () => {
      const value: unknown = await platformApiClient("/iam/platform/health", {
        cache: "no-store",
      });
      if (!record(value) || value.status !== "ok") throw invalidResponse();
      return { status: "ok" as const };
    },
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function usePlatformAuditQuery(enabled: boolean) {
  return useQuery({
    queryKey: platformKeys.audit(),
    queryFn: async () => {
      const value: unknown = await platformApiClient<unknown>(
        "/iam/platform/audit",
        {
          cache: "no-store",
        },
      );
      if (!Array.isArray(value) || value.length > 100) throw invalidResponse();
      return value.flatMap((item): PlatformAuditRecord[] => {
        if (
          !record(item) ||
          typeof item.action !== "string" ||
          ![
            "ORGANIZATION",
            "PLATFORM_AUTHORITY",
            "ORGANIZATION_MEMBERSHIP",
          ].includes(String(item.targetResource)) ||
          typeof item.targetResourceId !== "string" ||
          typeof item.actorUserId !== "string" ||
          !dateTime(item.occurredAt)
        )
          return [];
        return [
          {
            action: item.action,
            targetResource:
              item.targetResource as PlatformAuditRecord["targetResource"],
            targetResourceId: item.targetResourceId,
            actorUserId: item.actorUserId,
            occurredAt: item.occurredAt,
          },
        ];
      });
    },
    enabled,
    retry: false,
    staleTime: 10_000,
  });
}

export function usePlatformLogoutMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["logout", "platform"],
    mutationFn: () =>
      platformApiClient<void>("/api/v1/auth/logout", {
        method: "POST",
        cache: "no-store",
      }),
    onSuccess: () => client.clear(),
  });
}
