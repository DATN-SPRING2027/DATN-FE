import { afterEach, expect, it, vi } from "vitest";
import {
  executeTeamCommand,
  getTeam,
  listTeams,
  prepareTeamCommand,
} from "./team.service";
import {
  parseTeam,
  teamName,
  teamCode,
  teamDescription,
  teamReason,
  TeamRecoveryRequiredError,
} from "./team.contract";

const scope = { organizationId: "org1", projectId: "project1" };
const team = {
  id: "team1",
  ...scope,
  name: "Engineering",
  code: "ENG",
  description: null,
  status: "ACTIVE" as const,
  version: 1,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
  archivedAt: null,
  archivedBy: null,
};
const resource = { team, etag: '"team:team1:1"' };
function response(value: unknown = team, etag = resource.etag) {
  return new Response(JSON.stringify(value), {
    headers: { etag, "content-type": "application/json" },
  });
}
afterEach(() => vi.restoreAllMocks());

it("uses the scoped list route with status and pagination only", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response({
      data: [team],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }),
  );
  const result = await listTeams(scope, 1, "ACTIVE");
  expect(result.data[0].id).toBe("team1");
  expect(fetch).toHaveBeenCalledWith(
    "/api/backend/iam/projects/project1/teams?page=1&pageSize=20&status=ACTIVE",
    expect.objectContaining({ cache: "no-store", credentials: "include" }),
  );
});
it("retains the server ETag on detail and rejects weak or missing tags", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
  expect((await getTeam(scope, "team1")).etag).toBe(resource.etag);
  expect(fetch.mock.calls[0][0]).toBe("/api/backend/iam/teams/team1");
  fetch.mockResolvedValueOnce(response(team, 'W/"team:team1:1"'));
  await expect(getTeam(scope, "team1")).rejects.toThrow("INVALID_TEAM_ETAG");
});
it.each(["create", "update", "archive", "restore"] as const)(
  "sends %s with exact body, CSRF, idempotency and applicable precondition",
  async (operation) => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-csrf=csrf-proof",
    );
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
    const input =
      operation === "create"
        ? { name: " Engineering ", code: "eng" }
        : operation === "update"
          ? { name: "New name" }
          : { reason: " Reviewed " };
    const command = prepareTeamCommand(
      operation,
      scope,
      input,
      operation === "create" ? undefined : resource,
    );
    await executeTeamCommand(scope, command);
    const [url, options] = fetch.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(url).toBe(
      `/api/backend/iam/${operation === "create" ? "projects/project1/teams" : `teams/team1${operation === "update" ? "" : `/${operation}`}`}`,
    );
    expect(headers.get("Idempotency-Key")).toBe(command.key);
    expect(headers.get("X-CSRF-Token")).toBe("csrf-proof");
    expect(headers.get("If-Match")).toBe(
      operation === "create" ? null : resource.etag,
    );
    expect(options?.method).toBe(operation === "update" ? "PATCH" : "POST");
    expect(JSON.parse(String(options?.body))).toEqual(
      operation === "create"
        ? { name: "Engineering", code: "ENG" }
        : operation === "update"
          ? { name: "New name" }
          : { reason: "Reviewed" },
    );
    expect(options).not.toHaveProperty("onResponseHeaders");
  },
);
it("reuses the exact command after a lost response without automatic mutation replay", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new TypeError("Offline"))
    .mockResolvedValueOnce(response());
  const command = prepareTeamCommand("create", scope, {
    name: "Engineering",
    code: "ENG",
  });
  await expect(executeTeamCommand(scope, command)).rejects.toThrow("Offline");
  expect(fetch).toHaveBeenCalledTimes(1);
  await executeTeamCommand(scope, command);
  expect(
    new Headers(fetch.mock.calls[0][1]?.headers).get("idempotency-key"),
  ).toBe(new Headers(fetch.mock.calls[1][1]?.headers).get("idempotency-key"));
  expect(fetch.mock.calls[0][1]?.body).toBe(fetch.mock.calls[1][1]?.body);
});
it("does not retry an expired recovery slot", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const command = prepareTeamCommand("create", scope, {
    name: "Engineering",
    code: "ENG",
  });
  command.createdAt -= 24 * 60 * 60 * 1000;
  await expect(executeTeamCommand(scope, command)).rejects.toBeInstanceOf(
    TeamRecoveryRequiredError,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("projects public metadata and rejects another organization or project", () => {
  expect(
    parseTeam(
      { ...team, archivedReason: "private", members: ["secret"] },
      scope,
    ),
  ).not.toHaveProperty("archivedReason");
  expect(parseTeam({ ...team, members: ["secret"] }, scope)).not.toHaveProperty(
    "members",
  );
  expect(() => parseTeam({ ...team, projectId: "other" }, scope)).toThrow();
  expect(() =>
    parseTeam({ ...team, organizationId: "other" }, scope),
  ).toThrow();
});
it("normalizes before validating Unicode lengths and preserves description semantics", () => {
  expect(teamName("  e\u0301  ")).toBe("é");
  expect(teamCode(" eng ")).toBe("ENG");
  expect(teamName(" " + "😀".repeat(200) + " ")).toHaveLength(400);
  expect(teamDescription(null)).toBeNull();
  expect(teamDescription("")).toBe("");
  expect(teamDescription(" \n\t ")).toBe(" \n\t ");
  expect(() => teamName(" ")).toThrow();
  expect(() => teamName("x".repeat(201))).toThrow();
  expect(() => teamCode("a")).toThrow();
  expect(() => teamDescription("\r")).toThrow();
  expect(() => teamReason(" ")).toThrow();
});
it.each([401, 403, 404, 409, 412, 422, 428, 500, 503])(
  "preserves server error status %s without mutation retries",
  async (status) => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "TEAM_ACTION_FORBIDDEN",
          message: "Denied",
          details: {},
          requestId: "r1",
        }),
        { status },
      ),
    );
    const command = prepareTeamCommand(
      "update",
      scope,
      { name: "Updated" },
      resource,
    );
    await expect(executeTeamCommand(scope, command)).rejects.toMatchObject({
      status,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
