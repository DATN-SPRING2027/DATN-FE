"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { executeTeamCommand, getTeam, listTeams } from "./team.service";
import type { TeamCommand, TeamFilter, TeamScope } from "./team.contract";

export function teamKeys(scope: TeamScope, actor: string) {
  return ["teams", actor, scope.organizationId, scope.projectId] as const;
}
export function useTeams(
  scope: TeamScope,
  actor: string,
  page: number,
  status: TeamFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: [...teamKeys(scope, actor), "list", page, status],
    queryFn: ({ signal }) => listTeams(scope, page, status, signal),
    enabled: enabled && Boolean(actor && scope.organizationId && scope.projectId),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
export function useTeam(
  scope: TeamScope,
  actor: string,
  id: string,
  enabled = true,
  refetchOnWindowFocus = false,
) {
  return useQuery({
    queryKey: [...teamKeys(scope, actor), "detail", id],
    queryFn: ({ signal }) => getTeam(scope, id, signal),
    enabled: enabled && Boolean(id),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus,
    refetchOnReconnect: false,
  });
}
export function useTeamCommand(
  scope: TeamScope,
  actor: string,
  operation: string,
  target: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...teamKeys(scope, actor), "command", operation, target],
    mutationFn: (command: TeamCommand) => executeTeamCommand(scope, command),
    retry: false,
    gcTime: 24 * 60 * 60 * 1000,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: teamKeys(scope, actor),
        refetchType: "none",
      }),
  });
}
