import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkItemDetailDialog from "./WorkItemDetailDialog";
import type { WorkItem } from "./work-types";

vi.mock("next-intl", () => ({
  useLocale: () => "de-DE",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/icons", () => ({
  CloseLineIcon: () => null,
  TaskIcon: () => null,
}));

const sampleItemWithSubtasks: WorkItem = {
  id: "work-1",
  key: "KNW-142",
  title: "Rà soát cấu trúc sources trích dẫn",
  type: "TASK",
  assignee: { id: "person-1", name: "Minh Anh", initials: "MA" },
  reporter: { id: "person-2", name: "Thu Hà", initials: "TH" },
  priority: "MEDIUM",
  status: "IN_PROGRESS",
  resolution: "UNRESOLVED",
  createdAt: "2025-12-06T09:00:00.000Z",
  dueDate: null,
  projectName: "Internal Knowledge Hub",
  subtasks: { completed: 1, total: 2 },
  subtaskItems: [
    {
      id: "sub-1",
      key: "KNW-142.1",
      summary: "Thiết kế schema citation",
      done: true,
      status: "DONE",
      priority: "HIGH",
      assignee: { id: "person-1", name: "Minh Anh", initials: "MA" },
      dueDate: "2025-12-10T00:00:00.000Z",
    },
    {
      id: "sub-2",
      key: "KNW-142.2",
      summary: "Viết parser trích dẫn tự động",
      done: false,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignee: { id: "person-2", name: "Thu Hà", initials: "TH" },
      dueDate: "2025-12-14T00:00:00.000Z",
    },
  ],
};

describe("WorkItemDetailDialog", () => {
  it("formats the created date with the active locale", () => {
    const expectedDate = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(sampleItemWithSubtasks.createdAt));

    render(
      <WorkItemDetailDialog item={sampleItemWithSubtasks} onClose={vi.fn()} />,
    );

    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it("renders Jira Subtasks section with progress bar, column configuration, sort/filter options, and row actions", () => {
    const onCloneSubtask = vi.fn();
    const onConvertSubtaskToTask = vi.fn();
    const onReorderSubtask = vi.fn();

    render(
      <WorkItemDetailDialog
        item={sampleItemWithSubtasks}
        onClose={vi.fn()}
        onCloneSubtask={onCloneSubtask}
        onConvertSubtaskToTask={onConvertSubtaskToTask}
        onReorderSubtask={onReorderSubtask}
      />,
    );

    expect(screen.getByText("50% Done")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subtasks section options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configure subtask columns" }),
    ).toBeInTheDocument();

    // Open row context menu for KNW-142.1
    fireEvent.click(
      screen.getByRole("button", { name: "More actions for subtask KNW-142.1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Clone subtask/i }));
    expect(onCloneSubtask).toHaveBeenCalledWith("work-1", "sub-1");
  });

  it("supports drilling into 4th-level Subtask Detail view with breadcrumbs, worklog, and parent actions", () => {
    const onUpdateSubtask = vi.fn();

    render(
      <WorkItemDetailDialog
        item={sampleItemWithSubtasks}
        initialSubtaskId="sub-2"
        onClose={vi.fn()}
        onUpdateSubtask={onUpdateSubtask}
      />,
    );

    // Breadcrumb shows subtask key and summary
    expect(screen.getByText("KNW-142.2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Viết parser trích dẫn tự động" }),
    ).toBeInTheDocument();

    // Switch to Work log tab in subtask detail view
    fireEvent.click(screen.getByRole("button", { name: "Work log" }));
    expect(
      screen.getByRole("button", { name: "+ Log subtask work" }),
    ).toBeInTheDocument();
  });
});
