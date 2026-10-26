import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import WorkBoardView from "./WorkBoardView";
import type { WorkItem } from "./work-types";

const item: WorkItem = {
  id: "parent", key: "P-1", title: "Parent task", type: "TASK",
  status: "TODO", priority: "MEDIUM", resolution: "UNRESOLVED",
  assignee: { id: "other", name: "Other", initials: "OT" },
  reporter: { id: "other", name: "Other", initials: "OT" },
  createdAt: "2026-10-01", dueDate: null, projectName: "Project",
  readOnly: true, subtasks: { total: 2, completed: 0 },
  subtaskItems: [
    { id: "locked", key: "P-2", summary: "Read-only subtask", done: false, status: "TODO", readOnly: true },
    { id: "owned", key: "P-3", summary: "Editable subtask", done: false, status: "TODO", readOnly: false },
  ],
};

function mount(current = item) {
  const update = vi.fn();
  const transition = vi.fn();
  const view = render(<NextIntlClientProvider locale="en" messages={messages}>
    <WorkBoardView items={[current]} activeSprintName={null} isSprintLoading={false} isSprintError={false}
      onOpenItem={vi.fn()} onStatusChange={transition} onUpdateSubtask={update} />
  </NextIntlClientProvider>);
  return { ...view, update, transition };
}

it("prevents dragging and dropping a read-only Subtask while preserving an owned Subtask", () => {
  const { update } = mount();
  const locked = screen.getByRole("button", { name: "Read-only subtask" }).closest("li")!;
  const owned = screen.getByRole("button", { name: "Editable subtask" }).closest("li")!;
  expect(locked).toHaveAttribute("draggable", "false");
  expect(owned).toHaveAttribute("draggable", "true");
  const setData = vi.fn();
  fireEvent.dragStart(locked, { dataTransfer: { setData } });
  expect(setData).not.toHaveBeenCalled();
  const done = screen.getByRole("region", { name: /^Done/ });
  fireEvent.drop(done, { dataTransfer: { getData: () => "subtask:parent:locked" } });
  expect(update).not.toHaveBeenCalled();
  fireEvent.drop(done, { dataTransfer: { getData: () => "subtask:parent:owned" } });
  expect(update).toHaveBeenCalledWith("parent", "owned", { status: "DONE", done: true });
});

it("ignores stale or unknown drag payloads and read-only parent Tasks", () => {
  const { update, transition } = mount();
  const done = screen.getByRole("region", { name: /^Done/ });
  for (const payload of ["subtask:parent:missing", "subtask:missing:owned", "parent", "missing"]) {
    fireEvent.drop(done, { dataTransfer: { getData: () => payload } });
  }
  expect(update).not.toHaveBeenCalled();
  expect(transition).not.toHaveBeenCalled();
});

it("rechecks Subtask permission at drop time after authority changes", () => {
  const { update, rerender } = mount();
  const revoked = { ...item, subtaskItems: item.subtaskItems?.map((sub) => ({ ...sub, readOnly: true })) };
  rerender(<NextIntlClientProvider locale="en" messages={messages}>
    <WorkBoardView items={[revoked]} activeSprintName={null} isSprintLoading={false} isSprintError={false}
      onOpenItem={vi.fn()} onUpdateSubtask={update} />
  </NextIntlClientProvider>);
  fireEvent.drop(screen.getByRole("region", { name: /^Done/ }), { dataTransfer: { getData: () => "subtask:parent:owned" } });
  expect(update).not.toHaveBeenCalled();
});
