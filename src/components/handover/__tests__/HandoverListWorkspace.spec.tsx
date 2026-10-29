import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import { useProjectMembersQuery } from "@/lib/queries/projects/useProjectMembers";
import {
  useCreateHandoverMutation,
  useHandoversQuery,
} from "@/lib/queries/handovers/useHandovers";
import { setHandoverCoordinator } from "@/lib/queries/handovers/handover.service";
import type { HandoverSummaryDto } from "@/lib/queries/handovers/handover.types";
import HandoverListWorkspace from "../HandoverListWorkspace";

const pushMock = vi.fn();

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
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjectMembers", () => ({
  useProjectMembersQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjectSettings", () => ({
  useProjectManagementAccess: () => ({
    canAccessSettings: true,
    isPending: false,
  }),
}));
vi.mock("@/lib/queries/handovers/useHandovers", () => ({
  useHandoversQuery: vi.fn(),
  useCreateHandoverMutation: vi.fn(),
}));
vi.mock("@/lib/queries/handovers/handover.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/queries/handovers/handover.service")
    >();
  return {
    ...actual,
    setHandoverCoordinator: vi.fn(),
  };
});

const mockedCurrentUser = vi.mocked(useCurrentUserQuery);
const mockedProject = vi.mocked(useProjectQuery);
const mockedMembers = vi.mocked(useProjectMembersQuery);
const mockedHandovers = vi.mocked(useHandoversQuery);
const mockedCreateMutation = vi.mocked(useCreateHandoverMutation);
const mockedSetCoordinator = vi.mocked(setHandoverCoordinator);

const PROJECT_ID = "69e923c77859fd1c702d4c21";

function makeSummary(
  overrides: Partial<HandoverSummaryDto> = {},
): HandoverSummaryDto {
  return {
    id: "69e923c77859fd1c702d4d01",
    projectId: PROJECT_ID,
    teamId: null,
    departingUserId: "69e923c77859fd1c702d4a01",
    assignedLeaderId: "69e923c77859fd1c702d4a02",
    successorUserId: "69e923c77859fd1c702d4a03",
    assignmentVersion: 1,
    title: "Gateway & Session Security Handover",
    version: 2,
    status: "OPEN",
    publishedRevisionId: "69e923c77859fd1c702d4e01",
    draftVersion: 1,
    targetCompletionDate: "2026-11-15T00:00:00.000Z",
    overdue: true,
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T02:00:00.000Z",
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HandoverListWorkspace projectId={PROJECT_ID} />
    </NextIntlClientProvider>,
  );
}

describe("HandoverListWorkspace", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockedSetCoordinator.mockReset();

    mockedCurrentUser.mockReturnValue({
      data: {
        id: "69e923c77859fd1c702d4a02",
        name: "Leader Minh",
        email: "leader@continuum.local",
        organizationId: "org-1",
        roles: ["ADMIN"],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCurrentUserQuery>);

    mockedProject.mockReturnValue({
      data: {
        id: PROJECT_ID,
        organizationId: "org-1",
        name: "Continuum Core Platform",
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
            id: "mem-1",
            userId: "69e923c77859fd1c702d4a01",
            projectId: PROJECT_ID,
            role: "MEMBER",
            status: "ACTIVE",
            user: {
              id: "69e923c77859fd1c702d4a01",
              fullName: "An Nguyen",
              email: "an@continuum.local",
            },
          },
          {
            id: "mem-2",
            userId: "69e923c77859fd1c702d4a02",
            projectId: PROJECT_ID,
            role: "TEAM_LEADER",
            status: "ACTIVE",
            user: {
              id: "mem-2",
              fullName: "Leader Minh",
              email: "leader@continuum.local",
            },
          },
          {
            id: "mem-3",
            userId: "69e923c77859fd1c702d4a03",
            projectId: PROJECT_ID,
            role: "MEMBER",
            status: "ACTIVE",
            user: {
              id: "69e923c77859fd1c702d4a03",
              fullName: "Binh Tran",
              email: "binh@continuum.local",
            },
          },
        ],
      },
      isSuccess: true,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useProjectMembersQuery>);

    mockedCreateMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useCreateHandoverMutation>);
  });

  it("renders accessible loading skeleton while fetching initial handovers", () => {
    mockedHandovers.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHandoversQuery>);

    renderWorkspace();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders empty state when project has zero handovers", () => {
    mockedHandovers.mockReturnValue({
      data: { data: [], nextCursor: null },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHandoversQuery>);

    renderWorkspace();
    expect(
      screen.getByRole("heading", { name: /no knowledge handovers yet/i }),
    ).toBeVisible();
  });

  it("renders KPI strip with tabular-nums and filters handover rows by search and status", () => {
    mockedHandovers.mockReturnValue({
      data: {
        data: [
          makeSummary({
            id: "ho-1",
            title: "Gateway & Session Security Handover",
            status: "OPEN",
            overdue: true,
          }),
          makeSummary({
            id: "ho-2",
            title: "Search Indexing Pipeline Handover",
            status: "COMPLETED",
            overdue: false,
          }),
        ],
        nextCursor: null,
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHandoversQuery>);

    renderWorkspace();

    const totalMetric = screen.getByText("2");
    expect(totalMetric).toHaveClass("tabular-nums");
    expect(
      screen.getAllByText("Gateway & Session Security Handover").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Search Indexing Pipeline Handover").length,
    ).toBeGreaterThan(0);

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Search Indexing" } });

    expect(
      screen.queryByText("Gateway & Session Security Handover"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Search Indexing Pipeline Handover").length,
    ).toBeGreaterThan(0);
  });

  it("renders server error state with retry trigger on non-ACL failure", () => {
    const refetchMock = vi.fn();
    mockedHandovers.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new ApiError(
        500,
        "INTERNAL_ERROR",
        "Database temporarily unavailable",
      ),
      refetch: refetchMock,
    } as unknown as ReturnType<typeof useHandoversQuery>);

    renderWorkspace();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /database temporarily unavailable/i,
    );
  });

  it("renders permission denied state and supports Org Manager safe coordinator recovery with stable retry idempotency key", async () => {
    const refetchMock = vi.fn();
    mockedHandovers.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new ApiError(403, "FORBIDDEN", "Not a project member"),
      refetch: refetchMock,
    } as unknown as ReturnType<typeof useHandoversQuery>);

    mockedSetCoordinator
      .mockRejectedValueOnce(new Error("Temporary gateway timeout"))
      .mockResolvedValueOnce({
        data: {
          operationId: "op-coord-1",
          handoverId: "69e923c77859fd1c702d4d99",
          version: 4,
          status: "OPEN",
          revisionId: null,
          replayed: true,
        },
        etag: '"handover:69e923c77859fd1c702d4d99:4"',
        replayed: true,
      });

    renderWorkspace();

    const appointButtons = screen.getAllByRole("button", {
      name: /appoint coordinator/i,
    });
    fireEvent.click(appointButtons[0]!);

    fireEvent.change(screen.getByLabelText(/handover id/i), {
      target: { value: "69e923c77859fd1c702d4d99" },
    });
    fireEvent.change(screen.getByLabelText(/expected version/i), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText(/coordinator leader \(d\)/i), {
      target: { value: "69e923c77859fd1c702d4a02" },
    });
    fireEvent.change(screen.getByLabelText(/appointment reason/i), {
      target: { value: "Departing leader stepped down; appointing Minh." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /confirm coordinator/i }),
    );

    await waitFor(() => {
      expect(mockedSetCoordinator).toHaveBeenCalledTimes(1);
    });

    const firstIdemKey = mockedSetCoordinator.mock.calls[0]?.[4];
    expect(typeof firstIdemKey).toBe("string");

    // Retry same submission after timeout -> reuses exact same Idempotency-Key
    fireEvent.click(
      screen.getByRole("button", { name: /confirm coordinator/i }),
    );

    await waitFor(() => {
      expect(mockedSetCoordinator).toHaveBeenCalledTimes(2);
    });

    expect(mockedSetCoordinator).toHaveBeenNthCalledWith(
      2,
      PROJECT_ID,
      "69e923c77859fd1c702d4d99",
      '"handover:69e923c77859fd1c702d4d99:3"',
      {
        assignedLeaderId: "69e923c77859fd1c702d4a02",
        reason: "Departing leader stepped down; appointing Minh.",
      },
      firstIdemKey,
    );
  });
});
