/**
 * MCP Client Configuration Snippet Generator
 * Shared between OrganizationIntegrationsManager (with live one-time rawKey injection)
 * and DeveloperDocsView (interactive public quickstart configurator).
 */

export type McpIdeClientId =
  | "antigravity"
  | "claude-code"
  | "cursor"
  | "claude-desktop"
  | "vscode"
  | "windsurf"
  | "curl";

export type McpEndpointMode = "direct" | "bff";

export interface McpIdeClientSpec {
  id: McpIdeClientId;
  label: string;
  shortLabel: string;
  targetFile: string;
  language: "json" | "bash";
  buildSnippet: (params: { endpointUrl: string; bearerToken: string }) => string;
}

export const MCP_PLACEHOLDER_TOKEN = "ctm_mcp_YOUR_PERSONAL_SECRET_KEY";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function resolvePublicMcpEndpoints(
  origin?: string,
  mcpEndpointPath = "/api/v1/mcp",
): {
  directEndpointUrl: string;
  bffEndpointUrl: string;
  recommendedMode: McpEndpointMode;
} {
  const rawEnvBase =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_CONTINUUM_API_URL?.trim()) ||
    "";
  const publicApiBase = /^https?:\/\//i.test(rawEnvBase)
    ? trimTrailingSlashes(rawEnvBase).replace(/\/api\/v1$/i, "")
    : "";

  const trimmedOrigin = trimTrailingSlashes(origin?.trim() ?? "");
  const resolvedOrigin =
    trimmedOrigin.length > 0 ? trimmedOrigin : "https://app.continuum.ai";
  const normalizedPath = mcpEndpointPath.startsWith("/")
    ? mcpEndpointPath
    : `/${mcpEndpointPath}`;

  const isDevPort3000 = /^https?:\/\/[^/]+:3000$/i.test(resolvedOrigin);
  const isOtherLocalhost =
    !isDevPort3000 &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(resolvedOrigin);

  const directBase = publicApiBase
    ? publicApiBase
    : isDevPort3000
      ? resolvedOrigin.replace(/:3000$/, ":3001")
      : isOtherLocalhost
        ? "http://localhost:3001"
        : resolvedOrigin;

  const recommendedMode: McpEndpointMode =
    Boolean(publicApiBase) || isDevPort3000 ? "direct" : "bff";

  return {
    directEndpointUrl: `${directBase}${normalizedPath}`,
    bffEndpointUrl: `${resolvedOrigin}/api/backend/mcp`,
    recommendedMode,
  };
}

export const MCP_IDE_CLIENT_SPECS: readonly McpIdeClientSpec[] = [
  {
    id: "antigravity",
    label: "Google Antigravity",
    shortLabel: "Antigravity",
    targetFile: "~/.gemini/antigravity/mcp_config.json",
    language: "json",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      JSON.stringify(
        {
          mcpServers: {
            continuum: {
              serverUrl: endpointUrl,
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "claude-code",
    label: "Claude Code CLI",
    shortLabel: "Claude Code",
    targetFile: "Terminal (claude mcp add)",
    language: "bash",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      `claude mcp add --transport http continuum "${endpointUrl}" --header "Authorization: Bearer ${bearerToken}"`,
  },
  {
    id: "cursor",
    label: "Cursor",
    shortLabel: "Cursor",
    targetFile: ".cursor/mcp.json",
    language: "json",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      JSON.stringify(
        {
          mcpServers: {
            continuum: {
              type: "http",
              url: endpointUrl,
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    shortLabel: "Claude Desktop",
    targetFile: "claude_desktop_config.json",
    language: "json",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      JSON.stringify(
        {
          mcpServers: {
            continuum: {
              command: "npx",
              args: [
                "-y",
                "mcp-remote",
                endpointUrl,
                "--header",
                "Authorization:${AUTH_HEADER}",
              ],
              env: {
                AUTH_HEADER: `Bearer ${bearerToken}`,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "vscode",
    label: "VS Code (Copilot)",
    shortLabel: "VS Code",
    targetFile: ".vscode/mcp.json",
    language: "json",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      JSON.stringify(
        {
          servers: {
            continuum: {
              type: "http",
              url: endpointUrl,
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    shortLabel: "Windsurf",
    targetFile: "~/.codeium/windsurf/mcp_config.json",
    language: "json",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      JSON.stringify(
        {
          mcpServers: {
            continuum: {
              serverUrl: endpointUrl,
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "curl",
    label: "JSON-RPC curl",
    shortLabel: "curl",
    targetFile: "Streamable HTTP POST (2025-03-26)",
    language: "bash",
    buildSnippet: ({ endpointUrl, bearerToken }) =>
      `curl -sS -X POST "${endpointUrl}" -H "Authorization: Bearer ${bearerToken}" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"tools/call\\",\\"params\\":{\\"name\\":\\"continuum_get_context\\",\\"arguments\\":{}}}"`,
  },
];
