/**
 * Continuum AI — Knowledge Handover Frontend Contract & Domain Types
 * Aligned 100% with handover-v1.openapi.yaml & BE HandoverWorkflowController.
 */

export type HandoverStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export type HandoverCapability =
  | "READ"
  | "MANAGE"
  | "RECEIVE"
  | "REVIEW"
  | "TRANSFER"
  | "FOLLOW_UP";

export type SourceRefKind =
  | "TASK_NOTE"
  | "PROJECT_DOCUMENT"
  | "WORK_REPORT"
  | "KNOWLEDGE_OBJECT";

export type CitationLocatorKind = "CHUNK" | "PAGE" | "LINE" | "SECTION";

export type PublishReviewDecision = "CONTENT_APPROVED" | "GAP_REMAINS";

export type PublishImpact = "UNCHANGED" | "CHANGED";

export type UnderstandingDecision = "UNDERSTOOD" | "NEEDS_CLARIFICATION";

export type ItemAcknowledgementState =
  | "PENDING"
  | "UNDERSTOOD"
  | "NEEDS_CLARIFICATION";

export type EvidenceReviewOutcome = "ACCEPTED" | "CHANGES_REQUESTED";

export type ItemEvidenceReviewState =
  | "NOT_REQUIRED"
  | "PENDING"
  | "ACCEPTED"
  | "CHANGES_REQUESTED";

export type ItemSourceState = "CURRENT" | "CHANGED";

export type HandoverJobKind = "SOURCE_PROPOSAL" | "GENERATION";

export type HandoverJobState =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SUPERSEDED"
  | "CANCELLED";

export type TaskTransferChildResultState =
  | "PENDING"
  | "CONFIRMED"
  | "UNKNOWN"
  | "CONFLICT"
  | "FAILED";

export type TaskTransferAggregateState =
  | "PENDING"
  | "CONFIRMED"
  | "PARTIAL"
  | "UNKNOWN"
  | "CONFLICT"
  | "FAILED";

export interface SourceRefDto {
  kind: SourceRefKind;
  id: string;
  version: string;
}

export interface CitationDto {
  source: SourceRefDto;
  locator: {
    kind: CitationLocatorKind;
    value: string;
  };
}

export interface ReceiptDto {
  operationId: string;
  handoverId: string;
  version: number;
  status: HandoverStatus;
  revisionId: string | null;
  replayed: boolean;
}

export interface HandoverSummaryDto {
  id: string;
  projectId: string;
  teamId: string | null;
  departingUserId: string;
  assignedLeaderId: string;
  successorUserId: string | null;
  assignmentVersion: number;
  title: string;
  version: number;
  status: HandoverStatus;
  publishedRevisionId: string | null;
  draftVersion: number;
  targetCompletionDate: string;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableItemDto {
  itemId: string;
  access: "AVAILABLE";
  contentVersion: number;
  title: string;
  body: string;
  isRequired: boolean;
  evidenceRequired: boolean;
  requirement: string;
  sources: SourceRefDto[];
  citations: CitationDto[];
  contentReview: PublishReviewDecision;
  acknowledgement: ItemAcknowledgementState;
  evidenceReview: ItemEvidenceReviewState;
  optionalExceptionAccepted: boolean;
  sourceState: ItemSourceState;
}

export interface UnavailableItemDto {
  itemId: string;
  access: "UNAVAILABLE";
}

export type ItemProjectionDto = AvailableItemDto | UnavailableItemDto;

export interface RevisionProjectionDto {
  id: string;
  handoverId: string;
  number: number;
  publishedAt: string;
  publishedBy: string;
  items: ItemProjectionDto[];
  isCurrent: boolean;
}

export interface HandoverDetailDto {
  handover: HandoverSummaryDto;
  publishedRevision: RevisionProjectionDto | null;
  capabilities: HandoverCapability[];
  requiredPendingCount: number;
  canComplete: boolean;
}

export interface HandoverResource {
  detail: HandoverDetailDto;
  etag: string;
}

export interface HandoverListDto {
  data: HandoverSummaryDto[];
  nextCursor: string | null;
}

export interface DraftItemDto {
  itemId: string;
  contentVersion: number;
  title: string;
  body: string;
  isRequired: boolean;
  evidenceRequired: boolean;
  sources: SourceRefDto[];
  citations: CitationDto[];
  requirement: string;
}

export interface DraftItemInputDto {
  itemId: string | null;
  title: string;
  body: string;
  isRequired: boolean;
  evidenceRequired: boolean;
  sources: SourceRefDto[];
  citations: CitationDto[];
  requirement: string;
}

export interface DraftProjectionDto {
  handoverId: string;
  draftVersion: number;
  items: DraftItemDto[];
  taskIds: string[];
  selectedSources: SourceRefDto[];
}

export interface DraftResource {
  draft: DraftProjectionDto;
  etag: string;
}

export interface JobDto {
  id: string;
  handoverId: string;
  kind: HandoverJobKind;
  state: HandoverJobState;
  inputDraftVersion: number;
  safeErrorCode: string | null;
  createdAt: string;
}

export interface SourceCandidateDto {
  source: SourceRefDto;
  title: string;
  reason: string;
}

export interface SourceCandidatesDto {
  jobId: string;
  data: SourceCandidateDto[];
  state: HandoverJobState;
}

export interface EvidenceReceiptDto {
  id: string;
  handoverId: string;
  itemId: string;
  revisionId: string;
  submittedBy: string;
  assignmentVersion: number;
  review: "PENDING" | "ACCEPTED" | "CHANGES_REQUESTED";
  createdAt: string;
}

export interface ItemEvidenceDetailDto extends EvidenceReceiptDto {
  contentVersion: number;
  resultText: string;
  links: string[];
  reviewNote: string | null;
}

export interface ItemEvidenceListDto {
  data: ItemEvidenceDetailDto[];
}

export interface FollowUpDto {
  id: string;
  handoverId: string;
  revisionId: string;
  itemId: string;
  ownerUserId: string;
  dueAt: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  version: number;
  resolvedAt: string | null;
}

export interface FollowUpListDto {
  data: FollowUpDto[];
  nextCursor: string | null;
}

export interface TaskTransferResultDto {
  taskId: string;
  intentId: string;
  state: TaskTransferChildResultState;
  expectedTaskVersion: number;
  committedTaskVersion: number | null;
  safeErrorCode: string | null;
}

export interface TransferDto {
  id: string;
  handoverId: string;
  revisionId: string;
  successorUserId: string;
  assignmentVersion: number;
  tasks: TaskTransferResultDto[];
  state: TaskTransferAggregateState;
}

export interface TransferListDto {
  data: TransferDto[];
}

export interface AnswerSectionDto {
  text: string;
  citations: CitationDto[];
}

export interface HandoverAnswerDto {
  revisionId: string;
  answerStatus: "ANSWERED" | "INSUFFICIENT_EVIDENCE";
  message: string;
  sections: AnswerSectionDto[];
}

// Command Input Payloads

export interface CreateHandoverDto {
  departingUserId: string;
  assignedLeaderId: string;
  successorUserId: string | null;
  teamId: string | null;
  targetCompletionDate: string;
  title: string;
}

export interface UpdateMetadataDto {
  title?: string;
  targetCompletionDate?: string;
}

export interface SetSuccessorDto {
  successorUserId: string | null;
  reason: string;
}

export interface SetCoordinatorDto {
  assignedLeaderId: string;
  reason: string;
}

export interface DraftRequestDto {
  expectedDraftVersion: number;
  items: DraftItemInputDto[];
  taskIds: string[];
  selectedSources: SourceRefDto[];
}

export interface SourceJobRequestDto {
  query: string;
  expectedDraftVersion: number;
}

export interface GenerateRequestDto {
  expectedDraftVersion: number;
}

export interface RetryJobDto {
  expectedDraftVersion: number;
}

export interface PublishReviewDto {
  itemId: string;
  contentVersion: number;
  decision: PublishReviewDecision;
  impact: PublishImpact;
  reason: string;
}

export interface GapAssignmentDto {
  itemId: string;
  reason: string;
  ownerUserId: string;
  dueAt: string;
}

export interface PublishRequestDto {
  expectedDraftVersion: number;
  reviewNote: string;
  itemReviews: PublishReviewDto[];
  gapAssignments: GapAssignmentDto[];
}

export interface AcceptRequestDto {
  revisionId: string;
}

export interface QuestionRequestDto {
  revisionId: string;
  assignmentVersion: number;
  question: string;
}

export interface AcknowledgeRequestDto {
  revisionId: string;
  contentVersion: number;
  assignmentVersion: number;
  decision: UnderstandingDecision;
  note: string;
}

export interface SubmitEvidenceDto {
  revisionId: string;
  contentVersion: number;
  assignmentVersion: number;
  resultText: string;
  links: string[];
}

export interface ReviewEvidenceDto {
  revisionId: string;
  evidenceId: string;
  outcome: EvidenceReviewOutcome;
  note: string;
}

export interface OptionalExceptionDto {
  revisionId: string;
  contentVersion: number;
  reason: string;
  ownerUserId: string;
  dueAt: string;
}

export interface TransferTaskInputDto {
  taskId: string;
  expectedTaskVersion: number;
}

export interface StartTransferDto {
  revisionId: string;
  assignmentVersion: number;
  tasks: TransferTaskInputDto[];
}

export interface ReconcileTransferDto {
  transferId: string;
}

export interface CompleteRequestDto {
  revisionId: string;
  assignmentVersion: number;
  reviewNote: string;
}

export interface CancelRequestDto {
  reason: string;
}

export interface ResolveFollowUpDto {
  resolutionNote: string;
  references: SourceRefDto[];
}
