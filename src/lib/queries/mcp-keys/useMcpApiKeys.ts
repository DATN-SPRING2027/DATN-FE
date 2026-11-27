"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMcpApiKey,
  listMcpApiKeys,
  revokeMcpApiKey,
} from "./mcp-keys.service";
import type {
  CreateMcpApiKeyRequest,
  ListMcpApiKeysResponse,
} from "./mcp-keys.types";

export const mcpApiKeysQueryKeys = {
  scope: (actorId: string, organizationId: string) =>
    ["mcp-api-keys", actorId, organizationId] as const,
};

export function useMcpApiKeysQuery(
  actorId: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: mcpApiKeysQueryKeys.scope(actorId, organizationId),
    queryFn: ({ signal }) => listMcpApiKeys(signal),
    enabled: Boolean(actorId && organizationId) && enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMcpApiKeyMutation(
  actorId: string,
  organizationId: string,
) {
  const queryClient = useQueryClient();
  const queryKey = mcpApiKeysQueryKeys.scope(actorId, organizationId);

  return useMutation({
    mutationKey: ["create-mcp-api-key", actorId, organizationId],
    retry: false,
    mutationFn: (input: CreateMcpApiKeyRequest) => createMcpApiKey(input),
    onSuccess: (created) => {
      queryClient.setQueryData<ListMcpApiKeysResponse>(queryKey, (previous) => {
        if (!previous) {
          return {
            items: [created.key],
            mcpEndpointPath: "/api/v1/mcp",
            protocolVersion: "2025-03-26",
            toolCount: 28,
          };
        }
        const filtered = previous.items.filter(
          (item) => item.id !== created.key.id,
        );
        return {
          ...previous,
          items: [created.key, ...filtered],
        };
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useRevokeMcpApiKeyMutation(
  actorId: string,
  organizationId: string,
) {
  const queryClient = useQueryClient();
  const queryKey = mcpApiKeysQueryKeys.scope(actorId, organizationId);

  return useMutation({
    mutationKey: ["revoke-mcp-api-key", actorId, organizationId],
    retry: false,
    mutationFn: (keyId: string) => revokeMcpApiKey(keyId),
    onSuccess: (revoked) => {
      queryClient.setQueryData<ListMcpApiKeysResponse>(queryKey, (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          items: previous.items.map((item) =>
            item.id === revoked.key.id ? revoked.key : item,
          ),
        };
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
