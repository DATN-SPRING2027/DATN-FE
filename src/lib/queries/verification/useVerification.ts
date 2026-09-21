"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { verificationKeys } from "./verification.keys";

export type VerificationProposal = Readonly<{
  id: string;
  title: string;
  summary: string;
  sourceType: "daily_note" | "jira" | "slack" | "doc";
  authorId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}>;

export type VerifyDecisionInput = Readonly<{
  proposalId: string;
  decision: "approved" | "rejected";
  reason?: string;
}>;

export function useVerificationInboxQuery(
  options?: Omit<UseQueryOptions<readonly VerificationProposal[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    ...options,
    queryKey: verificationKeys.inbox(),
    queryFn: () => apiClient<readonly VerificationProposal[]>("/verification/inbox"),
  });
}

export function useVerifyProposalMutation(
  options?: Omit<UseMutationOptions<VerificationProposal, Error, VerifyDecisionInput>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: ({ proposalId, decision, reason }: VerifyDecisionInput) =>
      apiClient<VerificationProposal>(`/verification/proposals/${proposalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: verificationKeys.inbox() });
      options?.onSuccess?.(...args);
    },
  });
}
