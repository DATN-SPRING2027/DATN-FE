import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import WorkNoteAssessment, {
  type WorkNoteAssessmentProps,
} from "./WorkNoteAssessment";
import { assessmentFixture } from "./assessment.test-fixture";

function mount(overrides: Partial<WorkNoteAssessmentProps> = {}) {
  const props: WorkNoteAssessmentProps = {
    value: structuredClone(assessmentFixture),
    busy: false,
    stale: false,
    onAssess: vi.fn(),
    onReply: vi.fn(),
    onRewrite: vi.fn(),
    onCorrect: vi.fn(),
    onReset: vi.fn(),
    onValidate: vi.fn(),
    onFeedback: vi.fn(),
    ...overrides,
  };
  const rendered = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkNoteAssessment {...props} />
    </NextIntlClientProvider>,
  );
  return { ...props, rerender: rendered.rerender };
}
it("keeps unsent text scoped to its question when a suggested answer advances to another gap", () => {
  const props = mount();
  fireEvent.change(screen.getByLabelText("Câu trả lời của bạn"), {
    target: { value: "Unsent implementation detail for the first question." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Manual retry" }));
  props.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkNoteAssessment
        {...props}
        value={{
          ...assessmentFixture,
          revision: 2,
          nextQuestion: {
            ...assessmentFixture.nextQuestion!,
            id: "question-two",
            gapId: "gap-two",
            text: "What test result was observed?",
          },
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByLabelText("Câu trả lời của bạn")).toHaveValue("");
  expect(
    screen.getByRole("button", { name: "Gửi câu trả lời" }),
  ).toBeDisabled();
  expect(props.onReply).toHaveBeenCalledExactlyOnceWith(
    "answered",
    "Manual retry",
  );
});
it("shows the real acquisition manifest, separate support/verification, and the exact workflow state", () => {
  mount();
  expect(screen.getByText("waiting_for_answer")).toBeInTheDocument();
  expect(screen.getByText("Task checklist")).toBeInTheDocument();
  expect(
    screen.getByText("Không đưa vào yêu cầu này", { exact: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Được chứng minh đầy đủ bởi trích dẫn.*Do tác giả báo cáo/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Đánh giá ngữ nghĩa độc lập: chưa thiết lập/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Câu trả lời của bạn")).toHaveFocus();
});
it("sends typed unknown/skipped without answer content and permits free text or a suggested answer", () => {
  const props = mount();
  fireEvent.click(screen.getByRole("button", { name: "Tôi chưa biết" }));
  fireEvent.click(screen.getByRole("button", { name: "Bỏ qua câu hỏi này" }));
  fireEvent.click(screen.getByRole("button", { name: "Manual retry" }));
  fireEvent.change(screen.getByLabelText("Câu trả lời của bạn"), {
    target: { value: "Manual button after timeout." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi câu trả lời" }));
  expect(props.onReply).toHaveBeenNthCalledWith(1, "unknown");
  expect(props.onReply).toHaveBeenNthCalledWith(2, "skipped");
  expect(props.onReply).toHaveBeenNthCalledWith(3, "answered", "Manual retry");
  expect(props.onReply).toHaveBeenNthCalledWith(
    4,
    "answered",
    "Manual button after timeout.",
  );
});
it("does not rewrite stale information, but keeps explicit manual editing, reset and feedback available", () => {
  const props = mount({ stale: true });
  expect(screen.getByText("stale", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Tạo bản đề xuất từ đánh giá này",
    }),
  ).toBeDisabled();
  expect(
    screen.queryByLabelText("Câu trả lời của bạn"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Giữ điểm chưa rõ và tự sửa thủ công",
    }),
  );
  expect(
    screen.getByText(
      /Các thông tin chưa trả lời sẽ giữ trạng thái chưa xác định/,
    ),
  ).toBeInTheDocument();
  expect(props.onRewrite).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Ghi nhận phản hồi chất lượng" }),
  ).toBeEnabled();
});
it("carries no answers by default and only sends the explicitly selected answer when resetting purpose", () => {
  const answer = {
    id: "answer-one",
    gapId: "gap-one",
    target: "Retry implementation",
    disposition: "answered" as const,
    answer: "Manual retry",
    purpose: "PROGRESS" as const,
    taskContextHash: "a".repeat(64),
  };
  const props = mount({ value: { ...assessmentFixture, answers: [answer] } });
  fireEvent.change(screen.getByLabelText("Mục đích của ghi chú này"), {
    target: { value: "HANDOVER" },
  });
  expect(
    screen.getByRole("button", { name: "Kiểm tra thông tin" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Bắt đầu phiên đánh giá mới" }),
  );
  expect(
    screen.getByRole("checkbox", {
      name: "Mang theo câu trả lời: Manual retry",
    }),
  ).not.toBeChecked();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Mang theo câu trả lời: Manual retry",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Bắt đầu với các câu trả lời đã chọn" }),
  );
  expect(props.onReset).toHaveBeenCalledWith("HANDOVER", ["answer-one"]);
});
it("routes claim correction independently from quality feedback and author validation", () => {
  const props = mount();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Đính chính phát biểu: The queue has not been tested.",
    }),
  );
  fireEvent.change(
    screen.getByLabelText("Giải thích điểm AI đã hiểu chưa đúng"),
    {
      target: {
        value: "The network-loss scenario is untested, not the entire queue.",
      },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Đánh giá lại với đính chính này" }),
  );
  expect(props.onCorrect).toHaveBeenCalledWith(
    "claim-one",
    "The network-loss scenario is untested, not the entire queue.",
  );
  fireEvent.change(screen.getByLabelText("Nhóm vấn đề"), {
    target: { value: "WRONG_SOURCE" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ghi nhận phản hồi chất lượng" }),
  );
  expect(props.onFeedback).toHaveBeenCalledWith("WRONG_SOURCE");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Tôi xác nhận nội dung này phản ánh đúng ghi chú của tôi",
    }),
  );
  expect(props.onValidate).toHaveBeenCalledOnce();
  expect(props.onRewrite).not.toHaveBeenCalled();
});
it("exposes paused state without asking again or treating the note as independently accepted", () => {
  mount({
    value: {
      ...assessmentFixture,
      state: "paused",
      nextQuestion: null,
      noteAdequacy: "UNDETERMINED",
      counters: { questionCount: 3, noProgress: 2 },
      allowedActions: ["rewrite", "reset", "manual", "feedback"],
    },
  });
  expect(screen.getByText("paused", { exact: true })).toBeInTheDocument();
  expect(screen.getByText(/Đã tạm dừng hỏi tự động/)).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Câu hỏi làm rõ đánh giá" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Tạo bản đề xuất từ đánh giá này",
    }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", {
      name: "Tôi xác nhận nội dung này phản ánh đúng ghi chú của tôi",
    }),
  ).toBeDisabled();
});
it("renders source text as plain text rather than executing model-supplied markup", () => {
  const value = structuredClone(assessmentFixture);
  value.claims[0].text = '<img src=x onerror="alert(1)">';
  mount({ value });
  expect(
    screen.getByText('<img src=x onerror="alert(1)">'),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("region", { name: "Kiểm tra thông tin theo Task" }),
    ).queryByRole("img"),
  ).not.toBeInTheDocument();
});

it("clearly separates adequate Progress note from incomplete overall Task criteria (Plan v3 §§1, 5)", () => {
  mount({
    value: {
      ...assessmentFixture,
      purpose: "PROGRESS",
      state: "ready_to_edit",
      taskContextStatus: "CLEAR",
      noteAdequacy: "ENOUGH_FOR_PURPOSE",
      gaps: [],
      nextQuestion: null,
      coverage: [
        {
          requirementId: "requirement-one",
          status: "PARTIAL",
          sourceRefs: [
            { sourceId: "note-body", quote: "We have not tested the queue." },
          ],
        },
      ],
      allowedActions: [
        "rewrite",
        "correct",
        "reset",
        "feedback",
        "manual",
        "validate_author",
      ],
    },
  });

  const conclusions = screen.getByRole("region", {
    name: "Ba kết luận đánh giá độc lập",
  });
  expect(within(conclusions).getByText("Độ rõ của Task")).toBeInTheDocument();
  expect(
    within(conclusions).getByText("Độ đầy đủ của ghi chú (Cập nhật tiến độ)"),
  ).toBeInTheDocument();
  expect(
    within(conclusions).getByText("Mức đáp ứng tiêu chí Task"),
  ).toBeInTheDocument();
  expect(
    within(conclusions).getByText("Đủ cho mục đích hiện tại"),
  ).toBeInTheDocument();
  expect(
    within(conclusions).getByText("Tiêu chí Task chưa hoàn tất"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Ghi chú này đã đủ thông tin cho mục đích Cập nhật tiến độ, dù các tiêu chí nghiệm thu tổng thể của Task vẫn chưa hoàn tất/,
    ),
  ).toBeInTheDocument();
});
