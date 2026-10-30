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
  CloseIcon: () => null,
  TaskIcon: () => null,
}));
vi.mock("@/components/work-notes/TaskNotesPanel", () => ({
  default: ({
    projectId,
    taskId,
    splitControl,
  }: {
    projectId: string;
    taskId: string;
    splitControl?: {
      isOpen: boolean;
      editingNoteId: string | null;
      savedSignal?: number;
      onOpen: (noteId?: string) => void;
      onClose: () => void;
    };
  }) => (
    <div>
      <div data-testid="subtask-notes-panel">{`${projectId}:${taskId}`}</div>
      {splitControl && (
        <div>
          <button type="button" onClick={() => splitControl.onOpen()}>
            Trigger split new note
          </button>
          <button type="button" onClick={() => splitControl.onOpen("note-42")}>
            Trigger split edit note
          </button>
          <span data-testid="split-saved-signal">
            {splitControl.savedSignal ?? 0}
          </span>
        </div>
      )}
    </div>
  ),
}));
vi.mock("@/components/work-notes/WorkNoteComposer", () => ({
  default: ({
    variant,
    taskId,
    noteId,
    onPanelOpenChange,
    onClose,
    onSaved,
  }: {
    variant?: string;
    taskId?: string;
    noteId?: string;
    onPanelOpenChange?: (open: boolean) => void;
    onClose: () => void;
    onSaved: () => void;
  }) => (
    <div data-testid="inline-work-note-composer">
      <span>{`composer:${variant}:${taskId}:${noteId ?? "new"}`}</span>
      <button type="button" onClick={() => onPanelOpenChange?.(true)}>
        Open AI 3rd column
      </button>
      <button type="button" onClick={() => onPanelOpenChange?.(false)}>
        Collapse AI 3rd column
      </button>
      <button type="button" onClick={onSaved}>
        Save split note
      </button>
      <button type="button" onClick={onClose}>
        Close split note
      </button>
    </div>
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

  it("splits into 2 resizable panes (Task | Note) on New/Edit Note and 3 panes (Task | Note | AI) with only the Task-Note divider draggable", () => {
    render(
      <WorkItemDetailDialog
        item={sampleItemWithSubtasks}
        projectId="651a2b3c4d5e6f7a8b9c0d21"
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("work-note-split-workspace"),
    ).not.toBeInTheDocument();

    // Open Notes tab and click New Note -> 2-column split screen (no separate modal)
    fireEvent.click(screen.getByRole("button", { name: "title" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger split new note" }),
    );

    const workspace = screen.getByTestId("work-note-split-workspace");
    const taskPane = screen.getByTestId("work-note-split-task-pane");
    const resizers = screen.getAllByRole("separator");

    expect(resizers).toHaveLength(1);
    expect(resizers[0]).toHaveAttribute("data-testid", "task-note-resizer");
    expect(taskPane.style.getPropertyValue("--task-split-w")).toBe("48%");
    expect(screen.getByTestId("inline-work-note-composer")).toHaveTextContent(
      "composer:inline:work-1:new",
    );

    // Drag the horizontal splitter between Task and Note
    vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 1600,
      height: 900,
      right: 1600,
      bottom: 900,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(resizers[0], { button: 0, pointerId: 1, clientX: 768 });
    fireEvent.pointerMove(resizers[0], { pointerId: 1, clientX: 640 });
    fireEvent.pointerUp(resizers[0], { pointerId: 1, clientX: 640 });
    expect(taskPane.style.getPropertyValue("--task-split-w")).toBe("40%");

    // Open AI Assistant -> 3-column mode (Task auto-compacts to 33%, still only 1 draggable separator)
    fireEvent.click(screen.getByRole("button", { name: "Open AI 3rd column" }));
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(taskPane.style.getPropertyValue("--task-split-w")).toBe("33%");

    // Dragging the Task-Note resizer still works freely in 3-column mode
    fireEvent.keyDown(resizers[0], { key: "ArrowRight" });
    expect(taskPane.style.getPropertyValue("--task-split-w")).toBe("35%");

    // Collapsing AI restores the user's 2-column Task ratio (40%)
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse AI 3rd column" }),
    );
    expect(taskPane.style.getPropertyValue("--task-split-w")).toBe("40%");

    // Saving closes the split workspace and signals TaskNotesPanel
    fireEvent.click(screen.getByRole("button", { name: "Save split note" }));
    expect(
      screen.queryByTestId("work-note-split-workspace"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("split-saved-signal")).toHaveTextContent("1");
  });

  it("allows editing and saving the main Task description via Edit button or click-to-edit, and cancels on Escape without closing the modal", () => {
    const onDescriptionChange = vi.fn();
    const onClose = vi.fn();

    render(
      <WorkItemDetailDialog
        item={{
          ...sampleItemWithSubtasks,
          description: "Initial architecture notes",
        }}
        onClose={onClose}
        onDescriptionChange={onDescriptionChange}
      />,
    );

    // Click Edit button on Description header
    fireEvent.click(screen.getByTestId("edit-task-description"));
    const textarea = screen.getByRole("textbox", { name: "description" });
    expect(textarea).toHaveValue("Initial architecture notes");

    fireEvent.change(textarea, {
      target: { value: "  Updated IAM architecture & RBAC scope  " },
    });
    fireEvent.click(screen.getByTestId("save-task-description"));

    expect(onDescriptionChange).toHaveBeenCalledWith(
      "work-1",
      "Updated IAM architecture & RBAC scope",
    );

    // Click description body directly to enter edit mode, then press Escape -> cancels edit without closing modal
    fireEvent.click(screen.getByText("Initial architecture notes"));
    const reopenedTextarea = screen.getByRole("textbox", {
      name: "description",
    });
    fireEvent.keyDown(reopenedTextarea, { key: "Escape" });

    expect(
      screen.queryByRole("textbox", { name: "description" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables main Task description editing when the Task is read-only", () => {
    const onDescriptionChange = vi.fn();

    render(
      <WorkItemDetailDialog
        item={{
          ...sampleItemWithSubtasks,
          description: "Read-only specification",
          readOnly: true,
        }}
        onClose={vi.fn()}
        onDescriptionChange={onDescriptionChange}
      />,
    );

    expect(
      screen.queryByTestId("edit-task-description"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Read-only specification"));
    expect(
      screen.queryByRole("textbox", { name: "description" }),
    ).not.toBeInTheDocument();
    expect(onDescriptionChange).not.toHaveBeenCalled();
  });
});
