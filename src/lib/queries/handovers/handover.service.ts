import { apiClient } from "@/lib/api-client";
import type {
  AcceptRequestDto,
  AcknowledgeRequestDto,
  CancelRequestDto,
  CompleteRequestDto,
  CreateHandoverDto,
  DraftProjectionDto,
  DraftRequestDto,
  DraftResource,
  EvidenceReceiptDto,
  FollowUpDto,
  FollowUpListDto,
  GenerateRequestDto,
  HandoverAnswerDto,
  HandoverDetailDto,
  HandoverListDto,
  HandoverResource,
  HandoverStatus,
  ItemEvidenceListDto,
  JobDto,
  OptionalExceptionDto,
  PublishRequestDto,
  QuestionRequestDto,
  ReceiptDto,
  ReconcileTransferDto,
  ResolveFollowUpDto,
  RetryJobDto,
  ReviewEvidenceDto,
  RevisionProjectionDto,
  SetCoordinatorDto,
  SetSuccessorDto,
  SourceCandidatesDto,
  SourceJobRequestDto,
  StartTransferDto,
  SubmitEvidenceDto,
  TransferDto,
  TransferListDto,
  UpdateMetadataDto,
} from "./handover.types";

export interface MutationResult<T> {
  data: T;
  etag: string | null;
  replayed: boolean;
}

export function formatHandoverEtag(
  handoverId: string,
  version: number,
): string {
  return `"handover:${handoverId}:${version}"`;
}

export function formatFollowUpEtag(
  followupId: string,
  version: number,
): string {
  return `"handover-followup:${followupId}:${version}"`;
}

export function readCsrfTokenFromDocument(): string | undefined {
  if (typeof document === "undefined" || !document.cookie) {
    return undefined;
  }
  const cookies = document.cookie.split(";").map((entry) => entry.trim());
  for (const prefix of ["__Host-csrf=", "continuum_csrf=", "csrf_token="]) {
    const match = cookies.find((c) => c.startsWith(prefix));
    if (match) {
      const raw = match.slice(prefix.length).trim();
      if (raw) {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }
  }
  return undefined;
}

export function canonicalizeCommandIntent(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonicalizeCommandIntent).join(",")}]`; const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${canonicalizeCommandIntent(record[k])}`).join(",")}}`; }
export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function projectHandoversPath(projectId: string, suffix = ""): string {
  return `/handover/projects/${encodeURIComponent(projectId)}/handovers${suffix}`;
}

function buildMutationHeaders(options: {
  etag?: string;
  idempotencyKey?: string;
  includeIdempotency?: boolean;
}): Headers {
  const headers = new Headers();
  if (options.includeIdempotency !== false) {
    headers.set(
      "Idempotency-Key",
      options.idempotencyKey ?? generateIdempotencyKey(),
    );
  }
  if (options.etag) {
    headers.set("If-Match", options.etag);
  }
  const csrf = readCsrfTokenFromDocument();
  if (csrf) {
    headers.set("X-CSRF-Token", csrf);
  }
  return headers;
}

async function runMutation<T>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
  options: {
    etag?: string;
    idempotencyKey?: string;
    includeIdempotency?: boolean;
  } = {},
): Promise<MutationResult<T>> {
  let responseEtag: string | null = null;
  let replayed = false;
  const data = await apiClient<T>(endpoint, {
    method,
    headers: buildMutationHeaders(options),
    body: JSON.stringify(body),
    cache: "no-store",
    onResponseHeaders: (headers) => {
      responseEtag = headers.get("etag");
      replayed = headers.get("idempotency-replayed") === "true";
    },
  });
  return { data, etag: responseEtag, replayed };
}

export interface HandoverListFilter {
  status?: HandoverStatus | "ALL";
  departingUserId?: string;
  successorUserId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listHandovers(
  projectId: string,
  filter: HandoverListFilter = {},
  signal?: AbortSignal,
): Promise<HandoverListDto> {
  // Backend GET /handovers strictly accepts only `cursor` and `limit` query parameters.
  const query = new URLSearchParams();
  if (filter.cursor) query.set("cursor", filter.cursor);
  if (filter.limit !== undefined) query.set("limit", String(filter.limit));

  const qs = query.toString();
  const response = await apiClient<HandoverListDto>(
    `${projectHandoversPath(projectId)}${qs ? `?${qs}` : ""}`,
    {
      cache: "no-store",
      signal,
    },
  );

  const normalizedSearch = filter.search?.trim().toLowerCase();
  const filtered = response.data.filter((item) => {
    if (filter.status && filter.status !== "ALL" && item.status !== filter.status) {
      return false;
    }
    if (
      filter.departingUserId &&
      item.departingUserId !== filter.departingUserId
    ) {
      return false;
    }
    if (
      filter.successorUserId &&
      item.successorUserId !== filter.successorUserId
    ) {
      return false;
    }
    if (normalizedSearch && normalizedSearch.length > 0) {
      return item.title.toLowerCase().includes(normalizedSearch);
    }
    return true;
  });

  return {
    data: filtered,
    nextCursor: response.nextCursor,
  };
}

export async function createHandover(
  projectId: string,
  input: CreateHandoverDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(projectId),
    "POST",
    input,
    { idempotencyKey },
  );
}

export async function getHandover(
  projectId: string,
  handoverId: string,
  signal?: AbortSignal,
): Promise<HandoverResource> {
  let etag: string | null = null;
  const detail = await apiClient<HandoverDetailDto>(
    projectHandoversPath(projectId, `/${encodeURIComponent(handoverId)}`),
    {
      cache: "no-store",
      signal,
      onResponseHeaders: (headers) => {
        etag = headers.get("etag");
      },
    },
  );
  return {
    detail,
    etag:
      etag ?? formatHandoverEtag(detail.handover.id, detail.handover.version),
  };
}

export async function updateHandoverMetadata(
  projectId: string,
  handoverId: string,
  etag: string,
  input: UpdateMetadataDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(projectId, `/${encodeURIComponent(handoverId)}`),
    "PATCH",
    input,
    { etag, idempotencyKey },
  );
}

export async function setHandoverSuccessor(
  projectId: string,
  handoverId: string,
  etag: string,
  input: SetSuccessorDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/successor`,
    ),
    "PUT",
    input,
    { etag, idempotencyKey },
  );
}

export async function setHandoverCoordinator(
  projectId: string,
  handoverId: string,
  etag: string,
  input: SetCoordinatorDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/coordinator`,
    ),
    "PUT",
    input,
    { etag, idempotencyKey },
  );
}

export async function getHandoverDraft(
  projectId: string,
  handoverId: string,
  signal?: AbortSignal,
): Promise<DraftResource> {
  let etag: string | null = null;
  const draft = await apiClient<DraftProjectionDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/draft`,
    ),
    {
      cache: "no-store",
      signal,
      onResponseHeaders: (headers) => {
        etag = headers.get("etag");
      },
    },
  );
  return {
    draft,
    etag: etag ?? "",
  };
}

export async function replaceHandoverDraft(
  projectId: string,
  handoverId: string,
  etag: string,
  input: DraftRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/draft`,
    ),
    "PUT",
    input,
    { etag, idempotencyKey },
  );
}

export async function proposeHandoverSources(
  projectId: string,
  handoverId: string,
  etag: string,
  input: SourceJobRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<JobDto>> {
  return runMutation<JobDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/source-proposals`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function generateHandoverDraft(
  projectId: string,
  handoverId: string,
  etag: string,
  input: GenerateRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<JobDto>> {
  return runMutation<JobDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/generations`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function getHandoverJob(
  projectId: string,
  handoverId: string,
  jobId: string,
  signal?: AbortSignal,
): Promise<JobDto> {
  return apiClient<JobDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/jobs/${encodeURIComponent(jobId)}`,
    ),
    { cache: "no-store", signal },
  );
}

export async function getHandoverCandidates(
  projectId: string,
  handoverId: string,
  jobId: string,
  signal?: AbortSignal,
): Promise<SourceCandidatesDto> {
  return apiClient<SourceCandidatesDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/jobs/${encodeURIComponent(jobId)}/candidates`,
    ),
    { cache: "no-store", signal },
  );
}

export async function retryHandoverJob(
  projectId: string,
  handoverId: string,
  jobId: string,
  etag: string,
  input: RetryJobDto,
  idempotencyKey?: string,
): Promise<MutationResult<JobDto>> {
  return runMutation<JobDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/jobs/${encodeURIComponent(jobId)}/retry`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function publishHandoverRevision(
  projectId: string,
  handoverId: string,
  etag: string,
  input: PublishRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/revisions`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function getHandoverRevision(
  projectId: string,
  handoverId: string,
  revisionId: string,
  signal?: AbortSignal,
): Promise<RevisionProjectionDto> {
  return apiClient<RevisionProjectionDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/revisions/${encodeURIComponent(revisionId)}`,
    ),
    { cache: "no-store", signal },
  );
}

export async function acceptHandoverPackage(
  projectId: string,
  handoverId: string,
  etag: string,
  input: AcceptRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/acceptance`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function askHandoverQuestion(
  projectId: string,
  handoverId: string,
  input: QuestionRequestDto,
): Promise<MutationResult<HandoverAnswerDto>> {
  return runMutation<HandoverAnswerDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/questions`,
    ),
    "POST",
    input,
    { includeIdempotency: false },
  );
}

export async function acknowledgeHandoverItem(
  projectId: string,
  handoverId: string,
  itemId: string,
  etag: string,
  input: AcknowledgeRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/acknowledgements`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function listHandoverItemEvidence(
  projectId: string,
  handoverId: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<ItemEvidenceListDto> {
  return apiClient<ItemEvidenceListDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/evidence`,
    ),
    { cache: "no-store", signal },
  );
}

export async function submitHandoverEvidence(
  projectId: string,
  handoverId: string,
  itemId: string,
  etag: string,
  input: SubmitEvidenceDto,
  idempotencyKey?: string,
): Promise<MutationResult<EvidenceReceiptDto>> {
  return runMutation<EvidenceReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/evidence`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function reviewHandoverEvidence(
  projectId: string,
  handoverId: string,
  itemId: string,
  evidenceId: string,
  etag: string,
  input: ReviewEvidenceDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/evidence/${encodeURIComponent(evidenceId)}/reviews`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function acceptOptionalHandoverGap(
  projectId: string,
  handoverId: string,
  itemId: string,
  etag: string,
  input: OptionalExceptionDto,
  idempotencyKey?: string,
): Promise<MutationResult<FollowUpDto>> {
  return runMutation<FollowUpDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/items/${encodeURIComponent(itemId)}/exceptions`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function listHandoverTaskTransfers(
  projectId: string,
  handoverId: string,
  signal?: AbortSignal,
): Promise<TransferListDto> {
  return apiClient<TransferListDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/task-transfers`,
    ),
    { cache: "no-store", signal },
  );
}

export async function startHandoverTaskTransfer(
  projectId: string,
  handoverId: string,
  etag: string,
  input: StartTransferDto,
  idempotencyKey?: string,
): Promise<MutationResult<TransferDto>> {
  return runMutation<TransferDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/task-transfers`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function getHandoverTaskTransfer(
  projectId: string,
  handoverId: string,
  transferId: string,
  signal?: AbortSignal,
): Promise<TransferDto> {
  return apiClient<TransferDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/task-transfers/${encodeURIComponent(transferId)}`,
    ),
    { cache: "no-store", signal },
  );
}

export async function reconcileHandoverTaskTransfer(
  projectId: string,
  handoverId: string,
  transferId: string,
  etag: string,
  input: ReconcileTransferDto,
  idempotencyKey?: string,
): Promise<MutationResult<TransferDto>> {
  return runMutation<TransferDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/task-transfers/${encodeURIComponent(transferId)}/reconciliation`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function completeHandover(
  projectId: string,
  handoverId: string,
  etag: string,
  input: CompleteRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/completion`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function cancelHandover(
  projectId: string,
  handoverId: string,
  etag: string,
  input: CancelRequestDto,
  idempotencyKey?: string,
): Promise<MutationResult<ReceiptDto>> {
  return runMutation<ReceiptDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/cancellation`,
    ),
    "POST",
    input,
    { etag, idempotencyKey },
  );
}

export async function listHandoverFollowUps(
  projectId: string,
  handoverId: string,
  query: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<FollowUpListDto> {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();

  return apiClient<FollowUpListDto>(
    `${projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/follow-ups`,
    )}${qs ? `?${qs}` : ""}`,
    { cache: "no-store", signal },
  );
}

export async function resolveHandoverFollowUp(
  projectId: string,
  handoverId: string,
  followupId: string,
  followupEtag: string,
  input: ResolveFollowUpDto,
  idempotencyKey?: string,
): Promise<MutationResult<FollowUpDto>> {
  return runMutation<FollowUpDto>(
    projectHandoversPath(
      projectId,
      `/${encodeURIComponent(handoverId)}/follow-ups/${encodeURIComponent(followupId)}/resolution`,
    ),
    "POST",
    input,
    { etag: followupEtag, idempotencyKey },
  );
}
