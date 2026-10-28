"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptHandoverPackage,
  acceptOptionalHandoverGap,
  acknowledgeHandoverItem,
  askHandoverQuestion,
  cancelHandover,
  completeHandover,
  createHandover,
  generateHandoverDraft,
  getHandover,
  getHandoverCandidates,
  getHandoverDraft,
  getHandoverJob,
  getHandoverRevision,
  getHandoverTaskTransfer,
  type HandoverListFilter,
  listHandoverFollowUps,
  listHandoverItemEvidence,
  listHandovers,
  listHandoverTaskTransfers,
  proposeHandoverSources,
  publishHandoverRevision,
  reconcileHandoverTaskTransfer,
  replaceHandoverDraft,
  resolveHandoverFollowUp,
  retryHandoverJob,
  reviewHandoverEvidence,
  setHandoverCoordinator,
  setHandoverSuccessor,
  startHandoverTaskTransfer,
  submitHandoverEvidence,
  updateHandoverMetadata,
} from "./handover.service";
import type {
  AcceptRequestDto,
  AcknowledgeRequestDto,
  CancelRequestDto,
  CompleteRequestDto,
  CreateHandoverDto,
  DraftRequestDto,
  GenerateRequestDto,
  JobDto,
  OptionalExceptionDto,
  PublishRequestDto,
  QuestionRequestDto,
  ReconcileTransferDto,
  ResolveFollowUpDto,
  RetryJobDto,
  ReviewEvidenceDto,
  SetCoordinatorDto,
  SetSuccessorDto,
  SourceJobRequestDto,
  StartTransferDto,
  SubmitEvidenceDto,
  UpdateMetadataDto,
} from "./handover.types";

export const handoverKeys = {
  all: ["handovers"] as const,
  project: (projectId: string) => ["handovers", projectId] as const,
  list: (projectId: string, filter: HandoverListFilter) =>
    ["handovers", projectId, "list", filter] as const,
  detail: (projectId: string, handoverId: string) =>
    ["handovers", projectId, "detail", handoverId] as const,
  draft: (projectId: string, handoverId: string) =>
    ["handovers", projectId, "draft", handoverId] as const,
  revision: (projectId: string, handoverId: string, revisionId: string) =>
    ["handovers", projectId, "revision", handoverId, revisionId] as const,
  job: (projectId: string, handoverId: string, jobId: string) =>
    ["handovers", projectId, "job", handoverId, jobId] as const,
  candidates: (projectId: string, handoverId: string, jobId: string) =>
    ["handovers", projectId, "candidates", handoverId, jobId] as const,
  evidence: (projectId: string, handoverId: string, itemId: string) =>
    ["handovers", projectId, "evidence", handoverId, itemId] as const,
  transfers: (projectId: string, handoverId: string) =>
    ["handovers", projectId, "transfers", handoverId] as const,
  transfer: (projectId: string, handoverId: string, transferId: string) =>
    ["handovers", projectId, "transfer", handoverId, transferId] as const,
  followUps: (projectId: string, handoverId: string) =>
    ["handovers", projectId, "followUps", handoverId] as const,
};

export function useHandoversQuery(
  projectId: string,
  filter: HandoverListFilter = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.list(projectId, filter),
    enabled: Boolean(projectId) && options.enabled !== false,
    retry: false,
    staleTime: 5_000,
    queryFn: ({ signal }) =>
      listHandovers(projectId, { ...filter, limit: filter.limit ?? 50 }, signal),
  });
}

export function useHandoverDetailQuery(
  projectId: string,
  handoverId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.detail(projectId, handoverId),
    enabled: Boolean(projectId && handoverId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => getHandover(projectId, handoverId, signal),
  });
}

export function useHandoverDraftQuery(
  projectId: string,
  handoverId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.draft(projectId, handoverId),
    enabled: Boolean(projectId && handoverId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => getHandoverDraft(projectId, handoverId, signal),
  });
}

export function useHandoverRevisionQuery(
  projectId: string,
  handoverId: string,
  revisionId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.revision(projectId, handoverId, revisionId ?? ""),
    enabled:
      Boolean(projectId && handoverId && revisionId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      getHandoverRevision(projectId, handoverId, revisionId!, signal),
  });
}

export function useHandoverJobQuery(
  projectId: string,
  handoverId: string,
  jobId: string | null | undefined,
  options: { enabled?: boolean; refetchIntervalMs?: number | false } = {},
) {
  return useQuery<JobDto>({
    queryKey: handoverKeys.job(projectId, handoverId, jobId ?? ""),
    enabled:
      Boolean(projectId && handoverId && jobId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "PENDING" || state === "RUNNING") {
        return options.refetchIntervalMs ?? 1_500;
      }
      return false;
    },
    queryFn: ({ signal }) =>
      getHandoverJob(projectId, handoverId, jobId!, signal),
  });
}

export function useHandoverCandidatesQuery(
  projectId: string,
  handoverId: string,
  jobId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.candidates(projectId, handoverId, jobId ?? ""),
    enabled:
      Boolean(projectId && handoverId && jobId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      getHandoverCandidates(projectId, handoverId, jobId!, signal),
  });
}

export function useHandoverItemEvidenceQuery(
  projectId: string,
  handoverId: string,
  itemId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.evidence(projectId, handoverId, itemId ?? ""),
    enabled:
      Boolean(projectId && handoverId && itemId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      listHandoverItemEvidence(projectId, handoverId, itemId!, signal),
  });
}

export function useHandoverTransfersQuery(
  projectId: string,
  handoverId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.transfers(projectId, handoverId),
    enabled: Boolean(projectId && handoverId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      listHandoverTaskTransfers(projectId, handoverId, signal),
  });
}

export function useHandoverTransferQuery(
  projectId: string,
  handoverId: string,
  transferId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.transfer(projectId, handoverId, transferId ?? ""),
    enabled:
      Boolean(projectId && handoverId && transferId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      getHandoverTaskTransfer(projectId, handoverId, transferId!, signal),
  });
}

export function useHandoverFollowUpsQuery(
  projectId: string,
  handoverId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: handoverKeys.followUps(projectId, handoverId),
    enabled: Boolean(projectId && handoverId) && options.enabled !== false,
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) =>
      listHandoverFollowUps(projectId, handoverId, { limit: 50 }, signal),
  });
}

function useInvalidateHandoverScope(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: handoverKeys.project(projectId),
    });
  };
}

export function useCreateHandoverMutation(projectId: string) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (input: CreateHandoverDto) => createHandover(projectId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateHandoverMetadataMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: UpdateMetadataDto }) =>
      updateHandoverMetadata(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useSetHandoverSuccessorMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: SetSuccessorDto }) =>
      setHandoverSuccessor(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useSetHandoverCoordinatorMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: SetCoordinatorDto }) =>
      setHandoverCoordinator(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useReplaceHandoverDraftMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: DraftRequestDto }) =>
      replaceHandoverDraft(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useProposeHandoverSourcesMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: SourceJobRequestDto }) =>
      proposeHandoverSources(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useGenerateHandoverDraftMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: GenerateRequestDto }) =>
      generateHandoverDraft(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useRetryHandoverJobMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      jobId: string;
      etag: string;
      input: RetryJobDto;
    }) =>
      retryHandoverJob(
        projectId,
        handoverId,
        vars.jobId,
        vars.etag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}

export function usePublishHandoverRevisionMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: PublishRequestDto }) =>
      publishHandoverRevision(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useAcceptHandoverPackageMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: AcceptRequestDto }) =>
      acceptHandoverPackage(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useAskHandoverQuestionMutation(
  projectId: string,
  handoverId: string,
) {
  return useMutation({
    mutationFn: (input: QuestionRequestDto) =>
      askHandoverQuestion(projectId, handoverId, input),
  });
}

export function useAcknowledgeHandoverItemMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      itemId: string;
      etag: string;
      input: AcknowledgeRequestDto;
    }) =>
      acknowledgeHandoverItem(
        projectId,
        handoverId,
        vars.itemId,
        vars.etag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}

export function useSubmitHandoverEvidenceMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      itemId: string;
      etag: string;
      input: SubmitEvidenceDto;
    }) =>
      submitHandoverEvidence(
        projectId,
        handoverId,
        vars.itemId,
        vars.etag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}

export function useReviewHandoverEvidenceMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      itemId: string;
      evidenceId: string;
      etag: string;
      input: ReviewEvidenceDto;
    }) =>
      reviewHandoverEvidence(
        projectId,
        handoverId,
        vars.itemId,
        vars.evidenceId,
        vars.etag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}

export function useAcceptOptionalHandoverGapMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      itemId: string;
      etag: string;
      input: OptionalExceptionDto;
    }) =>
      acceptOptionalHandoverGap(
        projectId,
        handoverId,
        vars.itemId,
        vars.etag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}

export function useStartHandoverTaskTransferMutation(
  projectId: string,
  handoverId: string,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: StartTransferDto }) =>
      startHandoverTaskTransfer(projectId, handoverId, vars.etag, vars.input),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({
        queryKey: ["tasks", "project", projectId],
      });
    },
  });
}

export function useReconcileHandoverTaskTransferMutation(
  projectId: string,
  handoverId: string,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      transferId: string;
      etag: string;
      input: ReconcileTransferDto;
    }) =>
      reconcileHandoverTaskTransfer(
        projectId,
        handoverId,
        vars.transferId,
        vars.etag,
        vars.input,
      ),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({
        queryKey: ["tasks", "project", projectId],
      });
    },
  });
}

export function useCompleteHandoverMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: CompleteRequestDto }) =>
      completeHandover(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useCancelHandoverMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: { etag: string; input: CancelRequestDto }) =>
      cancelHandover(projectId, handoverId, vars.etag, vars.input),
    onSuccess: invalidate,
  });
}

export function useResolveHandoverFollowUpMutation(
  projectId: string,
  handoverId: string,
) {
  const invalidate = useInvalidateHandoverScope(projectId);
  return useMutation({
    mutationFn: (vars: {
      followupId: string;
      followupEtag: string;
      input: ResolveFollowUpDto;
    }) =>
      resolveHandoverFollowUp(
        projectId,
        handoverId,
        vars.followupId,
        vars.followupEtag,
        vars.input,
      ),
    onSuccess: invalidate,
  });
}
