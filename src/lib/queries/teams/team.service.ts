import { apiClient } from "@/lib/api-client";
import {
  TeamRecoveryRequiredError,
  integer,
  parseTeam,
  record,
  teamCode,
  teamDescription,
  teamName,
  teamReason,
  type TeamCommand,
  type TeamCreate,
  type TeamFilter,
  type TeamList,
  type TeamResource,
  type TeamScope,
  type TeamUpdate,
} from "./team.contract";

const teamPath = (id: string) => `/iam/teams/${encodeURIComponent(id)}`;
const projectPath = (id: string) =>
  `/iam/projects/${encodeURIComponent(id)}/teams`;

export async function listTeams(
  scope: TeamScope,
  page: number,
  status: TeamFilter,
  signal?: AbortSignal,
): Promise<TeamList> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    status,
  });
  const raw = record(
    await apiClient<unknown>(`${projectPath(scope.projectId)}?${query}`, {
      cache: "no-store",
      signal,
    }),
  );
  if (!Array.isArray(raw.data) || raw.data.length > 20)
    throw new Error("INVALID_TEAM_RESPONSE");
  const pagination = record(raw.pagination);
  if (pagination.page !== page || pagination.pageSize !== 20)
    throw new Error("INVALID_TEAM_RESPONSE");
  const data = raw.data.map((item) => parseTeam(item, scope));
  if (status !== "ALL" && data.some((team) => team.status !== status))
    throw new Error("INVALID_TEAM_RESPONSE");
  return {
    data,
    pagination: {
      page: integer(pagination.page, 1),
      pageSize: integer(pagination.pageSize, 1, 100),
      totalItems: integer(pagination.totalItems, 0),
      totalPages: integer(pagination.totalPages, 0),
    },
  };
}
function validEtag(team: TeamResource["team"], etag: string | null): string {
  if (
    !etag ||
    !/^"team:[^":]+:[1-9][0-9]*"$/.test(etag) ||
    etag !== `"team:${team.id}:${team.version}"`
  )
    throw new Error("INVALID_TEAM_ETAG");
  return etag;
}
export async function getTeam(
  scope: TeamScope,
  id: string,
  signal?: AbortSignal,
): Promise<TeamResource> {
  let etag: string | null = null;
  const raw = await apiClient<unknown>(teamPath(id), {
    signal,
    cache: "no-store",
    onResponseHeaders: (headers) => {
      etag = headers.get("etag");
    },
  });
  const team = parseTeam(raw, scope, id);
  return { team, etag: validEtag(team, etag) };
}
export function prepareTeamCommand(
  operation: "create" | "update" | "archive" | "restore",
  scope: TeamScope,
  input: TeamCreate | TeamUpdate | { reason: string },
  resource?: TeamResource,
): TeamCommand {
  if (operation !== "create" && !resource)
    throw new Error("TEAM_PRECONDITION_REQUIRED");
  let body: TeamCommand["body"];
  if (operation === "create") {
    const v = input as TeamCreate;
    body = {
      name: teamName(v.name),
      code: teamCode(v.code),
      ...(v.description !== undefined
        ? { description: teamDescription(v.description) }
        : {}),
    };
  } else if (operation === "update") {
    const v = input as TeamUpdate;
    body = {
      ...(v.name !== undefined ? { name: teamName(v.name) } : {}),
      ...(v.description !== undefined
        ? { description: teamDescription(v.description) }
        : {}),
    };
    if (!Object.keys(body).length) throw new Error("TEAM_EMPTY_UPDATE");
  } else body = { reason: teamReason((input as { reason: string }).reason) };
  return {
    path:
      operation === "create"
        ? projectPath(scope.projectId)
        : `${teamPath(resource!.team.id)}${operation === "update" ? "" : `/${operation}`}`,
    method: operation === "update" ? "PATCH" : "POST",
    body,
    key: crypto.randomUUID(),
    createdAt: Date.now(),
    ...(resource ? { etag: validEtag(resource.team, resource.etag) } : {}),
  };
}
export async function executeTeamCommand(
  scope: TeamScope,
  command: TeamCommand,
): Promise<TeamResource> {
  if (Date.now() - command.createdAt >= 24 * 60 * 60 * 1000)
    throw new TeamRecoveryRequiredError("TEAM_RECOVERY_WINDOW_EXPIRED");
  const csrf =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("__Host-csrf="))
          ?.slice("__Host-csrf=".length);
  const headers = new Headers({ "Idempotency-Key": command.key });
  if (command.etag) headers.set("If-Match", command.etag);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  let etag: string | null = null;
  const raw = await apiClient<unknown>(command.path, {
    method: command.method,
    body: JSON.stringify(command.body),
    headers,
    cache: "no-store",
    onResponseHeaders: (h) => {
      etag = h.get("etag");
    },
  });
  const team = parseTeam(raw, scope);
  if (command.etag && command.etag.split(":")[1] !== team.id)
    throw new Error("INVALID_TEAM_RESPONSE");
  return { team, etag: validEtag(team, etag) };
}
