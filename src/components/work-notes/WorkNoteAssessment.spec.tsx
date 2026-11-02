import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import messages from "@/messages/vi.json";
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
    <NextIntlClientProvider locale="vi" messages={messages}>
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
    <NextIntlClientProvider locale="vi" messages={messages}>
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
it("shows the source note of a history-backed confirmation question and sends the one-click confirmation", () => {
  const value = structuredClone(assessmentFixture);
  value.nextQuestion = {
    ...value.nextQuestion!,
    text: 'Ghi chú ngày 31/10/2026: "Đã test trên staging.". Thông tin này còn đúng không?',
    options: ["Vẫn đúng như ghi chú cũ"],
    historyRef: {
      factId: "n1#0",
      noteId: "n1",
      noteTitle: "Tiến độ tuần 43",
      date: "2026-10-31",
      status: "OUTDATED",
      quote: "Đã test trên staging.",
    },
  };
  const props = mount({ value });
  const ref = screen.getByTestId("assessment-history-ref");
  expect(ref).toHaveTextContent("Từ ghi chú cũ “Tiến độ tuần 43” ngày 31/10/2026");
  expect(ref).toHaveTextContent("Có thể đã lỗi thời");
  fireEvent.click(screen.getByRole("button", { name: "Vẫn đúng như ghi chú cũ" }));
  expect(props.onReply).toHaveBeenCalledExactlyOnceWith(
    "answered",
    "Vẫn đúng như ghi chú cũ",
  );
});
it("shows localized workflow status, prioritizes the active question, and keeps deep-dive manifest/details collapsed by default", () => {
  mount();
  expect(screen.getByTestId("assessment-state-badge")).toHaveTextContent(
    "Cần làm rõ thêm",
  );
  expect(screen.queryByText("waiting_for_answer")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Câu trả lời của bạn")).toHaveFocus();

  const detailsAcc = screen.getByTestId("assessment-details-accordion");
  const sourcesAcc = screen.getByTestId("assessment-sources-accordion");
  const moreActionsAcc = screen.getByTestId(
    "assessment-more-actions-accordion",
  );
  expect(detailsAcc).not.toHaveAttribute("open");
  expect(sourcesAcc).not.toHaveAttribute("open");
  expect(moreActionsAcc).not.toHaveAttribute("open");

  fireEvent.click(screen.getByText(/Chi tiết đối chiếu/));
  fireEvent.click(screen.getByText(/Nguồn dữ liệu tham chiếu/));

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
  expect(screen.getByTestId("assessment-state-badge")).toHaveTextContent(
    "Cần kiểm tra lại",
  );
  expect(screen.queryByText("stale")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Câu trả lời của bạn"),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByText("Tùy chọn khác & Phản hồi"));
  expect(
    screen.getByRole("button", {
      name: "Tạo bản đề xuất từ đánh giá này",
    }),
  ).toBeDisabled();
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
  fireEvent.click(screen.getByText(/Chi tiết đối chiếu/));
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

  fireEvent.click(screen.getByText("Tùy chọn khác & Phản hồi"));
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
  expect(screen.getByTestId("assessment-state-badge")).toHaveTextContent(
    "Đã tạm dừng hỏi",
  );
  expect(screen.queryByText("paused")).not.toBeInTheDocument();
  expect(screen.getByText(/Đã tạm dừng hỏi tự động/)).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Câu hỏi làm rõ đánh giá" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Tạo bản đề xuất từ đánh giá này",
    }),
  ).toBeEnabled();

  fireEvent.click(screen.getByText("Tùy chọn khác & Phản hồi"));
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

it("renders English assessment copy when mounted with en.json", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WorkNoteAssessment
        value={structuredClone(assessmentFixture)}
        busy={false}
        stale={false}
        onAssess={vi.fn()}
        onReply={vi.fn()}
        onRewrite={vi.fn()}
        onCorrect={vi.fn()}
        onReset={vi.fn()}
        onValidate={vi.fn()}
        onFeedback={vi.fn()}
      />
    </NextIntlClientProvider>,
  );

  expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Send answer" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("region", {
      name: "Three independent evaluation dimensions",
    }),
  ).toBeInTheDocument();
});


it("renders HISTORY sources, Task keys & relations, dates, masked quotes, and distinguishes OUTDATED, SUPERSEDED, and CONFLICT statuses", () => {
  const value = structuredClone(assessmentFixture);
  value.contextManifest.sources.push(
    {
      id: "history.self-conflict",
      kind: "HISTORY",
      label: "Historical note: Sprint 2",
      text: "Đã test với [[WN_SEC:API_KEY:a1b2c3d4e5f6]].",
      version: "2026-10-28:CONFLICT_CURRENT",
      loadStatus: "LOADED",
      includedInRequest: true,
      history: {
        factId: "n1#0",
        noteId: "n1",
        noteTitle: "Sprint 2",
        date: "2026-10-28",
        relation: "SELF",
        factStatus: "CONFLICT_CURRENT",
      },
    },
    {
      id: "history.parent-outdated",
      kind: "HISTORY",
      label: "Historical note (PARENT OPS-10): Kiến trúc queue",
      text: "Queue dùng RabbitMQ bản cũ.",
      version: "2026-09-15:OUTDATED",
      loadStatus: "LOADED",
      includedInRequest: true,
      history: {
        factId: "n2#0",
        noteId: "n2",
        noteTitle: "Kiến trúc queue",
        date: "2026-09-15",
        relation: "PARENT",
        taskKey: "OPS-10",
        factStatus: "OUTDATED",
      },
    },
    {
      id: "history.child-superseded",
      kind: "HISTORY",
      label: "Historical note (CHILD OPS-12): Worker retry",
      text: "Retry tối đa 2 lần.",
      version: "2026-10-20:SUPERSEDED",
      loadStatus: "LOADED",
      includedInRequest: true,
      history: {
        factId: "n3#0",
        noteId: "n3",
        noteTitle: "Worker retry",
        date: "2026-10-20",
        relation: "CHILD",
        taskKey: "OPS-12",
        factStatus: "SUPERSEDED",
      },
    },
  );
  value.claims.push({
    id: "claim-history-parent",
    text: "Queue dùng RabbitMQ bản cũ.",
    sourceRefs: [
      {
        sourceId: "history.parent-outdated",
        quote: "Queue dùng RabbitMQ bản cũ.",
      },
    ],
    originKind: "HISTORICAL_REPORT",
    supportRelation: "RELATED_ONLY",
    verificationStatus: "NOT_INDEPENDENTLY_VERIFIED",
    history: {
      relation: "PARENT",
      taskKey: "OPS-10",
      date: "2026-09-15",
      noteTitle: "Kiến trúc queue",
      factStatus: "OUTDATED",
    },
  });
  value.gaps.push(
    {
      id: "gap-hist-conflict",
      kind: "HISTORICAL_CONFLICT",
      target: "Mâu thuẫn trạng thái test với Sprint 2",
      impact: "OPTIONAL",
      owner: "NOTE_AUTHOR",
      status: "open",
      sourceRefs: [
        {
          sourceId: "history.self-conflict",
          quote: "Đã test với [[WN_SEC:API_KEY:a1b2c3d4e5f6]].",
        },
      ],
    },
    {
      id: "gap-hist-outdated",
      kind: "OUTDATED_INFO",
      target: "Thông tin RabbitMQ từ tháng 9",
      impact: "OPTIONAL",
      owner: "NOTE_AUTHOR",
      status: "open",
      sourceRefs: [
        {
          sourceId: "history.parent-outdated",
          quote: "Queue dùng RabbitMQ bản cũ.",
        },
      ],
    },
  );

  mount({ value });

  const manifestItems = screen.getAllByTestId(
    "assessment-manifest-history-item",
  );
  expect(manifestItems).toHaveLength(3);
  expect(manifestItems[0]).toHaveTextContent("Nguồn lịch sử");
  expect(manifestItems[0]).toHaveTextContent("Cùng Task");
  expect(manifestItems[0]).toHaveTextContent("Ngày 28/10/2026");
  expect(manifestItems[0]).toHaveTextContent(
    "Mâu thuẫn với ghi chú đang viết",
  );
  expect(manifestItems[0]).toHaveTextContent("Đã test với 🔒 API key.");
  expect(manifestItems[0]).not.toHaveTextContent("[[WN_SEC:");

  expect(manifestItems[1]).toHaveTextContent("Task cha · OPS-10");
  expect(manifestItems[1]).toHaveTextContent("Ngày 15/09/2026");
  expect(manifestItems[1]).toHaveTextContent("Có thể đã lỗi thời");

  expect(manifestItems[2]).toHaveTextContent("Task con · OPS-12");
  expect(manifestItems[2]).toHaveTextContent("Ngày 20/10/2026");
  const supersededPill = within(manifestItems[2]).getByTestId(
    "assessment-history-status-SUPERSEDED",
  );
  expect(supersededPill).toHaveTextContent("Đã có thông tin mới hơn");
  expect(supersededPill.className).toContain("line-through");

  const histClaim = screen.getByTestId("assessment-historical-claim");
  expect(histClaim).toHaveTextContent(
    "Ghi nhận lịch sử (không phải bằng chứng hiện tại)",
  );
  expect(histClaim).toHaveTextContent("Task cha · OPS-10");

  const conflictGap = screen.getByTestId("assessment-gap-HISTORICAL_CONFLICT");
  expect(conflictGap).toHaveTextContent("Mâu thuẫn với lịch sử");
  expect(conflictGap).toHaveTextContent("Đã test với 🔒 API key.");

  const outdatedGap = screen.getByTestId("assessment-gap-OUTDATED_INFO");
  expect(outdatedGap).toHaveTextContent("Thông tin lịch sử đã cũ");
});

it("renders historical source, claim origin, and gapKind badges in English locale", () => {
  const value = structuredClone(assessmentFixture);
  value.contextManifest.sources.push({
    id: "history.linked",
    kind: "HISTORY",
    label: "Linked note",
    text: "Linked staging port 8081.",
    version: "2026-10-10:OUTDATED",
    loadStatus: "LOADED",
    includedInRequest: true,
    history: {
      factId: "n9#0",
      noteId: "n9",
      noteTitle: "Linked note",
      date: "2026-10-10",
      relation: "LINKED",
      taskKey: "OPS-77",
      factStatus: "OUTDATED",
    },
  });
  value.claims.push({
    id: "claim-hist-en",
    text: "Linked staging port 8081.",
    sourceRefs: [
      { sourceId: "history.linked", quote: "Linked staging port 8081." },
    ],
    originKind: "HISTORICAL_REPORT",
    supportRelation: "RELATED_ONLY",
    verificationStatus: "NOT_INDEPENDENTLY_VERIFIED",
    history: {
      relation: "LINKED",
      taskKey: "OPS-77",
      date: "2026-10-10",
      noteTitle: "Linked note",
      factStatus: "OUTDATED",
    },
  });
  value.gaps.push({
    id: "gap-hist-en",
    kind: "HISTORICAL_CONFLICT",
    target: "Port mismatch",
    impact: "OPTIONAL",
    owner: "NOTE_AUTHOR",
    status: "open",
    sourceRefs: [
      { sourceId: "history.linked", quote: "Linked staging port 8081." },
    ],
  });

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WorkNoteAssessment
        value={value}
        busy={false}
        stale={false}
        onAssess={vi.fn()}
        onReply={vi.fn()}
        onRewrite={vi.fn()}
        onCorrect={vi.fn()}
        onReset={vi.fn()}
        onValidate={vi.fn()}
        onFeedback={vi.fn()}
      />
    </NextIntlClientProvider>,
  );

  expect(screen.getAllByText("Historical source").length).toBeGreaterThan(0);
  expect(
    screen.getAllByText(/Linked Task · OPS-77|Linked task · OPS-77/i).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByText(/Historical record \(not current evidence\)/),
  ).toBeInTheDocument();
  expect(screen.getByText("Historical conflict")).toBeInTheDocument();
});

it("formats server-masked [[WN_SEC:...]] placeholders in assessment question text, historyRef title, and carry-over answers", () => {
  const value = structuredClone(assessmentFixture);
  value.nextQuestion = {
    id: "q-masked",
    gapId: value.gaps[0].id,
    text: "Cấu hình [[WN_SEC:CONNECTION_STRING:0123456789ab]] từ ghi chú trước còn áp dụng không?",
    reason: "Tránh hỏi lại [[WN_SEC:PASSWORD:abcdef012345]]",
    options: ["Giữ [[WN_SEC:TOKEN:112233445566]]", "Đã đổi mới"],
    historyRef: {
      factId: "n1#0",
      noteId: "n1",
      noteTitle: " Triển khai [[WN_SEC:EMAIL:998877665544]]",
      date: "2026-10-30",
      status: "CURRENT",
    },
  };

  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <WorkNoteAssessment
        value={value}
        busy={false}
        stale={false}
        onAssess={vi.fn()}
        onReply={vi.fn()}
        onRewrite={vi.fn()}
        onCorrect={vi.fn()}
        onReset={vi.fn()}
        onValidate={vi.fn()}
        onFeedback={vi.fn()}
      />
    </NextIntlClientProvider>,
  );

  const region = screen.getByRole("region", {
    name: "Kiểm tra thông tin theo Task",
  });
  expect(region).not.toHaveTextContent("WN_SEC");
  expect(region).toHaveTextContent("🔒 mật khẩu kết nối");
  expect(region).toHaveTextContent("🔒 mật khẩu");
  expect(region).toHaveTextContent("🔒 token");
  expect(region).toHaveTextContent("🔒 email");
});
