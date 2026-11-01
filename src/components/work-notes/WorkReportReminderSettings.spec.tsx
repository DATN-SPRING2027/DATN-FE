import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import WorkReportReminderSettings from "./WorkReportReminderSettings";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
function mount(canConfigure = true) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkReportReminderSettings
          projectId="project-1"
          scope="LEADER"
          leadMinutes={null}
          canConfigure={canConfigure}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());
it("saves per-tier email/bot lead time without changing cadence", async () => {
  vi.mocked(apiClient).mockResolvedValue({ reminderLeadMinutes: 2880 });
  mount();
  fireEvent.change(screen.getByLabelText("Remind before deadline"), {
    target: { value: "2880" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
  await waitFor(() =>
    expect(apiClient).toHaveBeenCalledWith(
      "/capture/projects/project-1/work-report-settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ reminderLeadMinutes: 2880, scope: "LEADER" }),
      }),
    ),
  );
  expect(await screen.findByText("Reminder saved.")).toBeInTheDocument();
});
it("keeps a failed selection available for retry", async () => {
  vi.mocked(apiClient).mockRejectedValue(new Error("Offline"));
  mount();
  fireEvent.change(screen.getByLabelText("Remind before deadline"), {
    target: { value: "120" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByLabelText("Remind before deadline")).toHaveValue("120");
});
it("shows a read-only value when configuration permission is denied", () => {
  mount(false);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
