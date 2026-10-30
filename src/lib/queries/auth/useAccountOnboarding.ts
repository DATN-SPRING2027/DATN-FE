"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { acceptOrganizationInvitation } from "@/lib/queries/organization-memberships/organization-invitations";
import {
  parseRecipientInvitationPage,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { authKeys } from "./auth.keys";
import type { CurrentUserResponse } from "./useAuth";

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface OrganizationSlugAvailability {
  slug: string;
  valid: boolean;
  available: boolean;
  reason?: "INVALID_FORMAT" | "TAKEN";
}

export function checkOrganizationSlugAvailability(
  slug: string,
  signal?: AbortSignal,
): Promise<OrganizationSlugAvailability> {
  return apiClient<OrganizationSlugAvailability>(
    `/iam/organizations/slug-availability?slug=${encodeURIComponent(slug)}`,
    { signal },
  );
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      apiClient<OrganizationOption>("/iam/organizations", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "organizations"] });
    },
  });
}

export interface AcceptOrganizationInvitationInput {
  invitationId: string;
  organizationId: string;
  expectedInvitationVersion: number;
  idempotencyKey: string;
}

export function useAcceptOrganizationInvitationMutation() {
  const queryClient = useQueryClient();
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "organizations"] });
    },
  });
}

export interface SelectOrganizationResponse {
  user: {
    id?: string;
    email?: string;
    name?: string;
    context?: "ORGANIZATION";
    organizationId: string;
    roles?: readonly string[];
  };
}

export function useSelectOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) =>
      apiClient<SelectOrganizationResponse>("/auth/select-organization", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ organizationId }),
      }),
    onSuccess: (data, organizationId) => {
      const nextOrganizationId = data?.user?.organizationId || organizationId;
      queryClient.setQueryData<CurrentUserResponse | undefined>(
        authKeys.currentUser(),
        (previous) => {
          if (
            data?.user &&
            typeof data.user.id === "string" &&
            typeof data.user.email === "string" &&
            typeof data.user.name === "string"
          ) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              context: "ORGANIZATION",
              organizationId: nextOrganizationId,
              roles: Array.isArray(data.user.roles) ? data.user.roles : [],
            };
          }
          if (!previous) return undefined;
          return {
            id: previous.id,
            email: previous.email,
            name: previous.name,
            context: "ORGANIZATION",
            organizationId: nextOrganizationId,
            roles: Array.isArray(data?.user?.roles)
              ? data.user.roles
              : "roles" in previous && Array.isArray(previous.roles)
                ? previous.roles
                : [],
          };
        },
      );
      void queryClient.cancelQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
    },
  });
}
