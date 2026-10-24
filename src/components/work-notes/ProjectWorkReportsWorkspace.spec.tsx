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

it("shows mandatory read-only schedule for a Member and saves the current Periodic Work Report through the API", async () => {
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
      return {
        data: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
      } as never;
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
    await screen.findByRole("heading", { name: "Your current period" }),
  ).toBeVisible();
  expect(
    await screen.findByText("Mandatory reporting cadence"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      `/capture/projects/${projectId}/work-reports`,
      expect.objectContaining({ method: "POST" }),
    ),
  );
});

it("supports all 1-7 day reporting frequencies and asks a Leader to confirm a schedule change before saving it", async () => {
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
