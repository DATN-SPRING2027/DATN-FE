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
vi.mock("@/components/work-notes/TaskNotesPanel", () => ({
  default: ({ projectId, taskId }: { projectId: string; taskId: string }) => (
    <div data-testid="subtask-notes-panel">{`${projectId}:${taskId}`}</div>
  ),
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
  it("keeps separately authorized comments and worklogs available when Task fields are read-only", () => {
    const comment = vi.fn();
    const worklog = vi.fn();
    render(<WorkItemDetailDialog item={{ ...sampleItemWithSubtasks, readOnly: true }} onClose={vi.fn()} onAddComment={comment} onAddWorklog={worklog} />);
    fireEvent.change(screen.getByPlaceholderText("Add a comment…"), { target: { value: "A scoped collaboration comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(comment).toHaveBeenCalledWith("work-1", "A scoped collaboration comment");
    fireEvent.click(screen.getByRole("button", { name: "Work log" }));
    fireEvent.change(screen.getByPlaceholderText("Time spent (e.g. 1h 30m)"), { target: { value: "30m" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Log work" }));
    expect(worklog).toHaveBeenCalledWith("work-1", "30m", "");
  });

  it("hides subtask creation on a read-only Task", () => {
    render(<WorkItemDetailDialog item={{ ...sampleItemWithSubtasks, readOnly: true }} onClose={vi.fn()} onAddSubtask={vi.fn()} />);
    expect(screen.queryAllByRole("button", { name: /Add subtask/i })).toHaveLength(0);
  });

  it("disables metadata edits for a read-only Task while keeping its details readable", () => {
    render(<WorkItemDetailDialog item={{ ...sampleItemWithSubtasks, readOnly: true }} onClose={vi.fn()} onDueDateChange={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Due date for KNW-142" })).toBeDisabled();
    expect(screen.getByText(sampleItemWithSubtasks.title)).toBeVisible();
  });

  it("does not allow a Member to complete or edit another actor's Subtask", () => {
    const change = vi.fn();
    render(<WorkItemDetailDialog item={{ ...sampleItemWithSubtasks, subtaskItems: sampleItemWithSubtasks.subtaskItems?.map((sub) => ({ ...sub, readOnly: true })) }} initialSubtaskId="sub-2" onClose={vi.fn()} onToggleSubtask={change} onUpdateSubtask={change} />);
    const complete = screen.getByRole("button", { name: "Mark subtask done" });
    expect(complete).toBeDisabled();
    fireEvent.click(complete);
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Priority for KNW-142.2")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Assignee for KNW-142.2")).not.toBeInTheDocument();
  });

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
        projectId="651a2b3c4d5e6f7a8b9c0d21"
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

    // Switch to Task Notes tab in subtask detail view
    fireEvent.click(screen.getByRole("button", { name: "title" }));
    expect(screen.getByTestId("subtask-notes-panel")).toHaveTextContent(
      "651a2b3c4d5e6f7a8b9c0d21:sub-2",
    );
  });

  it("allows editing Task title and description when mutable callbacks are provided, validates empty title, and cancels on Escape without closing the modal", async () => {
    const onClose = vi.fn();
    const onTitleChange = vi.fn().mockResolvedValue(true);
    const onDescriptionChange = vi.fn().mockResolvedValue(true);

    render(
      <WorkItemDetailDialog
        item={{ ...sampleItemWithSubtasks, description: "Initial spec" }}
        onClose={onClose}
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit work item title" }),
    );
    const titleInput = screen.getByRole("textbox", {
      name: "Edit work item title",
    });
    expect(titleInput).toHaveValue(sampleItemWithSubtasks.title);

    fireEvent.change(titleInput, { target: { value: "   " } });
    fireEvent.submit(titleInput.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("titleRequired");
    expect(onTitleChange).not.toHaveBeenCalled();

    fireEvent.change(titleInput, {
      target: { value: "Draft cancelled via Escape" },
    });
    fireEvent.keyDown(titleInput, { key: "Escape" });
    expect(
      screen.queryByRole("textbox", { name: "Edit work item title" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("heading", { name: sampleItemWithSubtasks.title }),
    );
    const reopenedTitleInput = screen.getByRole("textbox", {
      name: "Edit work item title",
    });
    fireEvent.change(reopenedTitleInput, {
      target: { value: "Rà soát cấu trúc citations tiếng Việt" },
    });
    fireEvent.submit(reopenedTitleInput.closest("form")!);
    expect(onTitleChange).toHaveBeenCalledWith(
      "work-1",
      "Rà soát cấu trúc citations tiếng Việt",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit work item description" }),
    );
    const descInput = screen.getByRole("textbox", {
      name: "Edit work item description",
    });
    expect(descInput).toHaveValue("Initial spec");
    fireEvent.change(descInput, {
      target: { value: "Updated architecture & acceptance criteria" },
    });
    fireEvent.submit(descInput.closest("form")!);
    expect(onDescriptionChange).toHaveBeenCalledWith(
      "work-1",
      "Updated architecture & acceptance criteria",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit work item description" }),
    );
    const clearDescInput = screen.getByRole("textbox", {
      name: "Edit work item description",
    });
    fireEvent.change(clearDescInput, { target: { value: "   " } });
    fireEvent.submit(clearDescInput.closest("form")!);
    expect(onDescriptionChange).toHaveBeenCalledWith("work-1", null);
  });

  it("blocks Task title and description editing when item.readOnly is true", () => {
    const onTitleChange = vi.fn();
    const onDescriptionChange = vi.fn();

    render(
      <WorkItemDetailDialog
        item={{
          ...sampleItemWithSubtasks,
          readOnly: true,
          description: "Locked spec",
        }}
        onClose={vi.fn()}
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit work item title" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit work item description" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(sampleItemWithSubtasks.title));
    fireEvent.click(screen.getByText("Locked spec"));

    expect(
      screen.queryByRole("textbox", { name: "Edit work item title" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Edit work item description" }),
    ).not.toBeInTheDocument();
    expect(onTitleChange).not.toHaveBeenCalled();
    expect(onDescriptionChange).not.toHaveBeenCalled();
  });
});
