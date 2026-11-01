import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import WorkReportReminderNotice from "./WorkReportReminderNotice";

const state = vi.hoisted(() => ({
  userId: "user-1",
  denied: false,
  second: false,
  mutate: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: { id: state.userId, organizationId: "org-1" },
    error: null,
  }),
}));
vi.mock("@/lib/queries/notifications/useNotifications", () => ({
  useNotificationsQuery: () => ({
    isError: state.denied,
    data: {
      items: [
        ...(state.second
          ? [
              {
                id: "stale-notice",
                recipientId: "user-1",
                organizationId: "org-1",
                type: "WORK_REPORT_DEADLINE_APPROACHING",
                readAt: null,
                target: {
                  projectId: "stale-project",
                  reportId: "stale-report",
                  url: "/projects/stale-project/work-reports",
                },
              },
            ]
          : []),
        {
          id: "notice-1",
          recipientId: "user-1",
          organizationId: "org-1",
          type: "WORK_REPORT_DEADLINE_APPROACHING",
          readAt: null,
          target: {
            projectId: "project-1",
            reportId: "report-1",
            url: "/projects/project-1/work-reports",
          },
        },
      ],
    },
  }),
  useMarkNotificationReadMutation: () => ({ mutate: state.mutate }),
}));
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkReportReminderNotice visible />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.userId = "user-1";
  state.denied = false;
  state.second = false;
});
it("shows a persisted reminder after reopening, links the project and dismisses it", async () => {
  vi.mocked(apiClient).mockResolvedValue({
    status: "DRAFT",
    dueAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
  });
  mount();
  expect(await screen.findByText("Your Work Report is due soon")).toBeVisible();
  expect(screen.getByText(/due in 2 hours/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Open Work Reports" }),
  ).toHaveAttribute("href", "/projects/project-1/work-reports");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss reminder" }));
  expect(state.mutate).toHaveBeenCalledWith("notice-1");
  expect(
    screen.queryByText("Your Work Report is due soon"),
  ).not.toBeInTheDocument();
});
it.each(["PENDING_REVIEW", "APPROVED", "REJECTED"])(
  "suppresses a reminder after the report becomes %s",
  async (status) => {
    vi.mocked(apiClient).mockResolvedValue({
      status,
      dueAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
);
it("suppresses cached notification data for another user or denied access", () => {
  state.userId = "other-user";
  state.denied = true;
  mount();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(apiClient).not.toHaveBeenCalled();
});

it("skips a submitted project's stale reminder to show the next eligible report", async () => {
  state.second = true;
  vi.mocked(apiClient)
    .mockResolvedValueOnce({
      status: "APPROVED",
      dueAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    .mockResolvedValue({
      status: "DRAFT",
      dueAt: new Date(Date.now() + 3600_000).toISOString(),
    });
  mount();
  expect(
    await screen.findByRole("link", { name: "Open Work Reports" }),
  ).toHaveAttribute("href", "/projects/project-1/work-reports");
  expect(apiClient).toHaveBeenCalledTimes(2);
});
