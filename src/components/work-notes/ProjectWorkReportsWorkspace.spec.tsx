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
  permissions: { canCreate: true, canEdit: true, canSubmit: true, canReview: false, canConfigure: false },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

it("shows and saves the current Periodic Work Report through the API", async () => {
  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/work-report-settings")) {
      return { projectId, frequency: "WEEKLY", effectiveAt: report.periodStart, updatedBy: report.memberId, history: [], permissions: { canConfigure: false } } as never;
    }
    if (path.includes("/work-reports?")) {
      return { data: [report], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } } as never;
    }
    if (path === `/capture/projects/${projectId}/work-reports` && options?.method === "POST") return report as never;
    throw new Error(`Unexpected API request: ${options?.method ?? "GET"} ${path}`);
  });

  mount();
  expect(await screen.findByRole("heading", { name: "Your current period" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

  await waitFor(() => expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/work-reports`,
    expect.objectContaining({ method: "POST" }),
  ));
});

it("asks a Leader to confirm a supported schedule change before saving it", async () => {
  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/work-report-settings") && options?.method === "PATCH") {
      return { projectId, frequency: "EVERY_3_DAYS", effectiveAt: report.periodEnd, nextEffectiveAt: report.periodEnd, updatedBy: report.memberId, history: [], permissions: { canConfigure: true } } as never;
    }
    if (path.endsWith("/work-report-settings")) {
      return { projectId, frequency: "WEEKLY", effectiveAt: report.periodStart, updatedBy: report.memberId, history: [], permissions: { canConfigure: true } } as never;
    }
    if (path.includes("/work-reports?")) return { data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } } as never;
    throw new Error(`Unexpected API request: ${options?.method ?? "GET"} ${path}`);
  });

  mount();
  fireEvent.change(await screen.findByLabelText("Reporting frequency"), { target: { value: "EVERY_3_DAYS" } });
  fireEvent.click(screen.getByRole("button", { name: "Schedule frequency change" }));
  expect(await screen.findByRole("group", { name: "Confirm reporting schedule change" })).toHaveTextContent("Existing reports and their history will remain unchanged.");
  fireEvent.click(screen.getByRole("button", { name: "Apply schedule change" }));

  await waitFor(() => expect(api).toHaveBeenCalledWith(
    `/capture/projects/${projectId}/work-report-settings`,
    expect.objectContaining({ method: "PATCH", body: JSON.stringify({ frequency: "EVERY_3_DAYS" }) }),
  ));
});
