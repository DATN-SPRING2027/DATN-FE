/**
 * Continuum AI — MCP Personal API Keys Frozen REST Contract
 * Matches /api/v1/iam/mcp-api-keys cross-repo specification verbatim.
 */

export type McpKeyScopeMode = "READ_ONLY" | "READ_WRITE" | "FULL_OPERATIONS";

export type McpApiKeyStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface McpApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scope: McpKeyScopeMode;
  allowedProjectIds: string[] | null;
  organizationId: string;
  userId: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: McpApiKeyStatus;
}

export interface ListMcpApiKeysResponse {
  items: McpApiKeyView[];
  mcpEndpointPath: "/api/v1/mcp" | string;
  protocolVersion: "2025-03-26" | string;
  toolCount: number;
}

export interface CreateMcpApiKeyRequest {
  name: string;
  scope?: McpKeyScopeMode;
  allowedProjectIds?: string[] | null;
  expiresInDays?: number | null;
}

export interface CreateMcpApiKeyResponse {
  key: McpApiKeyView;
  rawKey: string;
}

export interface RevokeMcpApiKeyResponse {
  key: McpApiKeyView;
}
