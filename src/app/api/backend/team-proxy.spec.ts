import { afterEach, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET, POST, PATCH, DELETE } from "./[...path]/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("sanitizes a Team upstream failure into the shared envelope", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("private backend connection string"),
  );
  const result = await GET(request("GET", "iam/teams/t"), {
    params: Promise.resolve({ path: ["iam", "teams", "t"] }),
  });
  expect(result.status).toBe(503);
  const body = await result.json();
  expect(body).toMatchObject({
    code: "RETRY_LATER",
    details: {},
    requestId: expect.any(String),
  });
  expect(JSON.stringify(body)).not.toContain("private");
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it("forces no-store even if the Team upstream omits it", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
  const result = await GET(request("GET", "iam/teams/t"), {
    params: Promise.resolve({ path: ["iam", "teams", "t"] }),
  });
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it.each([
  ["IAM", "TEAMS", "t"],
  ["x", "..", "iam", "teams", "t"],
  ["iam/teams", "t"],
])("blocks noncanonical Team path bypasses: %j", async (...segments) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  const fetch = vi.spyOn(globalThis, "fetch");
  const path = segments as string[];
  expect(
    (
      await GET(request("GET", "iam/teams/t"), {
        params: Promise.resolve({ path }),
      })
    ).status,
  ).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
function request(method: string, path: string) {
  const url = new URL(`http://localhost:3000/api/backend/${path}`);
  return Object.assign(
    new Request(url, {
      method,
      headers: {
        cookie: "session=trusted; __Host-csrf=csrf",
        authorization: "Bearer supplied",
        "x-organization-id": "forged",
        "x-user-id": "forged",
        "x-roles": "ADMIN",
        "x-csrf-token": "csrf",
        "idempotency-key": "original-key",
        "if-match": '"team:team1:1"',
      },
      ...(["POST", "PATCH"].includes(method)
        ? { body: JSON.stringify({ reason: "reviewed" }) }
        : {}),
    }),
    { nextUrl: url },
  ) as NextRequest;
}
it.each(["production", "development", "test"])(
  "keeps Team forwarding closed without explicit opt-in in %s",
  async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(
      (
        await GET(request("GET", "iam/projects/p/teams"), {
          params: Promise.resolve({ path: ["iam", "projects", "p", "teams"] }),
        })
      ).status,
    ).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("cannot enable production forwarding with the development flag", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  const fetch = vi.spyOn(globalThis, "fetch");
  expect(
    (
      await POST(request("POST", "iam/teams/t/archive"), {
        params: Promise.resolve({ path: ["iam", "teams", "t", "archive"] }),
      })
    ).status,
  ).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  ["GET", "iam/projects/p/teams"],
  ["POST", "iam/projects/p/teams"],
  ["GET", "iam/teams/t"],
  ["PATCH", "iam/teams/t"],
  ["POST", "iam/teams/t/archive"],
  ["POST", "iam/teams/t/restore"],
])(
  "forwards development %s %s with safe context and response headers",
  async (method, path) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        headers: {
          etag: '"team:team1:1"',
          "idempotency-replayed": "true",
          "cache-control": "no-store",
        },
      }),
    );
    const proxy = method === "GET" ? GET : method === "PATCH" ? PATCH : POST;
    const result = await proxy(request(method, path), {
      params: Promise.resolve({ path: path.split("/") }),
    });
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get("cookie")).toContain("session=trusted");
    expect(headers.get("if-match")).toBe('"team:team1:1"');
    expect(headers.get("idempotency-key")).toBe("original-key");
    expect(headers.get("x-csrf-token")).toBe("csrf");
    for (const name of ["x-organization-id", "x-user-id", "x-roles"])
      expect(headers.has(name)).toBe(false);
    expect(result.headers.get("etag")).toBe('"team:team1:1"');
    expect(result.headers.get("idempotency-replayed")).toBe("true");
    expect(result.headers.get("cache-control")).toBe("no-store");
  },
);
it.each(["iam/teams/t", "iam/teams/t/members", "iam/projects/p/teams/x"])(
  "does not add DELETE or membership/move routes: %s",
  async (path) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(
      (
        await DELETE(request("DELETE", path), {
          params: Promise.resolve({ path: path.split("/") }),
        })
      ).status,
    ).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  },
);
