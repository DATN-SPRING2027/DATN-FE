import { describe, expect, it } from "vitest";
import {
  computeReadableDiff,
  type ReadableDiffResult,
} from "./work-note-diff";

function assertExactReconstruction(
  before: string,
  after: string,
  diff: ReadableDiffResult,
) {
  const reconstructedBefore = diff.segments
    .filter((seg) => seg.type !== "insert")
    .map((seg) => seg.text)
    .join("");
  const reconstructedAfter = diff.segments
    .filter((seg) => seg.type !== "delete")
    .map((seg) => seg.text)
    .join("");

  expect(reconstructedBefore).toBe(before.replace(/\r\n?/g, "\n"));
  expect(reconstructedAfter).toBe(after.replace(/\r\n?/g, "\n"));
}

describe("computeReadableDiff", () => {
  it("highlights Vietnamese edits clearly while preserving unchanged lines", () => {
    const before =
      "Phần xử lý thu hồi phiên khi đổi quyền của user hiện tại đang viết hơi rối, chưa chốt rõ nên dùng userFence tăng dần hay quét xoá trực tiếp trong bảng refresh_tokens.\n" +
      "- Chưa mô tả chi tiết kịch bản rate-limit trên Redis và cấu trúc bản ghi audit_logs_iam theo yêu cầu của task.";
    const after =
      "Phần xử lý thu hồi phiên khi thay đổi quyền của người dùng hiện chưa rõ chiến lược cụ thể:\n" +
      "- Dự kiến sử dụng userFence tăng dần hoặc quét xoá trực tiếp trong bảng refresh_tokens.\n" +
      "- Chưa mô tả chi tiết kịch bản rate-limit trên Redis và cấu trúc bản ghi audit_logs_iam theo yêu cầu của task.";

    const diff = computeReadableDiff(before, after);

    assertExactReconstruction(before, after, diff);
    expect(diff.isNewContent).toBe(false);
    expect(diff.isIdentical).toBe(false);
    expect(diff.changedBlocks).toBeGreaterThan(0);
    expect(diff.addedWords).toBeGreaterThan(0);
    expect(diff.removedWords).toBeGreaterThan(0);

    const equalCombined = diff.segments
      .filter((seg) => seg.type === "equal")
      .map((seg) => seg.text)
      .join("");
    expect(equalCombined).toContain(
      "- Chưa mô tả chi tiết kịch bản rate-limit trên Redis và cấu trúc bản ghi audit_logs_iam theo yêu cầu của task.",
    );
  });

  it("coalesces adjacent multi-word replacements separated by spaces into one readable phrase block", () => {
    const before = "We have not tested the queue.";
    const after = "We have pending verification the queue.";

    const diff = computeReadableDiff(before, after);

    assertExactReconstruction(before, after, diff);
    expect(diff.changedBlocks).toBe(1);
    expect(diff.segments).toEqual([
      { type: "equal", text: "We have " },
      { type: "delete", text: "not tested" },
      { type: "insert", text: "pending verification" },
      { type: "equal", text: " the queue." },
    ]);
  });

  it("marks brand-new generated content when original text is empty", () => {
    const after = "## Tóm tắt tiến độ\n- Hoàn thành API xác thực";
    const diff = computeReadableDiff("   ", after);

    expect(diff.isNewContent).toBe(true);
    expect(diff.isIdentical).toBe(false);
    expect(diff.changedBlocks).toBe(1);
    expect(diff.removedWords).toBe(0);
    expect(diff.addedWords).toBeGreaterThan(0);
    expect(diff.segments).toEqual([{ type: "insert", text: after }]);
  });

  it("normalizes CRLF line endings and detects identical content", () => {
    const diff = computeReadableDiff("Dòng 1\r\nDòng 2", "Dòng 1\nDòng 2");

    expect(diff.isIdentical).toBe(true);
    expect(diff.isNewContent).toBe(false);
    expect(diff.changedBlocks).toBe(0);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });

  it("handles large multi-line notes above the token matrix cap without losing exact text", () => {
    const linesBefore = Array.from(
      { length: 180 },
      (_, idx) => `- Mục kiểm thử số ${idx + 1}: giữ nguyên nội dung hệ thống.`,
    );
    const linesAfter = [...linesBefore];
    linesAfter[90] =
      "- Mục kiểm thử số 91: đã cập nhật kết quả benchmark mới trên Redis.";

    const before = linesBefore.join("\n");
    const after = linesAfter.join("\n");
    const diff = computeReadableDiff(before, after);

    assertExactReconstruction(before, after, diff);
    expect(diff.isIdentical).toBe(false);
    expect(diff.changedBlocks).toBeGreaterThan(0);
  });
});

