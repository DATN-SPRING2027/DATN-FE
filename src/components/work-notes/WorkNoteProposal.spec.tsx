import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import viMessages from "@/messages/vi.json";
import WorkNoteProposal from "./WorkNoteProposal";

describe("WorkNoteProposal", () => {
  it("renders noChangesSummary message instead of an empty list when changeSummary is empty", () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <WorkNoteProposal
          suggestion={{
            id: "sug-1",
            scope: "whole_note",
            operation: "custom",
            baseRevision: 1,
            replacementText: "Ghi chú đã rõ ràng, không cần chỉnh sửa.",
            suggestedTitle: null,
            changeSummary: [],
          }}
          before={{
            title: "Ghi chú tham chiếu",
            contentMarkdown: "Ghi chú đã rõ ràng, không cần chỉnh sửa.",
          }}
          stale={false}
          busy={false}
          onApply={vi.fn()}
          onDismiss={vi.fn()}
          onRegenerate={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Không có thay đổi")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

