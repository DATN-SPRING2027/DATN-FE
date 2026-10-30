import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import {
  useAddProjectMember,
  useProjectMemberCandidatesQuery,
  useProjectMembersQuery,
} from "@/lib/queries/projects/useProjectMembers";
import { fetchProjectTasks } from "@/lib/queries/tasks/useTasks";
import * as useHandoversModule from "@/lib/queries/handovers/useHandovers";
import type {
  HandoverDetailDto,
  HandoverResource,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import HandoverDetailWorkspace from "../HandoverDetailWorkspace";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjectMembers", () => ({
  useProjectMembersQuery: vi.fn(),
  useProjectMemberCandidatesQuery: vi.fn(),
  useAddProjectMember: vi.fn(),
}));
vi.mock("@/lib/queries/work-notes/useWorkNotes", () => ({
  workNotesApi: {
    listDocuments: vi.fn().mockResolvedValue({ data: [] }),
    listProjectTaskNotes: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
vi.mock("@/lib/queries/tasks/useTasks", () => ({
  taskKeys: {
    projectList: (projectId: string) => ["tasks", projectId],
  },
  fetchProjectTasks: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock("@/lib/queries/handovers/useHandovers", () => ({
  handoverKeys: {
    project: (projectId: string) => ["handovers", projectId],
  },
  useHandoverDetailQuery: vi.fn(),
  useUpdateHandoverMetadataMutation: vi.fn(),
  useSetHandoverSuccessorMutation: vi.fn(),
  useSetHandoverCoordinatorMutation: vi.fn(),
  useCompleteHandoverMutation: vi.fn(),
  useCancelHandoverMutation: vi.fn(),
  useAcceptHandoverPackageMutation: vi.fn(),
  useAcknowledgeHandoverItemMutation: vi.fn(),
  useHandoverItemEvidenceQuery: vi.fn(),
  useSubmitHandoverEvidenceMutation: vi.fn(),
  useReviewHandoverEvidenceMutation: vi.fn(),
  useAcceptOptionalHandoverGapMutation: vi.fn(),
  useHandoverTransfersQuery: vi.fn(),
  useStartHandoverTaskTransferMutation: vi.fn(),
  useReconcileHandoverTaskTransferMutation: vi.fn(),
  useHandoverFollowUpsQuery: vi.fn(),
  useResolveHandoverFollowUpMutation: vi.fn(),
  useHandoverDraftQuery: vi.fn(),
  useReplaceHandoverDraftMutation: vi.fn(),
  useProposeHandoverSourcesMutation: vi.fn(),
  useGenerateHandoverDraftMutation: vi.fn(),
  useHandoverJobQuery: vi.fn(),
  useHandoverCandidatesQuery: vi.fn(),
  useRetryHandoverJobMutation: vi.fn(),
  usePublishHandoverRevisionMutation: vi.fn(),
  useAskHandoverQuestionMutation: vi.fn(),
}));

const mockedCurrentUser = vi.mocked(useCurrentUserQuery);
const mockedProject = vi.mocked(useProjectQuery);
const mockedMembers = vi.mocked(useProjectMembersQuery);
const mockedCandidates = vi.mocked(useProjectMemberCandidatesQuery);
const mockedAddMember = vi.mocked(useAddProjectMember);

const PROJECT_ID = "69e923c77859fd1c702d4c21";
const HANDOVER_ID = "69e923c77859fd1c702d4d01";

function idleMutation() {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };
}

function makeSummary(
  overrides: Partial<HandoverSummaryDto> = {},
): HandoverSummaryDto {
  return {
    id: HANDOVER_ID,
    projectId: PROJECT_ID,
    teamId: null,
    departingUserId: "user-a",
    assignedLeaderId: "user-d",
    successorUserId: "user-b",
    assignmentVersion: 2,
    title: "Distributed Auth & Token Rotation Handover",
    version: 5,
    status: "OPEN",
    publishedRevisionId: "rev-001",
    draftVersion: 2,
    targetCompletionDate: "2026-11-30T00:00:00.000Z",
    overdue: false,
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T03:00:00.000Z",
    ...overrides,
  };
}

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <HandoverDetailWorkspace
          projectId={PROJECT_ID}
          handoverId={HANDOVER_ID}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("HandoverDetailWorkspace", () => {
  const acceptMutate = vi.fn();
  const ackMutate = vi.fn();
  const reconcileMutate = vi.fn();
  const resolveFollowUpMutate = vi.fn();
  const saveDraftMutate = vi.fn();
  const publishMutate = vi.fn();

  beforeEach(() => {
    acceptMutate.mockReset();
    ackMutate.mockReset();
    reconcileMutate.mockReset();
    resolveFollowUpMutate.mockReset();
    saveDraftMutate.mockReset();
    publishMutate.mockReset();
    vi.mocked(fetchProjectTasks).mockResolvedValue({ items: [] } as never);

    mockedCurrentUser.mockReturnValue({
      data: {
        id: "user-b",
        name: "Binh Successor",
        email: "binh@continuum.local",
        organizationId: "org-1",
        roles: ["MEMBER"],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCurrentUserQuery>);

    mockedProject.mockReturnValue({
      data: {
        id: PROJECT_ID,
        organizationId: "org-1",
        name: "Continuum Core",
        code: "CNTM",
        visibility: "PRIVATE",
        status: "ACTIVE",
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectQuery>);

    mockedMembers.mockReturnValue({
      data: {
        data: [
          {
            id: "m1",
            userId: "user-a",
            projectId: PROJECT_ID,
            role: "MEMBER",
            status: "ACTIVE",
            user: {
              id: "user-a",
              fullName: "An Departing",
              email: "an@continuum.local",
            },
          },
          {
            id: "m2",
            userId: "user-d",
            projectId: PROJECT_ID,
            role: "TEAM_LEADER",
            status: "ACTIVE",
            user: {
              id: "user-d",
              fullName: "Minh Coordinator",
              email: "minh@continuum.local",
            },
          },
          {
            id: "m3",
            userId: "user-b",
            projectId: PROJECT_ID,
            role: "MEMBER",
            status: "ACTIVE",
            user: {
              id: "user-b",
              fullName: "Binh Successor",
              email: "binh@continuum.local",
            },
          },
        ],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectMembersQuery>);

    mockedCandidates.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectMemberCandidatesQuery>);

    mockedAddMember.mockReturnValue({
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAddProjectMember>);

    vi.mocked(
      useHandoversModule.useUpdateHandoverMetadataMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useSetHandoverSuccessorMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useSetHandoverCoordinatorMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(useHandoversModule.useCompleteHandoverMutation).mockReturnValue(
      idleMutation() as never,
    );
    vi.mocked(useHandoversModule.useCancelHandoverMutation).mockReturnValue(
      idleMutation() as never,
    );
    vi.mocked(
      useHandoversModule.useAcceptHandoverPackageMutation,
    ).mockReturnValue({
      mutateAsync: acceptMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(
      useHandoversModule.useAcknowledgeHandoverItemMutation,
    ).mockReturnValue({
      mutateAsync: ackMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useHandoversModule.useHandoverItemEvidenceQuery).mockReturnValue({
      data: { data: [] },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(
      useHandoversModule.useSubmitHandoverEvidenceMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useReviewHandoverEvidenceMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useAcceptOptionalHandoverGapMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(useHandoversModule.useHandoverTransfersQuery).mockReturnValue({
      data: { data: [] },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(
      useHandoversModule.useStartHandoverTaskTransferMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useReconcileHandoverTaskTransferMutation,
    ).mockReturnValue({
      mutateAsync: reconcileMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useHandoversModule.useHandoverFollowUpsQuery).mockReturnValue({
      data: { data: [], nextCursor: null },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(
      useHandoversModule.useResolveHandoverFollowUpMutation,
    ).mockReturnValue({
      mutateAsync: resolveFollowUpMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useHandoversModule.useHandoverDraftQuery).mockReturnValue({
      data: {
        draft: {
          handoverId: HANDOVER_ID,
          draftVersion: 1,
          items: [],
          taskIds: [],
          selectedSources: [],
        },
        etag: `"handover:${HANDOVER_ID}:5"`,
      },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(
      useHandoversModule.useReplaceHandoverDraftMutation,
    ).mockReturnValue({
      mutateAsync: saveDraftMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(
      useHandoversModule.useProposeHandoverSourcesMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(
      useHandoversModule.useGenerateHandoverDraftMutation,
    ).mockReturnValue(idleMutation() as never);
    vi.mocked(useHandoversModule.useHandoverJobQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useHandoversModule.useHandoverCandidatesQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useHandoversModule.useRetryHandoverJobMutation).mockReturnValue(
      idleMutation() as never,
    );
    vi.mocked(
      useHandoversModule.usePublishHandoverRevisionMutation,
    ).mockReturnValue({
      mutateAsync: publishMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(
      useHandoversModule.useAskHandoverQuestionMutation,
    ).mockReturnValue(idleMutation() as never);
  });

  it("shows partial source coverage on successful AI jobs", () => {
    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: {
        detail: {
          handover: makeSummary({ publishedRevisionId: null }),
          capabilities: ["READ", "MANAGE"],
          requiredPendingCount: 0,
          canComplete: false,
          publishedRevision: null,
        },
        etag: '"handover:test:1"',
      },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useHandoversModule.useHandoverJobQuery).mockReturnValue({
      data: {
        id: "job-partial",
        handoverId: HANDOVER_ID,
        kind: "GENERATION",
        state: "SUCCEEDED",
        warnings: ["AI_EVIDENCE_INCOMPLETE"],
      },
      isPending: false,
      isError: false,
    } as never);
    renderDetail();
    expect(screen.getByText("Partial source coverage.")).toBeVisible();
    expect(
      screen.getByText(/Some source content was skipped or shortened/),
    ).toBeVisible();
  });

  it("shows coverage warnings beside a Q&A answer", async () => {
    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: {
        detail: {
          handover: makeSummary(),
          capabilities: ["READ"],
          requiredPendingCount: 0,
          canComplete: false,
          publishedRevision: { id: "rev-001", items: [] },
        },
        etag: '"handover:test:1"',
      },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(
      useHandoversModule.useAskHandoverQuestionMutation,
    ).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({
        data: {
          answerStatus: "ANSWERED",
          message: "Grounded answer",
          revisionId: "rev-001",
          sections: [],
          warnings: ["AI_EVIDENCE_INCOMPLETE"],
        },
      }),
    } as never);
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /cited q&a/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "What should I know?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^ask grounded question$/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("Partial source coverage.")).toBeVisible(),
    );
  });

  it("enforces fail-closed UNAVAILABLE item placeholder while allowing RECEIVE actions on AVAILABLE items", async () => {
    const detail: HandoverDetailDto = {
      handover: makeSummary(),
      capabilities: ["READ", "RECEIVE"],
      requiredPendingCount: 1,
      canComplete: false,
      publishedRevision: {
        id: "rev-001",
        handoverId: HANDOVER_ID,
        number: 1,
        publishedAt: "2026-10-28T03:00:00.000Z",
        publishedBy: "user-d",
        isCurrent: true,
        items: [
          {
            itemId: "item-avail-01",
            access: "AVAILABLE",
            contentVersion: 1,
            title: "JWT Signing Key Rotation Procedure",
            body: "Rotate keys monthly via Vault transit engine and verify JWKS propagation.",
            isRequired: true,
            evidenceRequired: false,
            requirement: "Verify JWKS cache refresh in staging.",
            sources: [
              { kind: "PROJECT_DOCUMENT", id: "doc-101", version: "3" },
            ],
            citations: [
              {
                source: {
                  kind: "PROJECT_DOCUMENT",
                  id: "doc-101",
                  version: "3",
                },
                locator: { kind: "SECTION", value: "Key Rotation" },
              },
            ],
            contentReview: "CONTENT_APPROVED",
            acknowledgement: "PENDING",
            evidenceReview: "NOT_REQUIRED",
            optionalExceptionAccepted: false,
            sourceState: "CHANGED",
          },
          {
            itemId: "item-secret-99",
            access: "UNAVAILABLE",
          },
        ],
      },
    };

    const resource: HandoverResource = {
      detail,
      etag: `"handover:${HANDOVER_ID}:5"`,
    };

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: resource,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    acceptMutate.mockResolvedValueOnce({});
    ackMutate.mockResolvedValueOnce({});

    renderDetail();

    expect(
      screen.getByText("JWT Signing Key Rotation Procedure"),
    ).toBeVisible();
    expect(
      screen.getByText(/source updated since snapshot/i),
    ).toBeInTheDocument();

    const unavailableCard = screen.getByTestId(
      "unavailable-item-item-secret-99",
    );
    expect(unavailableCard).toBeVisible();
    expect(unavailableCard).toHaveTextContent(/restricted handover item/i);

    const acceptButton = screen.getByRole("button", {
      name: /accept revision #1/i,
    });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(acceptMutate).toHaveBeenCalledWith({
        etag: `"handover:${HANDOVER_ID}:5"`,
        input: { revisionId: "rev-001" },
      });
    });

    const confirmButton = screen.getByRole("button", {
      name: /confirm understood/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(ackMutate).toHaveBeenCalledWith({
        itemId: "item-avail-01",
        etag: `"handover:${HANDOVER_ID}:5"`,
        input: expect.objectContaining({
          revisionId: "rev-001",
          contentVersion: 1,
          assignmentVersion: 2,
          decision: "UNDERSTOOD",
        }),
      });
    });
  });

  it("displays unresolved transfer fence warning banner on UNKNOWN batch and triggers reconciliation", async () => {
    const resource: HandoverResource = {
      detail: {
        handover: makeSummary(),
        capabilities: ["READ", "MANAGE", "TRANSFER"],
        requiredPendingCount: 0,
        canComplete: false,
        publishedRevision: {
          id: "rev-001",
          handoverId: HANDOVER_ID,
          number: 1,
          publishedAt: "2026-10-28T03:00:00.000Z",
          publishedBy: "user-d",
          isCurrent: true,
          items: [],
        },
      },
      etag: `"handover:${HANDOVER_ID}:5"`,
    };

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: resource,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(useHandoversModule.useHandoverTransfersQuery).mockReturnValue({
      data: {
        data: [
          {
            id: "tr-batch-01",
            handoverId: HANDOVER_ID,
            revisionId: "rev-001",
            successorUserId: "user-b",
            assignmentVersion: 2,
            state: "UNKNOWN",
            tasks: [
              {
                taskId: "task-77",
                intentId: "intent-77",
                state: "UNKNOWN",
                expectedTaskVersion: 3,
                committedTaskVersion: null,
                safeErrorCode: "TASK_TIMEOUT",
              },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
    } as never);

    reconcileMutate.mockResolvedValueOnce({});

    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /task transfers/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unresolved task transfer fence active/i,
    );

    const reconcileBtn = screen.getByRole("button", {
      name: /reconcile status/i,
    });
    fireEvent.click(reconcileBtn);

    await waitFor(() => {
      expect(reconcileMutate).toHaveBeenCalledWith({
        transferId: "tr-batch-01",
        etag: `"handover:${HANDOVER_ID}:5"`,
        input: { transferId: "tr-batch-01" },
      });
    });
  });

  it("resolves post-completion follow-up with independent follow-up ETag", async () => {
    const resource: HandoverResource = {
      detail: {
        handover: makeSummary({ status: "COMPLETED" }),
        capabilities: ["READ", "FOLLOW_UP"],
        requiredPendingCount: 0,
        canComplete: false,
        publishedRevision: {
          id: "rev-001",
          handoverId: HANDOVER_ID,
          number: 1,
          publishedAt: "2026-10-28T03:00:00.000Z",
          publishedBy: "user-d",
          isCurrent: true,
          items: [],
        },
      },
      etag: `"handover:${HANDOVER_ID}:6"`,
    };

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: resource,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(useHandoversModule.useHandoverFollowUpsQuery).mockReturnValue({
      data: {
        data: [
          {
            id: "fu-88",
            handoverId: HANDOVER_ID,
            revisionId: "rev-001",
            itemId: "item-opt-2",
            ownerUserId: "user-b",
            dueAt: "2026-12-05T00:00:00.000Z",
            reason: "Archive legacy Grafana alert dashboard",
            status: "OPEN",
            version: 1,
            resolvedAt: null,
          },
        ],
        nextCursor: null,
      },
      isPending: false,
      isError: false,
    } as never);

    resolveFollowUpMutate.mockResolvedValueOnce({});

    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /follow-ups/i }));
    expect(
      screen.getByText("Archive legacy Grafana alert dashboard"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /resolve follow-up/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/describe how the knowledge gap was closed/i),
      {
        target: {
          value: "Legacy dashboard archived and documented in runbook v4.",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /mark resolved/i }));

    await waitFor(() => {
      expect(resolveFollowUpMutate).toHaveBeenCalledWith({
        followupId: "fu-88",
        followupEtag: '"handover-followup:fu-88:1"',
        input: {
          resolutionNote:
            "Legacy dashboard archived and documented in runbook v4.",
          references: [],
        },
      });
    });
  });

  it("uses server draft contentVersion when publishing after multiple draft saves instead of published + 1 (F07)", async () => {
    const srcDoc = {
      kind: "PROJECT_DOCUMENT" as const,
      id: "69e923c77859fd1c702d4f01",
      version: "2",
    };

    const resource: HandoverResource = {
      detail: {
        handover: makeSummary({ draftVersion: 4 }),
        capabilities: ["READ", "MANAGE"],
        requiredPendingCount: 1,
        canComplete: false,
        publishedRevision: {
          id: "rev-001",
          handoverId: HANDOVER_ID,
          number: 1,
          publishedAt: "2026-10-28T03:00:00.000Z",
          publishedBy: "user-d",
          isCurrent: true,
          items: [
            {
              itemId: "item-edited-twice",
              access: "AVAILABLE",
              contentVersion: 1,
              title: "Canary Rollout Gate",
              body: "Old v1 body.",
              isRequired: true,
              evidenceRequired: false,
              requirement: "Confirm v1 gate.",
              sources: [srcDoc],
              citations: [
                {
                  source: srcDoc,
                  locator: { kind: "SECTION", value: "Rollout" },
                },
              ],
              contentReview: "CONTENT_APPROVED",
              acknowledgement: "UNDERSTOOD",
              evidenceReview: "NOT_REQUIRED",
              optionalExceptionAccepted: false,
              sourceState: "CURRENT",
            },
          ],
        },
      },
      etag: `"handover:${HANDOVER_ID}:7"`,
    };

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: resource,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(useHandoversModule.useHandoverDraftQuery).mockReturnValue({
      data: {
        draft: {
          handoverId: HANDOVER_ID,
          draftVersion: 4,
          selectedSources: [srcDoc],
          taskIds: [],
          items: [
            {
              itemId: "item-edited-twice",
              contentVersion: 3,
              title: "Canary Rollout Gate (v3)",
              body: "Edited twice in draft -> server contentVersion is 3.",
              isRequired: true,
              evidenceRequired: false,
              requirement: "Confirm updated v3 canary rollback drill.",
              sources: [srcDoc],
              citations: [
                {
                  source: srcDoc,
                  locator: { kind: "CHUNK", value: "chunk-99a" },
                },
              ],
            },
          ],
        },
        etag: `"handover:${HANDOVER_ID}:7"`,
      },
      isPending: false,
      isError: false,
    } as never);

    publishMutate.mockResolvedValueOnce({
      data: { revisionId: "rev-002" },
    });

    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /draft & ai assist/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /review & publish revision/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /publish snapshot/i }));

    await waitFor(() => {
      expect(publishMutate).toHaveBeenCalledWith({
        etag: `"handover:${HANDOVER_ID}:7"`,
        input: expect.objectContaining({
          expectedDraftVersion: 4,
          itemReviews: [
            expect.objectContaining({
              itemId: "item-edited-twice",
              contentVersion: 3,
              impact: "CHANGED",
              decision: "CONTENT_APPROVED",
            }),
          ],
        }),
      });
    });
  });

  it("preserves CHUNK/PAGE/LINE multi-locator citations when saving draft and blocks empty locator on newly linked sources (F08)", async () => {
    const srcDoc = {
      kind: "PROJECT_DOCUMENT" as const,
      id: "69e923c77859fd1c702d4f11",
      version: "3",
    };
    const srcKo = {
      kind: "KNOWLEDGE_OBJECT" as const,
      id: "69e923c77859fd1c702d4f22",
      version: "1",
    };
    const srcReport = {
      kind: "WORK_REPORT" as const,
      id: "69e923c77859fd1c702d4f33",
      version: "2",
    };

    const originalCitations = [
      {
        source: srcDoc,
        locator: { kind: "CHUNK" as const, value: "chunk-uuid-42" },
      },
      {
        source: srcDoc,
        locator: { kind: "PAGE" as const, value: "14" },
      },
      {
        source: srcKo,
        locator: { kind: "LINE" as const, value: "88-104" },
      },
    ];

    const resource: HandoverResource = {
      detail: {
        handover: makeSummary({ publishedRevisionId: null, draftVersion: 2 }),
        capabilities: ["READ", "MANAGE"],
        requiredPendingCount: 0,
        canComplete: false,
        publishedRevision: null,
      },
      etag: `"handover:${HANDOVER_ID}:8"`,
    };

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: resource,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(useHandoversModule.useHandoverDraftQuery).mockReturnValue({
      data: {
        draft: {
          handoverId: HANDOVER_ID,
          draftVersion: 2,
          selectedSources: [srcDoc, srcKo, srcReport],
          taskIds: [],
          items: [
            {
              itemId: "item-ai-provenance",
              contentVersion: 2,
              title: "Outbox Idempotency Fence",
              body: "Ensure outbox deduplication keys match task operation IDs.",
              isRequired: true,
              evidenceRequired: true,
              requirement: "Demonstrate duplicate delivery handling.",
              sources: [srcDoc, srcKo],
              citations: originalCitations,
            },
          ],
        },
        etag: `"handover:${HANDOVER_ID}:8"`,
      },
      isPending: false,
      isError: false,
    } as never);

    saveDraftMutate.mockResolvedValue({
      data: { version: 9 },
    });

    renderDetail();

    // publishedRevision is null + MANAGE capability -> opens Draft tab automatically (or click tab)
    fireEvent.click(screen.getByRole("button", { name: /draft & ai assist/i }));

    // Toggle ONLY the Required checkbox without touching citations
    const requiredCheckbox = screen.getByLabelText(
      /required \/ critical \(blocks completion\)/i,
    );
    fireEvent.click(requiredCheckbox);

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(saveDraftMutate).toHaveBeenCalledTimes(1);
    });

    expect(saveDraftMutate).toHaveBeenCalledWith({
      etag: `"handover:${HANDOVER_ID}:8"`,
      input: {
        expectedDraftVersion: 2,
        selectedSources: [srcDoc, srcKo, srcReport],
        taskIds: [],
        items: [
          {
            itemId: "item-ai-provenance",
            title: "Outbox Idempotency Fence",
            body: "Ensure outbox deduplication keys match task operation IDs.",
            requirement: "Demonstrate duplicate delivery handling.",
            isRequired: false,
            evidenceRequired: true,
            sources: [srcDoc, srcKo],
            citations: originalCitations,
          },
        ],
      },
    });

    // Now link the 3rd source (srcReport) -> must NOT fabricate a fake locator; saving without locator fails validation
    const reportCheckbox = screen.getByLabelText(/WORK_REPORT:69e923…4f33/i);
    fireEvent.click(reportCheckbox);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /provide a non-empty citation locator for every linked official source/i,
    );
    expect(saveDraftMutate).toHaveBeenCalledTimes(1);

    // Fill concrete locator for citation #4 and save -> all 4 citations preserved accurately
    fireEvent.change(screen.getByLabelText("Citation 4 locator kind"), {
      target: { value: "SECTION" },
    });
    fireEvent.change(screen.getByLabelText("Citation 4 locator value"), {
      target: { value: "Weekly Incident Summary" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(saveDraftMutate).toHaveBeenCalledTimes(2);
    });
    expect(saveDraftMutate).toHaveBeenNthCalledWith(2, {
      etag: `"handover:${HANDOVER_ID}:8"`,
      input: expect.objectContaining({
        items: [
          expect.objectContaining({
            sources: [srcDoc, srcKo, srcReport],
            citations: [
              ...originalCitations,
              {
                source: srcReport,
                locator: { kind: "SECTION", value: "Weekly Incident Summary" },
              },
            ],
          }),
        ],
      }),
    });
  });
  it("auto-adds an Organization colleague to the project before saving Successor (B) in Set Successor modal", async () => {
    const callOrder: string[] = [];
    const addMemberMutate = vi.fn().mockImplementation(async (uid: string) => {
      callOrder.push(`addMember:${uid}`);
      return { id: "mem-new", userId: uid, status: "ACTIVE" };
    });
    const setSuccessorMutate = vi.fn().mockImplementation(async () => {
      callOrder.push("setSuccessor");
      return { data: { version: 6 } };
    });

    mockedAddMember.mockReturnValue({
      mutateAsync: addMemberMutate,
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(
      useHandoversModule.useSetHandoverSuccessorMutation,
    ).mockReturnValue({
      mutateAsync: setSuccessorMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    mockedCandidates.mockReturnValue({
      data: [
        {
          userId: "org-colleague-77",
          email: "newcomer@continuum.local",
          fullName: "Phuc Org Newcomer",
          avatarUrl: null,
          organizationMembershipStatus: "ACTIVE",
          isProjectMember: false,
        },
      ],
      isPending: false,
      isError: false,
    } as never);

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: {
        detail: {
          handover: makeSummary({ successorUserId: null }),
          capabilities: ["READ", "MANAGE"],
          requiredPendingCount: 0,
          canComplete: false,
          publishedRevision: null,
        },
        etag: `"handover:${HANDOVER_ID}:5"`,
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /set successor \(b\)/i }));

    fireEvent.click(
      screen.getByRole("combobox", { name: /successor recipient \(b\)/i }),
    );
    const listbox = screen.getByRole("listbox");
    const orgOpt = within(listbox).getByRole("option", {
      name: /phuc org newcomer/i,
    });
    expect(orgOpt).toHaveTextContent(/org member · auto-add/i);
    fireEvent.click(orgOpt);

    fireEvent.change(
      screen.getByLabelText(/reason for assignment change/i),
      { target: { value: "Onboarding Phuc from platform org team." } },
    );

    fireEvent.click(screen.getByRole("button", { name: /save successor/i }));

    await waitFor(() => {
      expect(setSuccessorMutate).toHaveBeenCalledTimes(1);
    });

    expect(callOrder).toEqual([
      "addMember:org-colleague-77",
      "setSuccessor",
    ]);
    expect(setSuccessorMutate).toHaveBeenCalledWith({
      etag: `"handover:${HANDOVER_ID}:5"`,
      input: {
        successorUserId: "org-colleague-77",
        reason: "Onboarding Phuc from platform org team.",
      },
    });
  });

  it("tucks destructive Cancel Handover inside the More actions menu and displays viewer role badge", async () => {
    const cancelMutate = vi.fn().mockResolvedValue({ data: { status: "CANCELLED" } });
    vi.mocked(useHandoversModule.useCancelHandoverMutation).mockReturnValue({
      mutateAsync: cancelMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    mockedCurrentUser.mockReturnValue({
      data: {
        id: "user-d",
        name: "Minh Coordinator",
        email: "minh@continuum.local",
        organizationId: "org-1",
        roles: ["TEAM_LEADER"],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCurrentUserQuery>);

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: {
        detail: {
          handover: makeSummary({ publishedRevisionId: null }),
          capabilities: ["READ", "MANAGE", "REVIEW"],
          requiredPendingCount: 0,
          canComplete: false,
          publishedRevision: null,
        },
        etag: `"handover:${HANDOVER_ID}:5"`,
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderDetail();

    expect(screen.getByText(/you · coordinator \(d\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel handover$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /more handover actions/i }),
    );
    const menu = screen.getByRole("menu", { name: /more handover actions/i });
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: /cancel handover/i }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /cancel knowledge handover/i,
    });
    fireEvent.change(within(dialog).getByLabelText(/cancellation reason/i), {
      target: { value: "Transition merged into sprint Q4 consolidation." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /confirm cancellation/i }),
    );

    await waitFor(() => {
      expect(cancelMutate).toHaveBeenCalledWith({
        etag: `"handover:${HANDOVER_ID}:5"`,
        input: { reason: "Transition merged into sprint Q4 consolidation." },
      });
    });
  });

  it("filters Candidate Tasks by Active/Selected/All scopes and search query in Draft & AI Assist", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue({
      items: [
        {
          id: "task-1",
          key: "FE-1",
          title: "Design core handover workspace",
          status: "IN_PROGRESS",
          version: 3,
        },
        {
          id: "task-2",
          key: "FE-2",
          title: "Legacy auth session cleanup",
          status: "DONE",
          version: 2,
        },
        {
          id: "task-3",
          key: "FE-3",
          title: "Telemetry alert thresholds",
          status: "TODO",
          version: 1,
        },
      ],
    } as never);

    vi.mocked(useHandoversModule.useHandoverDetailQuery).mockReturnValue({
      data: {
        detail: {
          handover: makeSummary({ publishedRevisionId: null }),
          capabilities: ["READ", "MANAGE"],
          requiredPendingCount: 0,
          canComplete: false,
          publishedRevision: null,
        },
        etag: `"handover:${HANDOVER_ID}:5"`,
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    vi.mocked(useHandoversModule.useHandoverDraftQuery).mockReturnValue({
      data: {
        draft: {
          draftVersion: 0,
          selectedSources: [],
          taskIds: [],
          items: [],
        },
        etag: `"handover:${HANDOVER_ID}:5"`,
      },
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderDetail();

    expect(
      await screen.findByText(/design core handover workspace/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/telemetry alert thresholds/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/legacy auth session cleanup/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /all \(3\)/i }));
    expect(
      screen.getByText(/legacy auth session cleanup/i),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/filter tasks by key or title/i),
      { target: { value: "FE-3" } },
    );
    expect(
      screen.getByText(/telemetry alert thresholds/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/design core handover workspace/i),
    ).not.toBeInTheDocument();
  });
});
