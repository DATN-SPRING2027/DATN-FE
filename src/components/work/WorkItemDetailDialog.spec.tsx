import { render, screen } from "@testing-library/react";
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

describe("WorkItemDetailDialog", () => {
  it("formats the created date with the active locale", () => {
    const item: WorkItem = {
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
      subtasks: { completed: 0, total: 4 },
    };
    const expectedDate = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(item.createdAt));

    render(<WorkItemDetailDialog item={item} onClose={vi.fn()} />);

    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });
});
