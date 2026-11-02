import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/vi.json";
import WorkNoteSecurityNotice, {
  SecurityShieldBanner,
  detectPreSendSensitiveData,
  formatMaskedSensitiveText,
} from "./WorkNoteSecurityNotice";
import WorkNoteAgentChat, {
  isOtherOption,
  parseClarificationQuestion,
} from "./WorkNoteAgentChat";
import { assessmentFixture } from "./assessment.test-fixture";
import type { AgentDraft } from "@/lib/queries/work-notes/work-note-agent.api";

describe("WorkNoteSecurityNotice & pre-send sensitive data detection", () => {
  it("flags weak real passwords like Password123! and non-dummy secrets while ignoring exact placeholders", () => {
    expect(detectPreSendSensitiveData(["password = <password>"])).toBeNull();
    expect(detectPreSendSensitiveData(["api_key = YOUR_API_KEY"])).toBeNull();

    const weakPwd = detectPreSendSensitiveData(["password = Password123!"]);
    expect(weakPwd?.categories).toContain("PASSWORD");
    expect(weakPwd?.blocked).toBe(false);

    const prefixedSecret = detectPreSendSensitiveData([
      "client_secret: myProdSecret99!",
    ]);
    expect(prefixedSecret?.categories).toContain("CREDENTIAL");
  });

  it("scans all occurrences when a dummy token precedes a real secret or username-less URI", () => {
    const bearerScan = detectPreSendSensitiveData([
      "Ví dụ: Authorization: Bearer <token>\nThực tế: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9_realTokenValue99",
    ]);
    expect(bearerScan?.categories).toContain("TOKEN");

    const redisScan = detectPreSendSensitiveData([
      "redis://:RealCacheSecret99!@cache.internal:6379/0",
    ]);
    expect(redisScan?.categories).toContain("CONNECTION_STRING");

    const basicAndCookie = detectPreSendSensitiveData([
      "Authorization: Basic dXNlcjpzdXBlclNlY3JldDk5IQ==\nSet-Cookie: session_id=realSessionCookieValue123456",
    ]);
    expect(basicAndCookie?.categories).toContain("TOKEN");
  });

  it("detects Luhn-valid bank cards, 12-digit CCCD, and blocks PEM private keys", () => {
    const cardAndCccd = detectPreSendSensitiveData([
      "Thẻ test: 4532 0151 1283 0366, CCCD: 079099001234",
    ]);
    expect(cardAndCccd?.categories).toContain("BANK_CARD");
    expect(cardAndCccd?.categories).toContain("NATIONAL_ID");
    expect(cardAndCccd?.blocked).toBe(false);

    const pem = detectPreSendSensitiveData([
      "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE=",
    ]);
    expect(pem?.blocked).toBe(true);
    expect(pem?.categories).toContain("PRIVATE_KEY");
  });

  it("formats [[WN_SEC:CATEGORY:hash]] placeholders into friendly lock labels and renders notice banners", () => {
    const formatted = formatMaskedSensitiveText(
      "Đã cấu hình [[WN_SEC:API_KEY:0123456789ab]] và [[WN_SEC:EMAIL:abcdef012345]].",
      (cat) => (cat === "API_KEY" ? "API Key" : "email"),
    );
    expect(formatted).toBe("Đã cấu hình 🔒 API Key và 🔒 email.");

    render(
      <NextIntlClientProvider locale="vi" messages={messages}>
        <WorkNoteSecurityNotice
          scan={{ blocked: false, categories: ["API_KEY", "PASSWORD"] }}
        />
        <SecurityShieldBanner
          report={{
            mode: "enforce",
            input: {
              decision: "MASKED",
              maskedValues: 2,
              findings: [
                {
                  ruleId: "OPENAI_API_KEY",
                  category: "API_KEY",
                  severity: "HIGH",
                  count: 1,
                },
                {
                  ruleId: "GENERIC_PASSWORD",
                  category: "PASSWORD",
                  severity: "HIGH",
                  count: 1,
                },
              ],
            },
            output: {
              decision: "PASS",
              unmasked: 0,
              issues: [],
            },
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("agent-presend-security-notice")).toHaveTextContent(
      "API key",
    );
    expect(screen.getByTestId("agent-security-shield")).toHaveTextContent(
      "API key",
    );
  });
});

describe("parseClarificationQuestion edge cases", () => {
  it("preserves quoted numbered lists in historical confirmation questions without splitting or truncating", () => {
    const parsed = parseClarificationQuestion({
      text: 'Ghi chú trước nêu "1. Auth 2. API", thông tin này còn đúng không?',
      options: ["Vẫn đúng cho lần này", "Đã thay đổi — để tôi cập nhật"],
      historyRef: {
        factId: "n1#0",
        noteId: "n1",
        noteTitle: "Ghi chú cũ",
        date: "2026-10-31",
        status: "CURRENT",
      },
    });
    expect(parsed.targetItems).toEqual([]);
    expect(parsed.choiceMode).toBe("single");
    expect(parsed.prompt).toBe(
      'Ghi chú trước nêu "1. Auth 2. API", thông tin này còn đúng không?',
    );
  });

  it("extracts numbered target items when options are provided separately, while stripping echoed option lists", () => {
    const multiTarget = parseClarificationQuestion({
      text: "Các mục sau đang ở trạng thái nào?\n1. Module Auth\n2. Module Payment",
      options: ["Chưa bắt đầu", "Đang thực hiện", "Đã hoàn thành"],
    });
    expect(multiTarget.prompt).toBe("Các mục sau đang ở trạng thái nào?");
    expect(multiTarget.targetItems).toEqual([
      { number: 1, label: "Module Auth" },
      { number: 2, label: "Module Payment" },
    ]);
    expect(multiTarget.choiceMode).toBe("matrix");

    const echoed = parseClarificationQuestion({
      text: "Bạn chọn môi trường nào? Ví dụ: 1. Staging 2. Production",
      options: ["Staging", "Production"],
    });
    expect(echoed.prompt).toBe("Bạn chọn môi trường nào?");
    expect(echoed.targetItems).toEqual([]);
    expect(echoed.choiceMode).toBe("single");
  });

  it("keeps targetItems with choiceMode='none' for open-ended numbered sub-questions", () => {
    const openNumbered = parseClarificationQuestion({
      text: "Vui lòng bổ sung chi tiết:\n1. Nguyên nhân lỗi gốc?\n2. Cách phòng tránh tái diễn?",
      options: [],
    });
    expect(openNumbered.choiceMode).toBe("none");
    expect(openNumbered.targetItems).toHaveLength(2);
    expect(openNumbered.prompt).toBe("Vui lòng bổ sung chi tiết:");
  });

  it("distinguishes true 'Khác'/'Other' options from domain choices like 'Khách hàng...' or 'Otherwise...'", () => {
    expect(isOtherOption("Khách hàng đã xác nhận")).toBe(false);
    expect(isOtherOption("Khách báo lỗi trên staging")).toBe(false);
    expect(isOtherOption("Otherwise keep current retry")).toBe(false);
    expect(isOtherOption("Other team approved")).toBe(false);

    expect(isOtherOption("Khác")).toBe(true);
    expect(isOtherOption("Khác...")).toBe(true);
    expect(isOtherOption("Khác (nhập thêm)")).toBe(true);
    expect(isOtherOption("Khác: ghi rõ")).toBe(true);
    expect(isOtherOption("Nội dung khác")).toBe(true);
    expect(isOtherOption("Ý kiến khác")).toBe(true);
    expect(isOtherOption("Other")).toBe(true);
    expect(isOtherOption("Other (specify)")).toBe(true);
    expect(isOtherOption("Something else")).toBe(true);
  });

  it("renders 'Khách hàng đã xác nhận' and 'Otherwise...' as selectable options in Chat without leaking Assessment gap counters", () => {
    const onSend = vi.fn();
    const draftWithAssessmentAndChatQuestion: AgentDraft = {
      id: "f081a006-489c-4a50-a0df-a54567fdc01b",
      taskId: "6ad7758334bd88b3f2cc844b",
      noteId: null,
      workflow: "TASK_NOTE",
      baseNoteVersion: 0,
      revision: 1,
      title: "Tiến độ kiểm thử",
      contentMarkdown: "Đã xử lý phản hồi từ khách hàng.",
      expiresAt: "2099-01-01T00:00:00.000Z",
      hasAppliedRewrite: false,
      conversation: [],
      suggestion: null,
      pendingQuestion: {
        id: "q-chat-1",
        text: "Ai đã xác nhận kết quả kiểm thử?",
        reason: "Cần ghi rõ nguồn xác nhận.",
        options: ["Khách hàng đã xác nhận", "Otherwise keep internal QA"],
      },
      assessment: {
        ...assessmentFixture,
        gaps: [
          assessmentFixture.gaps[0],
          {
            ...assessmentFixture.gaps[0],
            id: "gap-two",
            status: "answered",
          },
          {
            ...assessmentFixture.gaps[0],
            id: "gap-three",
            status: "open",
          },
        ],
      },
    };

    render(
      <NextIntlClientProvider locale="vi" messages={messages}>
        <WorkNoteAgentChat
          draft={draftWithAssessmentAndChatQuestion}
          before={{
            title: draftWithAssessmentAndChatQuestion.title,
            contentMarkdown: draftWithAssessmentAndChatQuestion.contentMarkdown,
          }}
          selectionPromptQuote={null}
          suggestion={null}
          suggestionStale={false}
          busy={false}
          thinking={false}
          message=""
          onMessage={vi.fn()}
          onQuickOption={vi.fn()}
          onSend={onSend}
          onApplySuggestion={vi.fn()}
          onDismissSuggestion={vi.fn()}
          onRegenerateSuggestion={vi.fn()}
          onReset={vi.fn()}
          inputRef={createRef<HTMLTextAreaElement>()}
        />
      </NextIntlClientProvider>,
    );

    // Must NOT borrow 2/3 counter from draft.assessment.gaps for an independent Chat pendingQuestion
    expect(screen.queryByText("2/3")).not.toBeInTheDocument();

    // Both domain choices must preserve their full labels rather than turning into "Khác"
    const customerRadio = screen.getByRole("radio", {
      name: /Khách hàng đã xác nhận/,
    });
    expect(customerRadio).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Otherwise keep internal QA/ }),
    ).toBeVisible();

    // Selecting "Khách hàng đã xác nhận" submits directly without requiring custom "Khác" text
    expect(
      screen.getByRole("radio", { name: /Khác \(nhập chi tiết\)/ }),
    ).toBeVisible();
    fireEvent.click(customerRadio);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(onSend).toHaveBeenCalledWith("Khách hàng đã xác nhận", "answered");
  });
});
