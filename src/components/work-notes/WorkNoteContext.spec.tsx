import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import messages from "@/messages/vi.json";
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
        locale="vi"
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

it("shows compact Task key, badges, checklist progress, and collapsible 1-line AI scope without inferring verified completion", async () => {
  mount();
  await screen.findByText("Validate retry");
  expect(screen.getByText("Thông tin task liên kết")).toBeInTheDocument();
  expect(screen.getByText("OPS-620")).toBeInTheDocument();
  expect(screen.getByText("Hoàn thành")).toBeInTheDocument();
  expect(screen.getByText("Trung bình")).toBeInTheDocument();
  expect(screen.getByText("fixture-author")).toBeInTheDocument();
  expect(screen.getByText("Chưa đặt hạn")).toBeInTheDocument();
  expect(screen.getByText("Check the rollback path.")).toBeInTheDocument();
  expect(screen.getByText("0/1 hoàn thành")).toBeInTheDocument();
  expect(screen.getByText("Run network tests")).toBeInTheDocument();

  // AI scope accordion is collapsed to 1 line by default and expands on click
  const scopeToggle = screen.getByRole("button", {
    name: /Phạm vi AI có thể sử dụng/,
  });
  expect(scopeToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Tiêu đề và mô tả task")).not.toBeInTheDocument();

  fireEvent.click(scopeToggle);
  expect(scopeToggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Tiêu đề và mô tả task")).toBeInTheDocument();
  expect(
    screen.getByText("Không truy cập dữ liệu ngoài phạm vi cho phép"),
  ).toBeInTheDocument();

  expect(
    screen.getByText(/Trạng thái Task không phải bằng chứng/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Toàn bộ ghi chú và Task liên kết/),
  ).toBeInTheDocument();
});

it("formats Markdown headings/bold/code in long descriptions and toggles Xem đầy đủ / Thu gọn", async () => {
  vi.mocked(fetchProjectTaskDetail).mockResolvedValue({
    ...task,
    description:
      "Thiết kế kiến trúc tổng thể cho hệ thống API.\n\n### Phạm vi công việc\n1. **Quản lý định danh**: Hỗ trợ JWT kết hợp `refresh_tokens`.\n2. **Phân quyền RBAC**: Kiểm soát quyền theo vai trò dự án.\n3. **Ghi nhận Audit**: Lưu vết bất biến vào `audit_logs_iam`.",
    steps: [
      { id: "s1", text: "Xác định mô hình RBAC", done: true },
      { id: "s2", text: "Viết kiểm thử tích hợp", done: false },
    ],
  });
  mount();
  await screen.findByText("Validate retry");

  expect(screen.queryByText(/###/)).not.toBeInTheDocument();
  expect(screen.getByText("Phạm vi công việc")).toBeInTheDocument();
  expect(screen.getByText("Quản lý định danh").tagName).toBe("STRONG");
  expect(screen.getByText("refresh_tokens").tagName).toBe("CODE");
  expect(screen.getByText("1/2 hoàn thành")).toBeInTheDocument();

  const expandBtn = screen.getByRole("button", { name: "Xem đầy đủ" });
  expect(expandBtn).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(expandBtn);
  expect(
    screen.getByRole("button", { name: "Thu gọn" }),
  ).toHaveAttribute("aria-expanded", "true");
});

it("shows exact selection quote and makes additional whole-note context explicit", async () => {
  mount({ quote: "Chưa test\r\nretry" }, true);
  await screen.findByText("Validate retry");
  expect(
    screen.getByText(/Đoạn văn đang chọn, các dòng lân cận, toàn bộ ghi chú/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Đoạn văn bản gốc đang chọn").textContent).toBe(
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
  await screen.findByText("Chưa có mô tả.");
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
    screen.getByRole("button", { name: "Tải lại ngữ cảnh Task" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Validate retry")).not.toBeInTheDocument();
});

it("renders English task context labels when mounted with en.json", async () => {
  vi.mocked(fetchProjectTaskDetail).mockResolvedValue(task);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WorkNoteContext
          projectId={projectId}
          taskId={taskId}
          selection={null}
          fullContext={false}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Linked task details")).toBeInTheDocument();
  expect(await screen.findByText("Checklist progress")).toBeInTheDocument();
});
