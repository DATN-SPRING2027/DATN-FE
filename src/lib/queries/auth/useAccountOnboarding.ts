"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { authKeys } from "./auth.keys";

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  roleCode: "ADMIN" | "TEAM_LEADER" | "MEMBER";
  status: "PENDING";
  expiresAt: string;
  createdAt: string;
}

function csrfHeaders(): HeadersInit {
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("__Host-csrf="));
  return entry
    ? { "x-csrf-token": decodeURIComponent(entry.slice("__Host-csrf=".length)) }
    : {};
}

export function useOrganizationOptionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "organizations"],
    queryFn: () => apiClient<OrganizationOption[]>("/auth/organizations"),
    enabled,
    retry: false,
  });
}

export function useMyOrganizationInvitationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "invitations"],
    queryFn: () => apiClient<OrganizationInvitation[]>("/auth/invitations"),
    enabled,
    retry: false,
  });
}

export function useAcceptOrganizationInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiClient<{ organizationId: string; organizationName: string }>(
        `/auth/invitations/${encodeURIComponent(invitationId)}/accept`,
        {
          method: "POST",
          headers: csrfHeaders(),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "invitations"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "organizations"] });
    },
  });
}

export function useOrganizationInvitationsQuery(
  organizationId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["iam", organizationId, "invitations"],
    queryFn: () =>
      apiClient<OrganizationInvitation[]>(
        `/iam/organizations/${encodeURIComponent(organizationId)}/invitations`,
      ),
    enabled: Boolean(organizationId && enabled),
    retry: false,
  });
}

export function useCreateOrganizationInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      email,
      roleCode,
    }: {
      organizationId: string;
      email: string;
      roleCode: OrganizationInvitation["roleCode"];
    }) =>
      apiClient<OrganizationInvitation>(
        `/iam/organizations/${encodeURIComponent(organizationId)}/invitations`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({ email, roleCode }),
        },
      ),
    onSuccess: (_invitation, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["iam", variables.organizationId, "invitations"],
      });
    },
  });
}

export function useRevokeOrganizationInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, invitationId }: {
      organizationId: string;
      invitationId: string;
    }) =>
      apiClient<void>(
        `/iam/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,
        {
          method: "DELETE",
          headers: csrfHeaders(),
        },
      ),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["iam", variables.organizationId, "invitations"],
      });
    },
  });
}

export function useCreateOrganizationMutation() {
  return useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      apiClient<OrganizationOption>("/iam/organizations", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      }),
  });
}

export function useSelectOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) =>
      apiClient<{ user: { organizationId: string } }>("/auth/select-organization", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ organizationId }),
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      queryClient.removeQueries({ queryKey: ["auth", "organizations"] });
    },
  });
}
