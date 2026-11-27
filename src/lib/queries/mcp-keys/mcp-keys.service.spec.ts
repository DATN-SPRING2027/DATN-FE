import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  createMcpApiKey,
  listMcpApiKeys,
  revokeMcpApiKey,
} from "./mcp-keys.service";
import {
  MCP_IDE_CLIENT_SPECS,
  resolvePublicMcpEndpoints,
} from "@/lib/mcp-client-configs";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
}));

const api = vi.mocked(apiClient);

describe("MCP API keys service & IDE client config generator", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("calls GET, POST, and URL-encoded DELETE on /iam/mcp-api-keys", async () => {
    api.mockResolvedValue({} as never);

    await listMcpApiKeys();
    expect(api).toHaveBeenCalledWith("/iam/mcp-api-keys", {
      method: "GET",
      signal: undefined,
      cache: "no-store",
    });

    await createMcpApiKey({
      name: "Antigravity Laptop",
      scope: "FULL_OPERATIONS",
      allowedProjectIds: null,
      expiresInDays: 90,
    });
    expect(api).toHaveBeenCalledWith("/iam/mcp-api-keys", {
      method: "POST",
      body: JSON.stringify({
        name: "Antigravity Laptop",
        scope: "FULL_OPERATIONS",
        allowedProjectIds: null,
        expiresInDays: 90,
      }),
    });

    await revokeMcpApiKey("key/with space");
    expect(api).toHaveBeenCalledWith(
      "/iam/mcp-api-keys/key%2Fwith%20space",
      { method: "DELETE" },
    );
  });

  it("generates valid cross-platform Streamable HTTP snippets for all 7 supported MCP hosts", () => {
    expect(MCP_IDE_CLIENT_SPECS).toHaveLength(7);
    const { directEndpointUrl, bffEndpointUrl, recommendedMode } =
      resolvePublicMcpEndpoints("http://localhost:3000", "/api/v1/mcp");
    expect(directEndpointUrl).toBe("http://localhost:3001/api/v1/mcp");
    expect(bffEndpointUrl).toBe("http://localhost:3000/api/backend/mcp");
    expect(recommendedMode).toBe("direct");

    for (const spec of MCP_IDE_CLIENT_SPECS) {
      const snippet = spec.buildSnippet({
        endpointUrl: directEndpointUrl,
        bearerToken: "ctm_mcp_secret123",
      });
      expect(snippet).toContain(directEndpointUrl);
      expect(snippet).toContain("Bearer ctm_mcp_secret123");
      if (spec.language === "json") {
        expect(() => JSON.parse(snippet)).not.toThrow();
      } else {
        // Cross-platform CLI commands must be single-line without POSIX backslash continuations
        expect(snippet).not.toContain(" \\\n");
      }
    }

    // Claude Desktop must avoid spaces inside --header arg for Windows cmd.exe/npx compatibility
    const claudeDesktop = MCP_IDE_CLIENT_SPECS.find(
      (s) => s.id === "claude-desktop",
    )!;
    const parsedClaudeDesktop = JSON.parse(
      claudeDesktop.buildSnippet({
        endpointUrl: directEndpointUrl,
        bearerToken: "ctm_mcp_secret123",
      }),
    ) as {
      mcpServers: {
        continuum: {
          command: string;
          args: string[];
          env: Record<string, string>;
        };
      };
    };
    expect(parsedClaudeDesktop.mcpServers.continuum.args).toEqual([
      "-y",
      "mcp-remote",
      directEndpointUrl,
      "--header",
      "Authorization:${AUTH_HEADER}",
    ]);
    expect(parsedClaudeDesktop.mcpServers.continuum.env).toEqual({
      AUTH_HEADER: "Bearer ctm_mcp_secret123",
    });

    // curl snippet must use double-quoted escaped JSON for Windows curl.exe + macOS/Linux curl
    const curlSpec = MCP_IDE_CLIENT_SPECS.find((s) => s.id === "curl")!;
    const curlSnippet = curlSpec.buildSnippet({
      endpointUrl: bffEndpointUrl,
      bearerToken: "ctm_mcp_secret123",
    });
    expect(curlSnippet).toBe(
      `curl -sS -X POST "${bffEndpointUrl}" -H "Authorization: Bearer ctm_mcp_secret123" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"tools/call\\",\\"params\\":{\\"name\\":\\"continuum_get_context\\",\\"arguments\\":{}}}"`,
    );
  });

  it("resolves SSR, custom localhost ports, relative env URLs, and production origins safely", () => {
    const prevApiUrl = process.env.NEXT_PUBLIC_CONTINUUM_API_URL;
    try {
      // 1. Relative NEXT_PUBLIC_CONTINUUM_API_URL like '/api/backend' must be ignored
      process.env.NEXT_PUBLIC_CONTINUUM_API_URL = "/api/backend";

      // SSR empty origin -> defaults to https://app.continuum.ai and recommends bff
      expect(resolvePublicMcpEndpoints("", "/api/v1/mcp")).toEqual({
        directEndpointUrl: "https://app.continuum.ai/api/v1/mcp",
        bffEndpointUrl: "https://app.continuum.ai/api/backend/mcp",
        recommendedMode: "bff",
      });

      // Non-3000 localhost (e.g. next start -p 3099) -> direct points to :3001, recommends bff
      expect(
        resolvePublicMcpEndpoints("http://localhost:3099", "/api/v1/mcp"),
      ).toEqual({
        directEndpointUrl: "http://localhost:3001/api/v1/mcp",
        bffEndpointUrl: "http://localhost:3099/api/backend/mcp",
        recommendedMode: "bff",
      });

      // Production domain without explicit external publicApiBase -> recommends bff
      expect(
        resolvePublicMcpEndpoints("https://continuum.company.vn", "/api/v1/mcp"),
      ).toEqual({
        directEndpointUrl: "https://continuum.company.vn/api/v1/mcp",
        bffEndpointUrl: "https://continuum.company.vn/api/backend/mcp",
        recommendedMode: "bff",
      });

      // 2. Explicit https:// NEXT_PUBLIC_CONTINUUM_API_URL -> direct uses external host and recommends direct
      process.env.NEXT_PUBLIC_CONTINUUM_API_URL =
        "https://api.continuum.company.vn/api/v1/";
      expect(resolvePublicMcpEndpoints("", "/api/v1/mcp")).toEqual({
        directEndpointUrl: "https://api.continuum.company.vn/api/v1/mcp",
        bffEndpointUrl: "https://app.continuum.ai/api/backend/mcp",
        recommendedMode: "direct",
      });
    } finally {
      if (prevApiUrl === undefined) {
        delete process.env.NEXT_PUBLIC_CONTINUUM_API_URL;
      } else {
        process.env.NEXT_PUBLIC_CONTINUUM_API_URL = prevApiUrl;
      }
    }
  });

  it("strips trailing slashes cleanly and resists ReDoS backtracking in linear time (< 10ms)", () => {
    const prevApiUrl = process.env.NEXT_PUBLIC_CONTINUUM_API_URL;
    try {
      delete process.env.NEXT_PUBLIC_CONTINUUM_API_URL;

      expect(
        resolvePublicMcpEndpoints("https://app.continuum.ai///", "/api/v1/mcp"),
      ).toEqual({
        directEndpointUrl: "https://app.continuum.ai/api/v1/mcp",
        bffEndpointUrl: "https://app.continuum.ai/api/backend/mcp",
        recommendedMode: "bff",
      });

      expect(
        resolvePublicMcpEndpoints(
          "https://app.continuum.ai" + "/".repeat(20000),
          "/api/v1/mcp",
        ),
      ).toEqual({
        directEndpointUrl: "https://app.continuum.ai/api/v1/mcp",
        bffEndpointUrl: "https://app.continuum.ai/api/backend/mcp",
        recommendedMode: "bff",
      });

      const adversarialOrigin =
        "https://app.continuum.ai" + "/".repeat(20000) + "a";
      const start = performance.now();
      const result = resolvePublicMcpEndpoints(adversarialOrigin);
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(10);
      expect(result).toEqual({
        directEndpointUrl: `${adversarialOrigin}/api/v1/mcp`,
        bffEndpointUrl: `${adversarialOrigin}/api/backend/mcp`,
        recommendedMode: "bff",
      });
    } finally {
      if (prevApiUrl === undefined) {
        delete process.env.NEXT_PUBLIC_CONTINUUM_API_URL;
      } else {
        process.env.NEXT_PUBLIC_CONTINUUM_API_URL = prevApiUrl;
      }
    }
  });
});
