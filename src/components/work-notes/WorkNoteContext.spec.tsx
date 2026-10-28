import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import {
  fetchProjectTaskDetail,
  type BackendTaskDetail,
} from "@/lib/queries/tasks/useTasks";
import WorkNoteContext from "./WorkNoteContext";
vi.mock("@/lib/queries/tasks/useTasks", () => ({
  fetchProjectTaskDetail: vi.fn(),
}));
const projectId = "651a2b3c4d5e6f7a8b9c0d21",
  taskId = "851a2b3c4d5e6f7a8b9c0d21";
const task: BackendTaskDetail = {
  id: taskId,
  projectId,
  key: "OPS-620",
  title: "Validate retry",
  description: "Check the rollback path.",
  status: "DONE",
  type: "TASK",
  priority: "MEDIUM",
  assigneeId: null,
  createdBy: "fixture-author",
  parentId: null,
  sprintId: null,
  labels: [],
  subtaskCounts: { total: 0, done: 0 },
  dueDate: null,
  startDate: null,
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  version: 1,
  completedAt: null,
  steps: [{ id: "one", text: "Run network tests", done: false }],
};
function mount(
  selection: { quote: string } | null = null,
  fullContext = false,
) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NextIntlClientProvider
        locale="en"
        timeZone="Asia/Bangkok"
        messages={messages}
      >
        <WorkNoteContext
          projectId={projectId}
          taskId={taskId}
          selection={selection}
          fullContext={fullContext}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchProjectTaskDetail).mockResolvedValue(task);
});
it("shows authorized Task facts separately from the author's note and does not infer verified completion", async () => {
  mount();
  await screen.findByText("Validate retry");
  expect(screen.getByText("Check the rollback path.")).toBeInTheDocument();
  expect(screen.getByText("Run network tests")).toBeInTheDocument();
  expect(screen.getByText(/Task status does not prove/)).toBeInTheDocument();
  expect(screen.getByText(/Whole note and linked Task/)).toBeInTheDocument();
});
it("shows exact selection quote and makes additional whole-note context explicit", async () => {
  mount({ quote: "Chưa test\r\nretry" }, true);
  await screen.findByText("Validate retry");
  expect(
    screen.getByText(/Selected text, nearby lines, whole note/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Selected source text").textContent).toBe(
    "Chưa test\r\nretry",
  );
});
it("handles missing business details without inventing a description or question", async () => {
  vi.mocked(fetchProjectTaskDetail).mockResolvedValue({
    ...task,
    description: null,
    steps: [],
  });
  mount();
  await screen.findByText("No description provided.");
  expect(screen.queryByText("Which environment?")).not.toBeInTheDocument();
});
it("does not expose a mismatched Project's cached Task response", async () => {
  vi.mocked(fetchProjectTaskDetail).mockResolvedValue({
    ...task,
    projectId: "another-project",
    title: "Private task",
  });
  mount();
  await screen.findByRole("alert");
  expect(screen.queryByText("Private task")).not.toBeInTheDocument();
});
it("shows an access/load error without treating it as a business clarification", async () => {
  vi.mocked(fetchProjectTaskDetail).mockRejectedValue(Error("Denied"));
  mount();
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Reload task context" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Validate retry")).not.toBeInTheDocument();
});
