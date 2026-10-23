import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET, PATCH } from "./[...path]/route";

const projectId = "651a2b3c4d5e6f7a8b9c0d21";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function source(method: string, suffix: string, body?: unknown): NextRequest {
  const url = new URL(
    `http://localhost:3000/api/backend/iam/platform/projects${suffix}`,
  );
  return Object.assign(
    new Request(url, {
      method,
      headers: {
        cookie: "continuum_access=fixture; __Host-csrf=fixture-csrf",
        "x-csrf-token": "fixture-csrf",
        "x-request-id": "project-test-1",
        "content-type": "application/json",
        "x-role": "PLATFORM_OPERATOR",
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { nextUrl: url },
  ) as NextRequest;
}
describe("Platform Project BFF forwarding", () => {
  it("forwards member filters and cookies without client role claims", async () => {
    vi.stubEnv("CONTINUUM_API_BASE_URL", "http://127.0.0.1:3002");
    const backend = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { data: [] },
          { headers: { "cache-control": "no-store" } },
        ),
      );
    const response = await GET(
      source(
        "GET",
        `/${projectId}/memberships?page=2&pageSize=10&status=ACTIVE&search=member`,
      ),
      {
        params: Promise.resolve({
          path: ["iam", "platform", "projects", projectId, "memberships"],
        }),
      },
    );
    const [url, options] = backend.mock.calls[0];
    expect(String(url)).toBe(
      `http://127.0.0.1:3002/api/v1/iam/platform/projects/${projectId}/memberships?page=2&pageSize=10&status=ACTIVE&search=member`,
    );
    const headers = new Headers(options?.headers);
    expect(headers.get("cookie")).toContain("continuum_access=fixture");
    expect(headers.has("x-role")).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([200, 403, 409, 422, 500])(
    "preserves metadata mutation body, CSRF and backend result %s",
    async (status) => {
      const body = {
        name: "Reviewed",
        code: "REVIEW",
        visibility: "PRIVATE",
        expectedUpdatedAt: "2026-10-02T00:00:00.000Z",
        reasonCode: "ACCESS_REVIEW",
      };
      const backend = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          Response.json(
            { status },
            { status, headers: { "cache-control": "no-store" } },
          ),
        );
      const response = await PATCH(source("PATCH", `/${projectId}`, body), {
        params: Promise.resolve({
          path: ["iam", "platform", "projects", projectId],
        }),
      });
      const options = backend.mock.calls[0][1];
      expect(options?.method).toBe("PATCH");
      expect(
        JSON.parse(new TextDecoder().decode(options?.body as ArrayBuffer)),
      ).toEqual(body);
      expect(new Headers(options?.headers).get("x-csrf-token")).toBe(
        "fixture-csrf",
      );
      expect(new Headers(options?.headers).get("x-request-id")).toBe(
        "project-test-1",
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ status });
    },
  );
});
