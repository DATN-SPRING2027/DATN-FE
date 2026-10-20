/** R5 development baseline from the supplied Project Lead disposition.
 * R4 is an input, not retrospectively approved. Release evidence remains separate.
 */
export type TeamStatus = "ACTIVE" | "ARCHIVED";
export type TeamFilter = TeamStatus | "ALL";
export interface Team {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  code: string;
  description: string | null;
  status: TeamStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedBy: string | null;
}
export interface TeamList {
  data: Team[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
export interface TeamScope {
  organizationId: string;
  projectId: string;
}
export interface TeamCreate {
  name: string;
  code: string;
  description?: string | null;
}
export interface TeamUpdate {
  name?: string;
  description?: string | null;
}
export interface TeamResource {
  team: Team;
  etag: string;
}
export interface TeamCommand {
  path: string;
  method: "POST" | "PATCH";
  body: TeamCreate | TeamUpdate | { reason: string };
  key: string;
  etag?: string;
  createdAt: number;
}
export class TeamRecoveryRequiredError extends Error {}

export class TeamValidationError extends Error {
  constructor(
    public readonly field: "name" | "code" | "description" | "reason",
  ) {
    super("VALIDATION_FAILED");
  }
}
function controls(value: string, layout = false) {
  return [...value].some((char) => {
    const n = char.codePointAt(0)!;
    return n === 127 || (n < 32 && !(layout && [9, 10].includes(n)));
  });
}
export function teamName(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (
    ![...normalized].length ||
    [...normalized].length > 200 ||
    controls(normalized)
  )
    throw new TeamValidationError("name");
  return normalized;
}
export function teamCode(value: string): string {
  const normalized = value.trim().replace(/[a-z]/g, (c) => c.toUpperCase());
  if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(normalized))
    throw new TeamValidationError("code");
  return normalized;
}
export function teamDescription(value: string | null): string | null {
  if (value !== null && ([...value].length > 2000 || controls(value, true)))
    throw new TeamValidationError("description");
  return value;
}
export function teamReason(value: string): string {
  const normalized = value.trim();
  if (
    ![...normalized].length ||
    [...normalized].length > 500 ||
    controls(normalized)
  )
    throw new TeamValidationError("reason");
  return normalized;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_TEAM_RESPONSE");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("INVALID_TEAM_RESPONSE");
  return value;
}
function date(value: unknown): string {
  const result = string(value);
  if (!result.endsWith("Z") || !Number.isFinite(Date.parse(result)))
    throw new Error("INVALID_TEAM_RESPONSE");
  return result;
}
export function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new Error("INVALID_TEAM_RESPONSE");
  return value;
}
export function parseTeam(
  value: unknown,
  scope: TeamScope,
  expectedId?: string,
): Team {
  const v = record(value);
  if (
    v.organizationId !== scope.organizationId ||
    v.projectId !== scope.projectId ||
    (expectedId && v.id !== expectedId) ||
    !["ACTIVE", "ARCHIVED"].includes(String(v.status))
  )
    throw new Error("INVALID_TEAM_RESPONSE");
  if (v.description !== null && typeof v.description !== "string")
    throw new Error("INVALID_TEAM_RESPONSE");
  // Project only public metadata: internal archive reason/member data never enters UI state.
  return {
    id: string(v.id),
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: string(v.name),
    code: string(v.code),
    description: v.description as string | null,
    status: v.status as TeamStatus,
    version: integer(v.version, 1),
    createdAt: date(v.createdAt),
    updatedAt: date(v.updatedAt),
    archivedAt: v.archivedAt === null ? null : date(v.archivedAt),
    archivedBy: v.archivedBy === null ? null : string(v.archivedBy),
  };
}
