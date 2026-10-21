"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { acceptOrganizationInvitation } from "@/lib/queries/organization-memberships/organization-invitations";
import {
  parseRecipientInvitationPage,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { authKeys } from "./auth.keys";

export interface OrganizationOption {
  id: string;
  name: string;
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
    queryFn: async () =>
      parseRecipientInvitationPage(
        await apiClient<unknown>("/auth/invitations?page=1&pageSize=20"),
      ),
    enabled,
    retry: false,
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

export interface AcceptOrganizationInvitationInput {
  invitationId: string;
  organizationId: string;
  expectedInvitationVersion: number;
  idempotencyKey: string;
}

export function useAcceptOrganizationInvitationMutation() {
  return useMutation({
    mutationFn: ({
      invitationId,
      organizationId,
      expectedInvitationVersion,
      idempotencyKey,
    }: AcceptOrganizationInvitationInput) =>
      acceptOrganizationInvitation(
        invitationId,
        organizationId,
        0,
        expectedInvitationVersion,
        idempotencyKey,
      ),
    retry: false,
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
