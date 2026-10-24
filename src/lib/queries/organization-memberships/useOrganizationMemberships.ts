"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CancelInvitationInput,
  InviteMemberInput,
  OrganizationRoleMutationAck,
  OrganizationSettingsSummary,
  RemoveMembershipInput,
  ResendInvitationInput,
  ResumeMembershipInput,
  SetOrganizationMembershipRoleInput,
  SuspendMembershipInput,
  UpdateOrganizationSettingsInput,
} from "./organization-memberships.contract";
import type { OrganizationMutationAck } from "./organization-memberships.contract";
import {
  cancelOrganizationInvitation,
  getOrganizationOverview,
  getOrganizationSettings,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMemberships,
  removeOrganizationMembership,
  resendOrganizationInvitation,
  resumeOrganizationMembership,
  setOrganizationMembershipRole,
  suspendOrganizationMembership,
  updateOrganizationSettings,
  type MembershipListFilter,
} from "./organization-memberships.service";

export const organizationMembershipKeys = {
  scope: (actorId: string, organizationId: string) =>
    ["organization-memberships", actorId, organizationId] as const,
  list: (actorId: string, organizationId: string, filter: MembershipListFilter) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "list", filter] as const,
  invitations: (actorId: string, organizationId: string, page: number, pageSize: number) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "invitations", page, pageSize] as const,
  overview: (actorId: string, organizationId: string) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "overview"] as const,
  settings: (actorId: string, organizationId: string) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "settings"] as const,
};

function queryOptions() {
  return {
    retry: false,
    throwOnError: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: "always" as const,
  };
}

export function useOrganizationMembershipsQuery(
  actorId: string,
  organizationId: string,
  filter: MembershipListFilter,
) {
  return useQuery({
    ...queryOptions(),
    queryKey: organizationMembershipKeys.list(actorId, organizationId, filter),
    enabled: Boolean(actorId && organizationId),
    queryFn: ({ signal }) => listOrganizationMemberships(organizationId, filter, signal),
  });
}

export function useOrganizationInvitationsQuery(
  actorId: string,
  organizationId: string,
  page: number,
  pageSize = 20,
) {
  return useQuery({
    ...queryOptions(),
    queryKey: organizationMembershipKeys.invitations(actorId, organizationId, page, pageSize),
    enabled: Boolean(actorId && organizationId),
    queryFn: ({ signal }) => listOrganizationInvitations(organizationId, page, pageSize, signal),
  });
}

export function useOrganizationOverviewQuery(
  actorId: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    ...queryOptions(),
    queryKey: organizationMembershipKeys.overview(actorId, organizationId),
    enabled: Boolean(actorId && organizationId && enabled),
    queryFn: ({ signal }) => getOrganizationOverview(organizationId, signal),
  });
}

export function useOrganizationSettingsQuery(
  actorId: string,
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    ...queryOptions(),
    queryKey: organizationMembershipKeys.settings(actorId, organizationId),
    enabled: Boolean(actorId && organizationId && enabled),
    queryFn: ({ signal }) => getOrganizationSettings(organizationId, signal),
  });
}

function useMembershipMutation<TInput>(
  actorId: string,
  organizationId: string,
  mutationFn: (input: TInput) => Promise<OrganizationMutationAck>,
) {
  const queryClient = useQueryClient();
  return useMutation<OrganizationMutationAck, Error, TInput>({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationMembershipKeys.scope(actorId, organizationId) }),
        queryClient.invalidateQueries({ queryKey: ["projects", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["organization-handover-candidates", actorId, organizationId] }),
      ]);
    },
  });
}

export type IdempotentInput<T> = Readonly<{ input: T; idempotencyKey: string }>;

export function useInviteOrganizationMember(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<InviteMemberInput>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => inviteOrganizationMember(organizationId, input, idempotencyKey),
  );
}

export function useResendOrganizationInvitation(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<ResendInvitationInput & { invitationId: string }>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => {
      const { invitationId, ...body } = input;
      return resendOrganizationInvitation(organizationId, invitationId, body, idempotencyKey);
    },
  );
}

export function useCancelOrganizationInvitation(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<CancelInvitationInput & { invitationId: string }>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => {
      const { invitationId, ...body } = input;
      return cancelOrganizationInvitation(organizationId, invitationId, body, idempotencyKey);
    },
  );
}

export function useSuspendOrganizationMembership(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<SuspendMembershipInput & { membershipId: string }>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => {
      const { membershipId, ...body } = input;
      return suspendOrganizationMembership(organizationId, membershipId, body, idempotencyKey);
    },
  );
}

export function useResumeOrganizationMembership(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<ResumeMembershipInput & { membershipId: string }>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => {
      const { membershipId, ...body } = input;
      return resumeOrganizationMembership(organizationId, membershipId, body, idempotencyKey);
    },
  );
}

export function useRemoveOrganizationMembership(actorId: string, organizationId: string) {
  return useMembershipMutation<IdempotentInput<RemoveMembershipInput & { membershipId: string }>>(
    actorId,
    organizationId,
    ({ input, idempotencyKey }) => {
      const { membershipId, ...body } = input;
      return removeOrganizationMembership(organizationId, membershipId, body, idempotencyKey);
    },
  );
}

export function useSetOrganizationMembershipRole(actorId: string, organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OrganizationRoleMutationAck,
    Error,
    IdempotentInput<SetOrganizationMembershipRoleInput & { membershipId: string }>
  >({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn: ({ input, idempotencyKey }) => {
      const { membershipId, ...body } = input;
      return setOrganizationMembershipRole(organizationId, membershipId, body, idempotencyKey);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: organizationMembershipKeys.scope(actorId, organizationId),
      });
    },
  });
}

export function useUpdateOrganizationSettings(actorId: string, organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation<OrganizationSettingsSummary, Error, UpdateOrganizationSettingsInput>({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn: (input) => updateOrganizationSettings(organizationId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(organizationMembershipKeys.settings(actorId, organizationId), updated);
      await queryClient.invalidateQueries({
        queryKey: organizationMembershipKeys.scope(actorId, organizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["auth", "organizations"],
      });
    },
  });
}
