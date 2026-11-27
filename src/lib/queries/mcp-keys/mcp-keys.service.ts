import { apiClient } from "@/lib/api-client";
import type {
  CreateMcpApiKeyRequest,
  CreateMcpApiKeyResponse,
  ListMcpApiKeysResponse,
  RevokeMcpApiKeyResponse,
} from "./mcp-keys.types";

const MCP_API_KEYS_BASE = "/iam/mcp-api-keys";

export function listMcpApiKeys(
  signal?: AbortSignal,
): Promise<ListMcpApiKeysResponse> {
  return apiClient<ListMcpApiKeysResponse>(MCP_API_KEYS_BASE, {
    method: "GET",
    signal,
    cache: "no-store",
  });
}

export function createMcpApiKey(
  input: CreateMcpApiKeyRequest,
): Promise<CreateMcpApiKeyResponse> {
  return apiClient<CreateMcpApiKeyResponse>(MCP_API_KEYS_BASE, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeMcpApiKey(
  keyId: string,
): Promise<RevokeMcpApiKeyResponse> {
  return apiClient<RevokeMcpApiKeyResponse>(
    `${MCP_API_KEYS_BASE}/${encodeURIComponent(keyId)}`,
    {
      method: "DELETE",
    },
  );
}
