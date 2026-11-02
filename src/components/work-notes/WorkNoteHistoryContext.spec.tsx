import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/vi.json";
import { agentApi } from "@/lib/queries/work-notes/work-note-agent.api";
import WorkNoteHistoryContext from "./WorkNoteHistoryContext";

vi.mock("@/lib/queries/work-notes/work-note-agent.api", () => ({
  agentApi: { history: vi.fn() },
}));

const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const draftId = "f081a006-489c-4a50-a0df-a54567fdc01b";

function mount() {
  return render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <WorkNoteHistoryContext projectId={projectId} draftId={draftId} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(agentApi.history).mockReset();
});

it("lists previous notes used by the AI and highlights outdated or conflicting facts with masked values", async () => {
  vi.mocked(agentApi.history).mockResolvedValue({
    history: {
      notes: [
        { ref: "H1", id: "n1", title: "Tiến độ tuần 43", date: "2026-10-31", source: "TASK_NOTE", relation: "SELF" },
        { ref: "H2", id: "", title: "Môi trường?", date: "2026-10-30", source: "CLARIFICATION_LEDGER", relation: "SELF" },
        {
          ref: "H3",
          id: "p1",
          title: "Kiến trúc tổng thể",
          date: "2026-10-29",
          source: "TASK_NOTE",
          relation: "PARENT",
          taskKey: "OPS-10",
        },
      ],
      facts: [
        {
          id: "n1#0",
          ref: "H1",
          date: "2026-10-31",
          kind: "TEST_RESULT",
          polarity: "POSITIVE",
          status: "CURRENT",
          quote: "Đã test module cốt lõi trên staging.",
        },
        {
          id: "n1#1",
          ref: "H1",
          date: "2026-10-10",
          kind: "STATUS",
          polarity: "POSITIVE",
          status: "OUTDATED",
          quote: "DB_PASSWORD=[[WN_SEC:PASSWORD:0a1b2c3d4e]] đã cấu hình xong.",
        },
      ],
      findings: [{ factId: "n1#1", noteId: "n1", status: "OUTDATED", reason: "OLDER_THAN_THRESHOLD" }],
      truncated: false,
    },
  });

  mount();

  expect(await screen.findByText("Tiến độ tuần 43")).toBeInTheDocument();
  expect(screen.getByText("Câu trả lời làm rõ trước đây")).toBeInTheDocument();
  expect(screen.getByText("Kiến trúc tổng thể")).toBeInTheDocument();
  expect(screen.getByTestId("worknote-history-relation-badge")).toHaveTextContent(
    "Task cha · OPS-10",
  );
  expect(screen.getByText("Ghi chú cũ AI tham khảo (3)")).toBeInTheDocument();
  const warnings = screen.getByTestId("worknote-history-warnings");
  expect(warnings).toHaveTextContent("1 thông tin cũ cần lưu ý");
  expect(warnings).toHaveTextContent("Có thể đã lỗi thời");
  expect(warnings).toHaveTextContent("🔒 mật khẩu");
  expect(warnings).not.toHaveTextContent("WN_SEC");
  expect(agentApi.history).toHaveBeenCalledWith(projectId, draftId, expect.any(AbortSignal));
});

it("shows an empty state and reloads on demand", async () => {
  vi.mocked(agentApi.history).mockResolvedValue({ history: null });
  mount();
  expect(await screen.findByText("Chưa có ghi chú cũ nào của Task này để tham khảo.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tải lại ghi chú cũ" }));
  await waitFor(() => expect(agentApi.history).toHaveBeenCalledTimes(2));
});

it("degrades gracefully when history cannot be loaded", async () => {
  vi.mocked(agentApi.history).mockRejectedValue(new Error("boom"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được ghi chú cũ");
});

it("formats masked sensitive tokens in note titles and across all 13 SensitiveCategory values", async () => {
  const categories = [
    "PRIVATE_KEY",
    "CLOUD_KEY",
    "API_KEY",
    "TOKEN",
    "PASSWORD",
    "CONNECTION_STRING",
    "CREDENTIAL",
    "HIGH_ENTROPY_SECRET",
    "EMAIL",
    "PHONE",
    "NATIONAL_ID",
    "BANK_CARD",
    "BANK_ACCOUNT",
  ] as const;

  vi.mocked(agentApi.history).mockResolvedValue({
    history: {
      notes: [
        {
          ref: "H1",
          id: "n1",
          title: "Cấu hình [[WN_SEC:API_KEY:0123456789ab]]",
          date: "2026-10-31",
          source: "TASK_NOTE",
          relation: "SELF",
        },
      ],
      facts: [
        {
          id: "n1#0",
          ref: "H1",
          date: "2026-10-10",
          kind: "FACT",
          polarity: "POSITIVE",
          status: "OUTDATED",
          quote: categories
            .map((cat) => `[[WN_SEC:${cat}:0123456789ab]]`)
            .join(", "),
        },
      ],
      findings: [],
      truncated: false,
    },
  });

  mount();

  expect(await screen.findByText("Cấu hình 🔒 API key")).toBeInTheDocument();
  const warnings = screen.getByTestId("worknote-history-warnings");
  expect(warnings).not.toHaveTextContent("WN_SEC");
  expect(warnings).toHaveTextContent("🔒 khóa cloud");
  expect(warnings).toHaveTextContent("🔒 chuỗi bí mật");
  expect(warnings).toHaveTextContent("🔒 CCCD/CMND");
  expect(warnings).toHaveTextContent("🔒 số thẻ");
  expect(warnings).toHaveTextContent("🔒 số tài khoản");
});
