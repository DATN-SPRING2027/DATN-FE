import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import WorkNotesActivityPanel from "./WorkNotesActivityPanel";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@/icons", () => ({
  BookOpenIcon: () => null,
  CheckCircleIcon: () => null,
  EyeIcon: () => null,
  TaskIcon: () => null,
  TimeIcon: () => null,
}));

it("does not report success when there are no weekly reports", () => {
  render(
    <WorkNotesActivityPanel
      notes={[]}
      reports={[]}
      role="LEADER"
      currentUserName="Taylor Example"
      currentUserReportSubmitted={false}
      onMarkViewed={vi.fn()}
      onConvert={vi.fn()}
      onOpenReports={vi.fn()}
    />,
  );

  expect(screen.getByText("workNotes.activity.noReports")).toBeVisible();
  expect(screen.queryByText("workNotes.activity.allReportsSubmitted")).not.toBeInTheDocument();
});
