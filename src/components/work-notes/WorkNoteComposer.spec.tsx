import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import messages from "@/messages/vi.json";
import { ApiError } from "@/lib/api-client";
import {
  agentApi,
  type EditorSourceIdentity,
  type AgentDraft,
} from "@/lib/queries/work-notes/work-note-agent.api";
import WorkNoteComposer from "./WorkNoteComposer";
import { useWorkNoteComposer } from "./useWorkNoteComposer";
import { assessmentApi } from "@/lib/queries/work-notes/work-note-assessment.api";
import { assessmentFixture } from "./assessment.test-fixture";
vi.mock("@/lib/queries/work-notes/work-note-assessment.api", () => ({
  assessmentApi: {
    assess: vi.fn(),
    reply: vi.fn(),
    rewrite: vi.fn(),
    correct: vi.fn(),
    reset: vi.fn(),
    validateAuthor: vi.fn(),
    feedback: vi.fn(),
  },
}));
const sharedUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queries/work-notes/work-note-agent.api", () => {
  const api = {
    resume: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    message: vi.fn(),
    apply: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    reset: vi.fn(),
    versions: vi.fn(),
    restore: vi.fn(),
  };
  return {
    agentApi: api,
    editorAgentApi: () => ({ ...api, update: sharedUpdate }),
  };
});

function runToolbarTool(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Cải thiện với AI" }));
  fireEvent.click(screen.getByRole("button", { name: label }));
}

it("keeps the AI panel collapsed by default, runs no inference on opening, and gates Task information check on NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "false");
  const first = mount();
  await screen.findByLabelText("Nội dung");
  expect(
    screen.queryByRole("complementary", { name: "Trợ lý AI" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(
    screen.getByRole("complementary", { name: "Trợ lý AI" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Kiểm tra thông tin" }),
  ).not.toBeInTheDocument();
  first.unmount();

  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  mount();
  await screen.findByLabelText("Nội dung");
  expect(
    screen.queryByRole("complementary", { name: "Trợ lý AI" }),
  ).not.toBeInTheDocument();
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(assessmentApi.assess).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(
    screen.getByRole("button", { name: "Kiểm tra thông tin" }),
  ).toBeEnabled();
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(assessmentApi.assess).not.toHaveBeenCalled();
});

const base: AgentDraft = {
  id: "f081a006-489c-4a50-a0df-a54567fdc01b",
  taskId: "851a2b3c4d5e6f7a8b9c0d21",
  noteId: null,
  workflow: "TASK_NOTE",
  baseNoteVersion: 0,
  revision: 1,
  title: "Queue",
  contentMarkdown: "We have not tested the queue.",
  expiresAt: "2026-11-01T00:00:00.000Z",
  hasAppliedRewrite: false,
  conversation: [],
  pendingQuestion: null,
  suggestion: null,
};

function mount(
  source?: EditorSourceIdentity,
  options?: {
    locale?: "vi" | "en";
    initialFields?: { title: string; contentMarkdown: string };
    onSaved?: (result?: unknown) => void;
    onClose?: (persisted?: { title: string; contentMarkdown: string }) => void;
  },
) {
  const locale = options?.locale ?? "vi";
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
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "en" ? enMessages : messages}
      >
        <WorkNoteComposer
          source={source}
          initialFields={options?.initialFields}
          projectId="651a2b3c4d5e6f7a8b9c0d21"
          taskId={base.taskId}
          onClose={options?.onClose ?? vi.fn()}
          onSaved={options?.onSaved ?? vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(agentApi.resume).mockResolvedValue(structuredClone(base));
  vi.mocked(agentApi.update).mockImplementation(async (_p, _id, value) => ({
    ...base,
    ...value,
    revision: 2,
  }));
  vi.mocked(agentApi.save).mockResolvedValue({
    id: "751a2b3c4d5e6f7a8b9c0d21",
  } as Awaited<ReturnType<typeof agentApi.save>>);
  vi.mocked(assessmentApi.assess).mockResolvedValue(
    structuredClone(assessmentFixture),
  );
});
afterEach(() => vi.unstubAllEnvs());

it("uses two fields and saves ordinary text without an Agent call", async () => {
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Approach")).not.toBeInTheDocument();
});

it("requires an in-app confirmation before restoring a version and supports cancellation", async () => {
  const noteId = "751a2b3c4d5e6f7a8b9c0d21";
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    noteId,
    baseNoteVersion: 2,
  });
  vi.mocked(agentApi.versions).mockResolvedValue({
    data: [
      {
        versionNumber: 1,
        title: "Queue",
        contentMarkdown: base.contentMarkdown,
        createdAt: "2026-10-28T00:00:00.000Z",
      },
    ],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  });
  vi.mocked(agentApi.restore).mockResolvedValue({ id: noteId } as Awaited<
    ReturnType<typeof agentApi.restore>
  >);
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Lịch sử phiên bản" }));
  fireEvent.click(await screen.findByText("Phiên bản 1: Queue"));
  fireEvent.click(
    screen.getByRole("button", { name: "Khôi phục thành phiên bản mới" }),
  );
  await screen.findByRole("alertdialog");
  expect(agentApi.restore).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(agentApi.restore).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Khôi phục thành phiên bản mới" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Xác nhận khôi phục" }),
  );
  await waitFor(() => expect(agentApi.discard).toHaveBeenCalled());
  expect(agentApi.restore).toHaveBeenCalledTimes(1);
  expect(agentApi.restore).toHaveBeenCalledWith(
    expect.any(String),
    base.taskId,
    noteId,
    expect.objectContaining({ expectedVersion: 2, versionNumber: 1 }),
  );
});

it("opens the AI chat panel to show a proposal without changing the editor and requires confirmation before discarding the original", async () => {
  const suggestion = {
    id: "f081a006-489c-4a50-a0df-a54567fdc02b",
    scope: "whole_note" as const,
    operation: "grammar" as const,
    baseRevision: 1,
    replacementText: "The queue has not been tested.",
    suggestedTitle: null,
    changeSummary: ["Improved wording."],
  };
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "SUGGESTION_READY",
    message: "Proposal.",
    suggestion,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  vi.mocked(agentApi.apply).mockResolvedValue({
    ...base,
    contentMarkdown: suggestion.replacementText,
    hasAppliedRewrite: true,
    revision: 2,
  });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Sửa chính tả & ngữ pháp");
  const proposalRegion = await screen.findByRole("region", {
    name: "Đề xuất chỉnh sửa",
  });
  expect(proposalRegion).not.toHaveTextContent("Điểm AI đã chỉnh sửa");
  fireEvent.click(
    within(proposalRegion).getByRole("button", { name: "Bản hoàn chỉnh" }),
  );
  expect(proposalRegion).toHaveTextContent("The queue has not been tested.");
  expect(
    screen.getByRole("complementary", { name: "Trợ lý AI" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Nội dung")).toHaveValue(base.contentMarkdown);
  expect(agentApi.apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng đề xuất" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Nội dung")).toHaveValue(
      suggestion.replacementText,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await screen.findByText("Bỏ bản gốc trước khi AI viết lại?");
  expect(agentApi.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
  expect(agentApi.save).not.toHaveBeenCalled();
});

it("preserves the editor and allows Save after an Agent failure", async () => {
  vi.mocked(agentApi.message).mockRejectedValue(Error("Provider unavailable"));
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Sửa chính tả & ngữ pháp");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Nội dung")).toHaveValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
});

it("retries the failed Agent operation and opens a returned clarification in the AI chat stream", async () => {
  vi.mocked(agentApi.message)
    .mockRejectedValueOnce(Error("Agent timed out"))
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message: "One detail is needed.",
      suggestion: null,
      questions: [
        {
          id: "f081a006-489c-4a50-a0df-a54567fdc03b",
          text: "Which environment?",
          reason: "The source does not say.",
          options: [],
        },
      ],
      uncertainties: [],
      sourceRevision: 1,
    });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Sửa chính tả & ngữ pháp");
  await screen.findByText("Agent timed out");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("Which environment?");
  expect(agentApi.message).toHaveBeenCalledTimes(2);
  expect(agentApi.message).toHaveBeenLastCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ operation: "grammar", expectedRevision: 1 }),
  );
  expect(screen.getByLabelText("Nội dung")).toHaveValue(base.contentMarkdown);
  expect(agentApi.save).not.toHaveBeenCalled();
});

it("retries autosave rather than an older Agent failure after editing", async () => {
  vi.mocked(agentApi.message).mockRejectedValueOnce(Error("Agent timed out"));
  vi.mocked(agentApi.update).mockRejectedValueOnce(Error("Autosave failed"));
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Sửa chính tả & ngữ pháp");
  await screen.findByText("Agent timed out");
  fireEvent.change(screen.getByLabelText("Nội dung"), {
    target: { value: "Updated text, still not tested." },
  });
  await screen.findByText("Autosave failed");
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await waitFor(() => expect(agentApi.update).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText("Autosave failed")).not.toBeInTheDocument(),
  );
  expect(agentApi.message).toHaveBeenCalledTimes(1);
});

it("flushes changed text before sending the request and uses the returned server revision", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 2,
  });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.change(screen.getByLabelText("Nội dung"), {
    target: { value: "New text, not tested." },
  });
  runToolbarTool("Sửa chính tả & ngữ pháp");
  await waitFor(() => expect(agentApi.message).toHaveBeenCalled());
  expect(agentApi.update).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({
      expectedRevision: 1,
      contentMarkdown: "New text, not tested.",
    }),
  );
  expect(agentApi.message).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ expectedRevision: 2 }),
  );
});

it("sends the exact selected quote from the unified AI chat panel and leaves whole-note context opt-in", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  mount();
  const field = await screen.findByLabelText("Nội dung");
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 11 } });
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  );
  fireEvent.change(screen.getByLabelText("Nhập yêu cầu của bạn..."), {
    target: { value: "Làm rõ từ này." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        scope: "selection",
        selection: { start: 8, end: 11, quote: "not" },
        includeWholeNoteContext: false,
      }),
    ),
  );
});

it("sends source CRLF offsets even though the browser textarea exposes normalized LF offsets", async () => {
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    contentMarkdown: "🙂 same\r\nsame\r\nend",
  });
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  mount();
  const field = await screen.findByLabelText("Nội dung");
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 12 } });
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  );
  fireEvent.change(screen.getByLabelText("Nhập yêu cầu của bạn..."), {
    target: { value: "Sửa từ đang chọn." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        selection: { start: 9, end: 13, quote: "same" },
      }),
    ),
  );
});

it("opens a clarification automatically and can skip without an empty instruction", async () => {
  const question = {
    id: "f081a006-489c-4a50-a0df-a54567fdc03b",
    text: "Which environment?",
    reason: "The environment is not in the note.",
    options: [],
  };
  vi.mocked(agentApi.message)
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message: "A detail is needed.",
      suggestion: null,
      questions: [question],
      uncertainties: [],
      sourceRevision: 1,
    })
    .mockResolvedValueOnce({
      status: "ANSWER",
      message: "Kept the unknown detail.",
      suggestion: null,
      questions: [],
      uncertainties: [],
      sourceRevision: 1,
    });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Làm rõ nghĩa");
  await screen.findByText(question.text);
  fireEvent.click(
    screen.getByRole("button", { name: "Tiếp tục mà không thêm thông tin" }),
  );
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenLastCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        replyToQuestionId: question.id,
        questionDisposition: "skipped",
        instruction: "Tiếp tục mà không thêm thông tin",
      }),
    ),
  );
});

it("keeps newer typing when an Agent response arrives after a local edit", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof agentApi.message>>) => void;
  vi.mocked(agentApi.message).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  runToolbarTool("Sửa chính tả & ngữ pháp");
  await waitFor(() => expect(agentApi.message).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Nội dung"), {
    target: { value: "A newer draft, still not tested." },
  });
  resolve({
    status: "ANSWER",
    message: "Earlier response.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Nội dung")).toHaveValue(
    "A newer draft, still not tested.",
  );
  expect(agentApi.apply).not.toHaveBeenCalled();
});

it("uses the shared Document composer without displaying a linked Task or submitting on Save", async () => {
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    workflow: "PROJECT_DOCUMENT",
    resourceId: "document",
    noteId: "document",
    baseContentHash: "a".repeat(64),
  });
  sharedUpdate.mockImplementation(async (_p, _id, value) => ({
    ...base,
    ...value,
    workflow: "PROJECT_DOCUMENT",
    revision: 2,
  }));
  mount({ workflow: "PROJECT_DOCUMENT", resourceId: "document" });
  await screen.findByRole("dialog", { name: "Chỉnh sửa tài liệu dự án" });
  await screen.findByLabelText("Nội dung");
  expect(screen.queryByText(/Task liên kết/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nội dung"), {
    target: { value: "Updated Document body." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(sharedUpdate).toHaveBeenCalled();
  expect(agentApi.update).not.toHaveBeenCalled();
});

it("shows the floating AI badge only after pointer drag ends and suppresses it for whitespace-only selections", async () => {
  mount();
  const field = (await screen.findByLabelText(
    "Nội dung",
  )) as HTMLTextAreaElement;

  fireEvent.pointerDown(field);
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 18 } });
  expect(
    screen.queryByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  ).not.toBeInTheDocument();

  fireEvent.pointerUp(document.body, { clientX: 140, clientY: 90 });
  expect(
    screen.getByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  ).toBeEnabled();

  fireEvent.mouseDown(field);
  fireEvent.select(field, { target: { selectionStart: 7, selectionEnd: 8 } });
  fireEvent.mouseUp(field, { clientX: 100, clientY: 90 });
  expect(
    screen.queryByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  ).not.toBeInTheDocument();
});

it("opens the collapsible right-hand AI chat panel from the floating AI badge without overlapping popups, shows the 5 quick options, and applies selection proposals with green highlight", async () => {
  const suggestion = {
    id: "inline-selection-proposal",
    scope: "selection" as const,
    operation: "clarify" as const,
    baseRevision: 1,
    selection: { start: 8, end: 18, quote: "not tested" },
    replacementText: "yet to be tested",
    suggestedTitle: null,
    changeSummary: ["Refined the selected phrase."],
  };
  const followUpSuggestion = {
    ...suggestion,
    id: "inline-selection-proposal-2",
    operation: "custom" as const,
    replacementText: "pending verification",
  };
  vi.mocked(agentApi.message)
    .mockResolvedValueOnce({
      status: "SUGGESTION_READY",
      message: "Refined phrase.",
      suggestion,
      questions: [],
      uncertainties: [],
      sourceRevision: 1,
    })
    .mockResolvedValueOnce({
      status: "SUGGESTION_READY",
      message: "Shorter phrase.",
      suggestion: followUpSuggestion,
      questions: [],
      uncertainties: [],
      sourceRevision: 1,
    });
  vi.mocked(agentApi.apply).mockResolvedValue({
    ...base,
    contentMarkdown: "We have pending verification the queue.",
    hasAppliedRewrite: true,
    revision: 2,
    suggestion: null,
  });

  mount();
  const field = await screen.findByLabelText("Nội dung");

  // Panel is collapsed initially
  expect(
    screen.queryByRole("complementary", { name: "Trợ lý AI" }),
  ).not.toBeInTheDocument();

  // Select phrase and release pointer -> floating AI badge appears
  fireEvent.mouseDown(field);
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 18 } });
  fireEvent.mouseUp(document.body, { clientX: 160, clientY: 110 });

  // Click floating AI badge -> opens Right-Hand AI Chat Panel with contextual greeting + 5 options
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  );
  const aiPanel = screen.getByRole("complementary", { name: "Trợ lý AI" });
  expect(aiPanel).toHaveTextContent("Tôi thấy bạn đang viết về");
  expect(aiPanel).toHaveTextContent("“not tested”");
  expect(
    screen.getByRole("button", { name: "Làm rõ nghĩa, dễ hiểu hơn" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Viết chuyên nghiệp hơn" }),
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "Ngắn gọn hơn" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Bổ sung chi tiết" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Khác (nhập yêu cầu)" }),
  ).toBeEnabled();

  fireEvent.click(
    screen.getByRole("button", { name: "Làm rõ nghĩa, dễ hiểu hơn" }),
  );

  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        operation: "clarify",
        scope: "selection",
        selection: { start: 8, end: 18, quote: "not tested" },
        includeWholeNoteContext: false,
      }),
    ),
  );

  // Proposal renders directly inside the right-hand chat stream with inline Diff (without changeSummary box)
  const proposalCard = await screen.findByRole("region", {
    name: "Đề xuất chỉnh sửa",
  });
  expect(proposalCard).not.toHaveTextContent("Điểm AI đã chỉnh sửa");
  const diffView = within(proposalCard).getByTestId("proposal-diff-content");
  expect(diffView.querySelector("del")).toHaveTextContent("not");
  expect(diffView.querySelector("ins")).toHaveTextContent("yet to be");
  expect(diffView).toHaveTextContent("tested");

  // Users can switch cleanly between So sánh, Bản hoàn chỉnh, and Bản gốc
  fireEvent.click(
    within(proposalCard).getByRole("button", { name: "Bản hoàn chỉnh" }),
  );
  expect(proposalCard).toHaveTextContent("yet to be tested");
  fireEvent.click(
    within(proposalCard).getByRole("button", { name: "Bản gốc" }),
  );
  expect(proposalCard).toHaveTextContent("not tested");
  fireEvent.click(
    within(proposalCard).getByRole("button", { name: "So sánh" }),
  );
  expect(screen.getByLabelText("Nội dung")).toHaveValue(base.contentMarkdown);

  // Freeform follow-up message from pinned bottom chat input (11)
  fireEvent.change(screen.getByLabelText("Nhập yêu cầu của bạn..."), {
    target: { value: "Làm rõ hơn và bổ sung ví dụ" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenLastCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        operation: "custom",
        instruction: "Làm rõ hơn và bổ sung ví dụ",
        scope: "selection",
        selection: { start: 8, end: 18, quote: "not tested" },
      }),
    ),
  );
  await screen.findByText("pending verification");

  // Apply to selection -> updates only selected phrase and highlights in green
  fireEvent.click(
    screen.getByRole("button", { name: "Áp dụng cho đoạn chọn" }),
  );
  await waitFor(() =>
    expect(agentApi.apply).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      followUpSuggestion.id,
      expect.objectContaining({
        action: "replace_selection",
        applyTitle: false,
        expectedRevision: 1,
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Nội dung")).toHaveValue(
      "We have pending verification the queue.",
    ),
  );
  expect(screen.getByTestId("applied-selection-highlight")).toHaveTextContent(
    "pending verification",
  );
});

it("collapses the AI chat panel via the collapse button or Escape without closing the editor, omits the Đoạn văn đã chọn banner, and keeps selection scope for custom instructions", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "Đã giải thích.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });

  mount();
  const field = await screen.findByLabelText("Nội dung");

  // Open via header button and collapse via [⌃] button
  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(
    screen.getByRole("complementary", { name: "Trợ lý AI" }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Thu gọn bảng Trợ lý AI" }),
  );
  expect(
    screen.queryByRole("complementary", { name: "Trợ lý AI" }),
  ).not.toBeInTheDocument();

  // Select text, open via floating AI badge, then collapse via Escape without closing modal
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 18 } });
  fireEvent.click(
    screen.getByRole("button", { name: "Chỉnh sửa đoạn bôi đen với AI" }),
  );
  expect(
    screen.getByRole("complementary", { name: "Trợ lý AI" }),
  ).toBeInTheDocument();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    screen.queryByRole("complementary", { name: "Trợ lý AI" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Tạo ghi chú công việc mới" }),
  ).toBeInTheDocument();

  // Reopen, verify Đoạn văn đã chọn banner is omitted, and send custom instruction for selected text
  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(screen.queryByText("Đoạn văn đã chọn")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nhập yêu cầu của bạn..."), {
    target: { value: "Diễn đạt tự nhiên, chuyên nghiệp hơn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        operation: "custom",
        instruction: "Diễn đạt tự nhiên, chuyên nghiệp hơn",
        scope: "selection",
        includeWholeNoteContext: false,
        selection: { start: 8, end: 18, quote: "not tested" },
      }),
    ),
  );
});

it("supports the redesigned Vietnamese AI panel tabs (Trò chuyện, Gợi ý, Ngữ cảnh công việc), 3 suggestion groups, and empty-note chat (Phương án A)", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "Đã trau chuốt.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 2,
  });

  mount();
  const field = (await screen.findByLabelText(
    "Nội dung",
  )) as HTMLTextAreaElement;

  expect(screen.getByText("Tự động lưu bản nháp")).toBeInTheDocument();
  expect(
    screen.getByText(`${base.contentMarkdown.length} / 30000 ký tự`),
  ).toBeInTheDocument();

  field.setSelectionRange(8, 18);
  fireEvent.click(screen.getByRole("button", { name: "In đậm" }));
  expect(field).toHaveValue("We have **not tested** the queue.");

  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await waitFor(() =>
    expect(agentApi.update).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        contentMarkdown: "We have **not tested** the queue.",
      }),
    ),
  );
  expect(agentApi.save).not.toHaveBeenCalled();

  // Open AI panel -> verify 3 redesigned tabs (Trò chuyện | Gợi ý | Ngữ cảnh công việc)
  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(screen.getByRole("button", { name: "Trò chuyện" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Gợi ý" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Ngữ cảnh công việc" }),
  ).toBeEnabled();

  // Switch to Tab Gợi ý -> verify all 3 grouped sections
  fireEvent.click(screen.getByRole("button", { name: "Gợi ý" }));
  expect(screen.getByText("Chỉnh sửa văn bản")).toBeInTheDocument();
  expect(screen.getByText("Làm việc với toàn bộ ghi chú")).toBeInTheDocument();
  expect(screen.getByText("Làm việc với đoạn được chọn")).toBeInTheDocument();

  // Even when a passage is selected, clicking "Cải thiện toàn bộ ghi chú" targets whole_note
  fireEvent.select(field, { target: { selectionStart: 0, selectionEnd: 7 } });
  const analyzeBtn = screen.getByRole("button", {
    name: /Phân tích đoạn được chọn/,
  });
  expect(analyzeBtn).toBeEnabled();

  fireEvent.click(
    screen.getByRole("button", { name: /Cải thiện toàn bộ ghi chú/ }),
  );
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        operation: "clarify",
        scope: "whole_note",
      }),
    ),
  );
  expect(
    screen.getByRole("region", { name: "Cuộc trò chuyện với AI" }),
  ).toBeInTheDocument();

  // Clear note body -> Phương án A allows freeform chat and "Đề xuất bổ sung" while disabling text-rewrite tools
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Gợi ý" }));
  expect(
    screen.getByRole("button", { name: "Sửa chính tả & ngữ pháp" }),
  ).toBeDisabled();
  const suggestAdditionsBtn = screen.getByRole("button", {
    name: /Đề xuất bổ sung/,
  });
  expect(suggestAdditionsBtn).toBeEnabled();
  fireEvent.click(suggestAdditionsBtn);

  await waitFor(() =>
    expect(agentApi.message).toHaveBeenLastCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        operation: "custom",
        scope: "whole_note",
      }),
    ),
  );
});

it("displays the user's message bubble immediately before the AI finishes loading, clears the input right away, and formats inline Markdown without duplicate bubbles", async () => {
  let resolveMessage!: (
    value: Awaited<ReturnType<typeof agentApi.message>>,
  ) => void;
  vi.mocked(agentApi.message).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveMessage = resolve;
      }),
  );

  mount();
  await screen.findByLabelText("Nội dung");

  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  const chatInput = screen.getByLabelText("Nhập yêu cầu của bạn...");
  fireEvent.change(chatInput, {
    target: { value: "Kiểm tra tiến độ mục 1.2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

  // Immediately visible while AI request is still in-flight
  expect(chatInput).toHaveValue("");
  expect(screen.getByTestId("optimistic-user-message")).toHaveTextContent(
    "Kiểm tra tiến độ mục 1.2",
  );
  expect(
    screen.getAllByText("AI đang phân tích và phản hồi…").length,
  ).toBeGreaterThan(0);

  await waitFor(() => expect(agentApi.message).toHaveBeenCalledOnce());
  resolveMessage({
    status: "ANSWER",
    message: "Task vẫn ở trạng thái *IN_PROGRESS* và chưa nghiệm thu.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });

  await screen.findByText(/chưa nghiệm thu/);
  expect(
    screen.queryByTestId("optimistic-user-message"),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("Kiểm tra tiến độ mục 1.2")).toHaveLength(1);
  expect(screen.getByText("IN_PROGRESS").tagName).toBe("EM");
});

it("parses embedded Markdown checkboxes and numbered items in clarification questions into interactive per-item and multi-select controls", async () => {
  const matrixQuestion = {
    id: "clarify-matrix-q1",
    text: "Các mục sau đã hoàn thành đến mức nào? 1. Xác định tính cách (mục 1.2) 2. Xác định âm thanh (mục 1.3) Vui lòng chọn: - [ ] Chưa bắt đầu - [ ] Đang tiến hành - [ ] Hoàn thành phần logic/kiến trúc - [ ] Hoàn thành mẫu thiết kế - [ ] Chưa rõ",
    reason:
      "Cần đánh giá tiến độ chính xác để làm rõ 'ổn' trong bối cảnh Task IN_PROGRESS.",
    options: [],
  };
  const multiChecklistQuestion = {
    id: "clarify-multi-q2",
    text: "Bạn đã kiểm thử ở môi trường nào? - [ ] Local - [ ] Staging - [ ] Chưa kiểm thử",
    reason: "Cần nêu rõ phạm vi kiểm thử.",
    options: [],
  };

  vi.mocked(agentApi.message)
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message:
        "Thông tin hiện tại chưa rõ về tiến độ cụ thể của các mục thiết kế.",
      suggestion: null,
      questions: [matrixQuestion],
      uncertainties: [],
      sourceRevision: 1,
    })
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message: "Cần thêm thông tin môi trường.",
      suggestion: null,
      questions: [multiChecklistQuestion],
      uncertainties: [],
      sourceRevision: 1,
    })
    .mockResolvedValueOnce({
      status: "ANSWER",
      message: "Đã ghi nhận đầy đủ tiến độ và môi trường kiểm thử.",
      suggestion: null,
      questions: [],
      uncertainties: [],
      sourceRevision: 1,
    });

  mount();
  await screen.findByLabelText("Nội dung");
  runToolbarTool("Làm rõ nghĩa");

  await screen.findByText("Các mục sau đã hoàn thành đến mức nào?");
  const aiPanel = screen.getByRole("complementary", { name: "Trợ lý AI" });
  expect(aiPanel).not.toHaveTextContent("- [ ]");

  const item1Group = screen.getByRole("group", {
    name: "1. Xác định tính cách (mục 1.2)",
  });
  const item2Group = screen.getByRole("group", {
    name: "2. Xác định âm thanh (mục 1.3)",
  });

  const submitBtn = screen.getByRole("button", { name: "Gửi lựa chọn" });
  expect(submitBtn).toBeDisabled();

  fireEvent.click(
    within(item1Group).getByRole("button", { name: "Đang tiến hành" }),
  );
  fireEvent.click(
    within(item2Group).getByRole("button", { name: "Chưa bắt đầu" }),
  );
  expect(submitBtn).toBeEnabled();

  fireEvent.click(submitBtn);

  await waitFor(() =>
    expect(agentApi.message).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      base.id,
      expect.objectContaining({
        replyToQuestionId: matrixQuestion.id,
        questionDisposition: "answered",
        answer:
          "1. Xác định tính cách (mục 1.2): Đang tiến hành\n2. Xác định âm thanh (mục 1.3): Chưa bắt đầu",
      }),
    ),
  );

  // Follow-up multi-select checklist question (no numbered sub-items)
  await screen.findByText("Bạn đã kiểm thử ở môi trường nào?");
  fireEvent.click(screen.getByRole("checkbox", { name: "Local" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Staging" }));
  fireEvent.click(screen.getByRole("button", { name: "Gửi lựa chọn" }));

  await waitFor(() =>
    expect(agentApi.message).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      base.id,
      expect.objectContaining({
        replyToQuestionId: multiChecklistQuestion.id,
        questionDisposition: "answered",
        answer: "Local, Staging",
      }),
    ),
  );
  await screen.findByText("Đã ghi nhận đầy đủ tiến độ và môi trường kiểm thử.");
});

it("renders inline without a Modal wrapper when variant='inline' and notifies parent when the AI 3rd column toggles", async () => {
  const onPanelOpenChange = vi.fn();
  render(
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
      <NextIntlClientProvider locale="vi" messages={messages}>
        <WorkNoteComposer
          variant="inline"
          projectId="651a2b3c4d5e6f7a8b9c0d21"
          taskId={base.taskId}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onPanelOpenChange={onPanelOpenChange}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  await screen.findByLabelText("Nội dung");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Tạo ghi chú công việc mới" }),
  ).toBeVisible();
  expect(onPanelOpenChange).toHaveBeenLastCalledWith(false);

  fireEvent.click(screen.getByRole("button", { name: "Trợ lý AI" }));
  expect(onPanelOpenChange).toHaveBeenLastCalledWith(true);
  expect(
    screen.getByRole("complementary", { name: "Trợ lý AI" }),
  ).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "Thu gọn bảng Trợ lý AI" }),
  );
  expect(onPanelOpenChange).toHaveBeenLastCalledWith(false);
});

it("renders English translations cleanly when mounted with en.json", async () => {
  render(
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
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WorkNoteComposer
          projectId="651a2b3c4d5e6f7a8b9c0d21"
          taskId={base.taskId}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  await screen.findByLabelText("Content");
  expect(
    screen.getByRole("button", { name: "Improve with AI" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
  expect(
    screen.getByRole("complementary", { name: "AI Assistant" }),
  ).toBeVisible();
});

it("flushes pending debounced edits immediately when unmounted before 600ms", async () => {
  const rendered = mount();
  const body = await screen.findByLabelText("Nội dung");
  fireEvent.change(body, {
    target: { value: "Typed within 600ms right before closing modal." },
  });
  expect(agentApi.update).not.toHaveBeenCalled();

  rendered.unmount();

  await waitFor(() =>
    expect(agentApi.update).toHaveBeenCalledWith(
      "651a2b3c4d5e6f7a8b9c0d21",
      base.id,
      expect.objectContaining({
        expectedRevision: 1,
        contentMarkdown: "Typed within 600ms right before closing modal.",
      }),
    ),
  );
});

it("serializes discard() behind an in-flight autosave so expectedRevision matches and the cache is not repopulated", async () => {
  let resolvePatch!: (value: AgentDraft) => void;
  vi.mocked(agentApi.update).mockImplementation(
    () =>
      new Promise<AgentDraft>((resolve) => {
        resolvePatch = resolve;
      }),
  );
  vi.mocked(agentApi.discard).mockResolvedValue(undefined);

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="vi" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

  const { result, unmount } = renderHook(
    () =>
      useWorkNoteComposer(
        "651a2b3c4d5e6f7a8b9c0d21",
        base.taskId,
        undefined,
        vi.fn(),
      ),
    { wrapper },
  );

  await waitFor(() => expect(result.current.draft?.id).toBe(base.id));

  act(() => {
    result.current.change({
      title: base.title,
      contentMarkdown: "Dirty text triggering PATCH",
    });
  });

  // Wait for 600ms debounced autosave PATCH to start in-flight
  await waitFor(() => expect(agentApi.update).toHaveBeenCalledTimes(1));

  // Trigger discard() while PATCH is still in-flight
  let discardSettled = false;
  const discardPromise = result.current.discard().then(() => {
    discardSettled = true;
  });
  expect(agentApi.discard).not.toHaveBeenCalled();

  // Resolve in-flight PATCH with bumped revision 2
  await act(async () => {
    resolvePatch({
      ...base,
      contentMarkdown: "Dirty text triggering PATCH",
      revision: 2,
    });
    await discardPromise;
  });

  expect(discardSettled).toBe(true);
  expect(agentApi.discard).toHaveBeenCalledWith(
    "651a2b3c4d5e6f7a8b9c0d21",
    base.id,
    { expectedRevision: 2, discardConfirmed: true },
  );
  unmount();
  expect(agentApi.update).toHaveBeenCalledTimes(1);
  expect(
    client.getQueryData([
      "worknote-agent-draft",
      "651a2b3c4d5e6f7a8b9c0d21",
      "TASK_NOTE",
      base.taskId,
      "new",
    ]),
  ).toBeUndefined();
});

it("applies edited proposal text to title instead of contentMarkdown for replace_title proposals", async () => {
  const titleSuggestion = {
    id: "sug-title-1",
    baseRevision: 1,
    operation: "title" as const,
    scope: "whole_note" as const,
    changeSummary: ["Đề xuất tiêu đề rõ hơn."],
    suggestedTitle: "Queue Retry Strategy",
    replacementText: null,
  };
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...structuredClone(base),
    suggestion: titleSuggestion,
  });
  vi.mocked(agentApi.apply).mockResolvedValue({
    ...structuredClone(base),
    revision: 2,
    title: "Queue Retry Strategy",
    contentMarkdown: base.contentMarkdown,
    hasAppliedRewrite: true,
    suggestion: null,
  });

  mount();
  const body = await screen.findByLabelText("Nội dung");
  const titleInput = screen.getByLabelText("Tiêu đề");

  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa đề xuất" }));
  fireEvent.change(screen.getByLabelText("Chỉnh sửa đề xuất"), {
    target: { value: "Custom Edited Queue Title" },
  });
  fireEvent.click(screen.getByRole("button", { name: messages.workNotes.agent.apply }));

  await waitFor(() =>
    expect(agentApi.apply).toHaveBeenCalledWith(
      "651a2b3c4d5e6f7a8b9c0d21",
      base.id,
      "sug-title-1",
      expect.objectContaining({
        action: "replace_title",
        applyTitle: true,
      }),
    ),
  );
  expect(titleInput).toHaveValue("Custom Edited Queue Title");
  expect(body).toHaveValue(base.contentMarkdown);
});

it("wires WorkNoteAssessment inside AI Assistant for Task Notes when enabled, supporting assess, reply, correction, proposal rewrite, and independent Save", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(assessmentApi.assess).mockResolvedValue({
    ...structuredClone(assessmentFixture),
    sourceRevision: 2,
  });
  vi.mocked(assessmentApi.reply).mockResolvedValue({
    ...structuredClone(assessmentFixture),
    revision: 2,
    sourceRevision: 2,
    state: "paused",
    nextQuestion: null,
    noteAdequacy: "UNDETERMINED",
    gaps: [{ ...assessmentFixture.gaps[0], status: "unknown" }],
    allowedActions: ["correct", "reset", "manual", "feedback"],
  });
  vi.mocked(assessmentApi.correct).mockResolvedValue({
    ...structuredClone(assessmentFixture),
    revision: 3,
    sourceRevision: 2,
    state: "ready_to_edit",
    nextQuestion: null,
    noteAdequacy: "ENOUGH_FOR_PURPOSE",
    allowedActions: [
      "rewrite",
      "validate_author",
      "correct",
      "reset",
      "manual",
      "feedback",
    ],
  });

  mount(undefined, { locale: "en" });
  const contentInput = await screen.findByLabelText("Content");
  fireEvent.change(contentInput, {
    target: { value: "Changed note, still untested." },
  });

  fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
  fireEvent.click(screen.getByRole("button", { name: "Check information" }));

  await screen.findByText("Which retry behavior was implemented?");
  expect(agentApi.update).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({
      contentMarkdown: "Changed note, still untested.",
    }),
  );
  expect(assessmentApi.assess).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ expectedRevision: 2, purpose: "AUTO" }),
  );

  fireEvent.click(screen.getByRole("button", { name: "I do not know" }));
  await waitFor(() =>
    expect(assessmentApi.reply).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      assessmentFixture.id,
      expect.objectContaining({
        expectedRevision: 2,
        expectedAssessmentRevision: 1,
        questionId: "question-one",
        disposition: "unknown",
      }),
    ),
  );
  expect(vi.mocked(assessmentApi.reply).mock.calls[0][3]).not.toHaveProperty(
    "answer",
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Correct statement: The queue has not been tested.",
    }),
  );
  fireEvent.change(
    screen.getByLabelText("Explain what the Agent understood incorrectly"),
    {
      target: { value: "Manual retry was added behind feature flag." },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reassess with this correction" }),
  );
  await waitFor(() =>
    expect(assessmentApi.correct).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      assessmentFixture.id,
      expect.objectContaining({
        expectedRevision: 2,
        expectedAssessmentRevision: 2,
        targetClaimOrGapId: "claim-one",
        correctionText: "Manual retry was added behind feature flag.",
      }),
    ),
  );

  expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalledOnce());
});

it("auto-reveals a resumed Task assessment, surfaces rewrite proposals in Chat without auto-applying, handles 409 staleness, and excludes Work Reports", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  const ready = {
    ...structuredClone(assessmentFixture),
    state: "ready_to_edit" as const,
    nextQuestion: null,
    noteAdequacy: "ENOUGH_FOR_PURPOSE" as const,
    allowedActions: [
      "rewrite",
      "validate_author",
      "feedback",
      "reset",
      "manual",
    ],
  };
  const suggestion = {
    id: "proposal-from-assessment",
    scope: "whole_note" as const,
    operation: "custom" as const,
    baseRevision: 1,
    replacementText: "The queue has not been tested yet.",
    suggestedTitle: null,
    changeSummary: ["Kept the testing limitation."],
  };
  vi.mocked(agentApi.resume)
    .mockResolvedValueOnce({ ...base, assessment: ready })
    .mockResolvedValue({
      ...base,
      suggestion,
      assessment: { ...ready, revision: 2 },
    });
  vi.mocked(assessmentApi.rewrite).mockResolvedValue({
    status: "SUGGESTION_READY",
    message: "Review this proposal.",
    suggestion,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  vi.mocked(assessmentApi.validateAuthor).mockResolvedValue({
    ...ready,
    revision: 3,
    authorValidated: true,
    signals: { ...ready.signals, authorValidated: true },
  });

  const first = mount(undefined, { locale: "en" });
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  );
  await screen.findByRole("button", {
    name: enMessages.workNotes.agent.apply,
  });
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);

  // Dismissing proposal then validating assessment must not reopen dismissed proposal
  fireEvent.click(
    screen.getByRole("button", { name: enMessages.workNotes.agent.dismiss }),
  );
  expect(
    screen.queryByRole("button", { name: enMessages.workNotes.agent.apply }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "I confirm this reflects my note" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "I confirm this reflects my note" }),
    ).toBeDisabled(),
  );
  expect(
    screen.queryByRole("button", { name: enMessages.workNotes.agent.apply }),
  ).not.toBeInTheDocument();
  expect(agentApi.apply).not.toHaveBeenCalled();
  first.unmount();

  // 409 ASSESSMENT_STALE marks assessment stale while keeping Save enabled
  vi.mocked(agentApi.resume).mockResolvedValueOnce({
    ...base,
    assessment: ready,
  });
  vi.mocked(assessmentApi.rewrite).mockRejectedValueOnce(
    new ApiError(409, "ASSESSMENT_STALE", "The Task context changed"),
  );
  const second = mount(undefined, { locale: "en" });
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  );
  await screen.findByText("The Task context changed");
  expect(screen.getByText("stale", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
  second.unmount();

  // WORK_REPORT never renders Task assessment even when flag is on
  vi.mocked(agentApi.resume).mockResolvedValueOnce({
    ...base,
    workflow: "WORK_REPORT",
    resourceId: "report-one",
  });
  mount({ workflow: "WORK_REPORT", resourceId: "report-one" }, { locale: "en" });
  await screen.findByRole("dialog", { name: "Edit work report" });
  fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
  expect(
    screen.queryByRole("button", { name: "Check information" }),
  ).not.toBeInTheDocument();
});

it("disables Undo/Redo and blocks undo() mutations while canonical Save is pending", async () => {
  let rejectFirstSave!: (reason?: unknown) => void;
  let resolveSecondSave!: (
    value: Awaited<ReturnType<typeof agentApi.save>>,
  ) => void;
  vi.mocked(agentApi.save)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirstSave = reject;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondSave = resolve;
        }),
    );

  const onSaved = vi.fn();
  mount(undefined, { onSaved });
  const body = await screen.findByLabelText("Nội dung");

  fireEvent.change(body, {
    target: { value: "Edited body waiting to save." },
  });
  const undoButton = screen.getByRole("button", { name: "Hoàn tác" });
  const redoButton = screen.getByRole("button", { name: "Làm lại" });
  expect(undoButton).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalledTimes(1));

  expect(undoButton).toBeDisabled();
  expect(redoButton).toBeDisabled();
  fireEvent.click(undoButton);
  expect(body).toHaveValue("Edited body waiting to save.");

  await act(async () => {
    rejectFirstSave(new Error("Temporary save failure"));
  });
  await screen.findByText("Temporary save failure");
  expect(body).toHaveValue("Edited body waiting to save.");
  expect(undoButton).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalledTimes(2));
  expect(undoButton).toBeDisabled();

  await act(async () => {
    resolveSecondSave({
      id: "751a2b3c4d5e6f7a8b9c0d21",
    } as Awaited<ReturnType<typeof agentApi.save>>);
  });
  expect(onSaved).toHaveBeenCalledOnce();
});
