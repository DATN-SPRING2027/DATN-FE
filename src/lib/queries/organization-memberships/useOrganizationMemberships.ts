"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CancelInvitationInput,
  InviteMemberInput,
  ResendInvitationInput,
  SuspendMembershipInput,
} from "./organization-memberships.contract";
import type { MembershipMutationAck } from "./organization-memberships.contract";
import {
  cancelOrganizationInvitation,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMemberships,
  resendOrganizationInvitation,
  suspendOrganizationMembership,
  type MembershipListFilter,
} from "./organization-memberships.service";

export const organizationMembershipKeys = {
  scope: (actorId: string, organizationId: string) =>
    ["organization-memberships", actorId, organizationId] as const,
  list: (actorId: string, organizationId: string, filter: MembershipListFilter) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "list", filter] as const,
  invitations: (actorId: string, organizationId: string, page: number, pageSize: number) =>
    [...organizationMembershipKeys.scope(actorId, organizationId), "invitations", page, pageSize] as const,
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

function useMembershipMutation<TInput>(
  actorId: string,
  organizationId: string,
  mutationFn: (input: TInput) => Promise<MembershipMutationAck>,
) {
  const queryClient = useQueryClient();
  return useMutation<MembershipMutationAck, Error, TInput>({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: organizationMembershipKeys.scope(actorId, organizationId),
      });
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
