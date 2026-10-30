import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import ProjectWorkReportsWorkspace from "./ProjectWorkReportsWorkspace";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("./WorkNotesPageHeader", () => ({
  default: () => <header>Project Work Note navigation</header>,
}));

const api = vi.mocked(apiClient);
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const reportId = "751a2b3c4d5e6f7a8b9c0d21";
const emptyDocumentsPage = {
  data: [],
  pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
};

const report = {
  id: reportId,
  projectId,
  memberId: "851a2b3c4d5e6f7a8b9c0d21",
  memberName: "Jordan Lee",
  frequency: "WEEKLY" as const,
  periodStart: new Date(Date.now() - 86_400_000).toISOString(),
  periodEnd: new Date(Date.now() + 86_400_000).toISOString(),
  dueAt: new Date(Date.now() + 86_400_000).toISOString(),
  status: "DRAFT" as const,
  createdAt: "2026-10-24T09:00:00.000Z",
  updatedAt: "2026-10-24T09:00:00.000Z",
  accomplishments: "Completed the invitation route.",
  approach: "Used an outbox transaction.",
  reason: "Avoid duplicate sends.",
  blockers: "",
  nextSteps: "Add delivery metrics.",
  reviewHistory: [],
  permissions: {
    canCreate: true,
    canEdit: true,
    canSubmit: true,
    canReview: false,
    canConfigure: false,
  },
};

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectWorkReportsWorkspace projectId={projectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.mockReset();
});

it("shows mandatory read-only schedule for a Member and saves the current Periodic Work Report through the Split-View editor", async () => {
  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/work-report-settings")) {
      return {
        projectId,
        actorRole: "MEMBER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: false },
      } as never;
    }
    if (path.includes("/documents?")) {
      return emptyDocumentsPage as never;
    }
    if (path.includes("/work-reports?")) {
      return {
        data: [report],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (
      path === `/capture/projects/${projectId}/work-reports` &&
      options?.method === "POST"
    )
      return report as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  expect(
    await screen.findByText("Mandatory reporting cadence"),
  ).toBeVisible();
  expect(
    await screen.findByRole("heading", { name: "Jordan Lee" }),
  ).toBeVisible();
  expect(
    screen.getByText("Completed the invitation route."),
  ).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Edit report" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-reports`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
});

it("supports all 1-7 day reporting frequencies in the cadence popover and asks a Leader to confirm a schedule change before saving it", async () => {
  api.mockImplementation(async (path, options) => {
    if (
      path.endsWith("/work-report-settings") &&
      options?.method === "PATCH"
    ) {
      return {
        projectId,
        actorRole: "LEADER",
        frequency: "EVERY_3_DAYS",
        effectiveAt: report.periodEnd,
        nextEffectiveAt: report.periodEnd,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
      } as never;
    }
    if (path.endsWith("/work-report-settings")) {
      return {
        projectId,
        actorRole: "LEADER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
      } as never;
    }
    if (path.includes("/documents?")) {
      return emptyDocumentsPage as never;
    }
    if (path.includes("/work-reports?"))
      return {
        data: [],
        pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
      } as never;
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  const cadenceButton = await screen.findByRole("button", {
    name: /Cadence: 7d/i,
  });
  fireEvent.click(cadenceButton);

  const select = (await screen.findByLabelText(
    "Reporting frequency",
  )) as HTMLSelectElement;
  expect(
    Array.from(select.options).map((option) => option.value),
  ).toEqual([
    "DAILY",
    "EVERY_2_DAYS",
    "EVERY_3_DAYS",
    "EVERY_4_DAYS",
    "EVERY_5_DAYS",
    "EVERY_6_DAYS",
    "WEEKLY",
  ]);
  fireEvent.change(select, {
    target: { value: "EVERY_3_DAYS" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Schedule frequency change" }),
  );
  expect(
    await screen.findByRole("group", {
      name: "Confirm reporting schedule change",
    }),
  ).toHaveTextContent(
    "Existing reports and their history will remain unchanged.",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Apply schedule change" }),
  );

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-report-settings`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ frequency: "EVERY_3_DAYS" }),
      }),
    ),
  );
});

it("allows an Organization Manager to switch to the Leader Reports & Schedule tab and configure a separate Leader cadence", async () => {
  api.mockImplementation(async (path, options) => {
    if (
      path === `/capture/projects/${projectId}/work-report-settings` &&
      options?.method === "PATCH"
    ) {
      return {
        projectId,
        scope: "LEADER",
        actorRole: "MANAGER",
        frequency: "EVERY_4_DAYS",
        effectiveAt: report.periodEnd,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
      } as never;
    }
    if (path.includes("/work-report-settings?scope=LEADER")) {
      return {
        projectId,
        scope: "LEADER",
        actorRole: "MANAGER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
      } as never;
    }
    if (path.endsWith("/work-report-settings")) {
      return {
        projectId,
        scope: "MEMBER",
        actorRole: "MANAGER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
        leaderSettings: {
          frequency: "WEEKLY",
          effectiveAt: report.periodStart,
          updatedBy: report.memberId,
          history: [],
          permissions: { canConfigure: true },
        },
      } as never;
    }
    if (path.includes("/documents?")) {
      return emptyDocumentsPage as never;
    }
    if (path.includes("/work-reports?")) {
      return {
        data: [],
        pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();
  const leaderTab = await screen.findByRole("button", {
    name: /Leader Reports & Schedule/i,
  });
  fireEvent.click(leaderTab);

  const cadenceButton = await screen.findByRole("button", {
    name: /Cadence: 7d/i,
  });
  fireEvent.click(cadenceButton);

  expect(
    await screen.findByRole("heading", {
      name: "Project Leader reporting schedule (Manager setting)",
    }),
  ).toBeVisible();

  fireEvent.change(await screen.findByLabelText("Reporting frequency"), {
    target: { value: "EVERY_4_DAYS" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Schedule frequency change" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Apply schedule change" }),
  );

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-report-settings`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ frequency: "EVERY_4_DAYS", scope: "LEADER" }),
      }),
    ),
  );
});

it("never shows the false no-report-obligation alert for a Manager viewing active in-period Draft member reports, separates Draft from Overdue, and switches members in the Split-View roster", async () => {
  const activeDraftInProgress = {
    ...report,
    id: "751a2b3c4d5e6f7a8b9c0d31",
    memberId: "851a2b3c4d5e6f7a8b9c0d31",
    memberName: "Le Hoang Member 1",
    accomplishments: "Implemented OAuth callback handler.",
    permissions: {
      canCreate: false,
      canEdit: false,
      canSubmit: false,
      canReview: false,
      canConfigure: false,
    },
  };
  const unstartedDraft = {
    ...report,
    id: "751a2b3c4d5e6f7a8b9c0d32",
    memberId: "851a2b3c4d5e6f7a8b9c0d32",
    memberName: "Vo Khoa Member 2",
    accomplishments: "",
    approach: "",
    reason: "",
    blockers: "",
    nextSteps: "",
    permissions: {
      canCreate: false,
      canEdit: false,
      canSubmit: false,
      canReview: false,
      canConfigure: false,
    },
  };

  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/work-report-settings")) {
      return {
        projectId,
        scope: "MEMBER",
        actorRole: "MANAGER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: false },
        leaderSettings: {
          frequency: "WEEKLY",
          effectiveAt: report.periodStart,
          updatedBy: report.memberId,
          history: [],
          permissions: { canConfigure: true },
        },
      } as never;
    }
    if (path.includes("/documents?")) {
      return emptyDocumentsPage as never;
    }
    if (path.includes("/work-reports?")) {
      return {
        data: [unstartedDraft, activeDraftInProgress],
        pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();

  expect(
    await screen.findByRole("heading", { name: "Le Hoang Member 1" }),
  ).toBeVisible();
  expect(
    screen.getByText("Implemented OAuth callback handler."),
  ).toBeVisible();

  // Regression check 1: No contradictory "no report obligation" alert when active period reports exist
  expect(
    screen.queryByText(
      "There is no report obligation for the current period in this project.",
    ),
  ).not.toBeInTheDocument();

  // Regression check 2: "Draft / Overdue" merged label is gone; Draft (2) and Overdue (0) are separated
  expect(screen.queryByText(/Draft \/ Overdue/i)).not.toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: /Draft\s+2/i }),
  ).toBeVisible();
  expect(
    screen.getByRole("tab", { name: /Overdue\s+0/i }),
  ).toBeVisible();

  // Unstarted draft is grouped cleanly in the left roster and selectable
  expect(screen.getByText("Not started (1)")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: /Vo Khoa Member 2/i }),
  );
  expect(
    await screen.findByRole("heading", { name: "Vo Khoa Member 2" }),
  ).toBeVisible();
  expect(
    screen.getByText("No report content submitted for this period yet."),
  ).toBeVisible();
});

it("allows a Reviewer to approve a submitted Pending Review report from the Split-View inline review bar", async () => {
  const pendingReviewReport = {
    ...report,
    status: "PENDING_REVIEW" as const,
    permissions: {
      canCreate: false,
      canEdit: false,
      canSubmit: false,
      canReview: true,
      canConfigure: true,
    },
  };

  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/work-report-settings")) {
      return {
        projectId,
        scope: "MEMBER",
        actorRole: "LEADER",
        frequency: "WEEKLY",
        effectiveAt: report.periodStart,
        updatedBy: report.memberId,
        history: [],
        permissions: { canConfigure: true },
      } as never;
    }
    if (path.includes("/documents?")) {
      return emptyDocumentsPage as never;
    }
    if (path.includes("/work-reports?")) {
      return {
        data: [pendingReviewReport],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      } as never;
    }
    if (
      path === `/capture/projects/${projectId}/work-reports/${reportId}/approve` &&
      options?.method === "POST"
    ) {
      return {
        ...pendingReviewReport,
        status: "APPROVED",
        reviewComment: "Clean implementation, verified.",
      } as never;
    }
    throw new Error(
      `Unexpected API request: ${options?.method ?? "GET"} ${path}`,
    );
  });

  mount();

  expect(
    await screen.findByRole("heading", { name: "Jordan Lee" }),
  ).toBeVisible();
  expect(
    screen.queryByText(
      "There is no report obligation for the current period in this project.",
    ),
  ).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Review comment"), {
    target: { value: "Clean implementation, verified." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-reports/${reportId}/approve`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ comment: "Clean implementation, verified." }),
      }),
    ),
  );
});
