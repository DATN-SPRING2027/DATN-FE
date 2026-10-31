import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { AiChatCitation } from "@/lib/queries/ai-chat/ai-chat.types";
import { workNotesApi } from "@/lib/queries/work-notes/useWorkNotes";
import AiChatEvidenceSheet, {
  resetEvidenceSheetCachesForTests,
} from "./AiChatEvidenceSheet";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AiChatEvidenceSheet — Source Reader Studio", () => {
  beforeEach(() => {
    resetEvidenceSheetCachesForTests();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  const citation1: AiChatCitation = {
    number: 1,
    sourceId: "src-1",
    documentId: "507f1f77bcf86cd799439011",
    documentName: "04-team-membership-workspace-fe-contract.md",
    versionNo: 1,
    pageFrom: 1,
    heading:
      "[RESEARCH] Workspace - Team Membership & Workspace FE Contract > Evidence classification",
    snippet: [
      "[RESEARCH] Workspace - Team Membership & Workspace FE Contract",
      "",
      "Evidence classification",
      "",
      "- `[FACT]`: directly verified in source.",
      "- `[IMPLEMENTED]`: executable classification behavior exists.",
    ].join("\n"),
  };

  const citation2: AiChatCitation = {
    number: 2,
    sourceId: "src-2",
    documentId: "507f1f77bcf86cd799439022",
    documentName: "03-team-membership-security-rbac.md",
    versionNo: 3,
    pageFrom: 2,
    pageTo: 4,
    heading: "Security > RBAC Enforcement",
    snippet: "RBAC Enforcement applies default-deny checks at BFF.",
  };

  it("deduplicates repeated section headings, styles code pills, toggles highlights, switches source tabs, and links via ?documentId=", () => {
    const onClose = vi.fn();

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatEvidenceSheet
          evidence={{
            kind: "document",
            citation: citation1,
            focusLabel: "Evidence classification",
            focusTerms: ["Evidence classification"],
            relatedCitations: [citation1, citation2],
          }}
          projectId="proj-1"
          onClose={onClose}
        />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("dialog", { name: "Source evidence details" }),
    ).toBeTruthy();

    // Section leaf heading appears once in the unified card header (never duplicated as first bullet/paragraph)
    expect(screen.getAllByText("Evidence classification")).toHaveLength(1);
    expect(
      screen.getAllByText(
        "[RESEARCH] Workspace - Team Membership & Workspace FE Contract",
      ),
    ).toHaveLength(1);

    // Inline `[FACT]` and `[IMPLEMENTED]` are styled as code pills without raw backticks
    const codePills = screen.getAllByTestId("evidence-code-pill");
    expect(codePills.map((el) => el.textContent)).toEqual([
      "[FACT]",
      "[IMPLEMENTED]",
    ]);

    // Phrase-aware focus terms are highlighted and can be toggled off/on cleanly
    expect(
      screen.getAllByTestId("evidence-highlight-mark").length,
    ).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByTestId("evidence-toggle-highlight"));
    expect(screen.queryAllByTestId("evidence-highlight-mark")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("evidence-toggle-highlight"));
    expect(
      screen.getAllByTestId("evidence-highlight-mark").length,
    ).toBeGreaterThanOrEqual(1);

    // Switch to tab [2] and verify valid ?documentId= deep-link route
    fireEvent.click(screen.getByTestId("evidence-tab-2"));
    expect(screen.getByText("p. 2–4")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Open document/i }).getAttribute("href"),
    ).toBe(
      "/projects/proj-1/documents?documentId=507f1f77bcf86cd799439022",
    );
  });

  it("renders callouts & ASCII blueprint diagrams cleanly and never splits Vietnamese compound words like 'tri thức'", () => {
    const vietnameseDiagramCitation: AiChatCitation = {
      number: 4,
      sourceId: "src-fe",
      documentId: "507f1f77bcf86cd799439044",
      documentName: "02_FRONTEND_NEXTJS.md",
      versionNo: 1,
      pageFrom: 1,
      heading:
        "Continuum AI — Kiến Trúc Frontend Next.js (App Router) > 6. Trực Quan Hóa Vũ Trụ Tri Thức 3D (Interactive 3D Knowledge Universe Canvas)",
      snippet: [
        "## 6. Trực Quan Hóa Vũ Trụ Tri Thức 3D (Interactive 3D Knowledge Universe Canvas)",
        "",
        "> ⭐ **ĐIỂM NHẤN CỐT LÕI (WOW FACTOR) CỦA ĐỒ ÁN TỐT NGHIỆP:**",
        "> Thay vì xem tri thức dưới dạng bảng phẳng hay danh sách văn bản nhàm chán, Continuum AI biến toàn bộ tri thức kỹ thuật thành Vũ Trụ 3D.",
        "",
        "```",
        "┌──────────────────────────────────────────────────────────────┐",
        "│              3D KNOWLEDGE GALAXY CLIENT PIPELINE             │",
        "├──────────────────────────────────────────────────────────────┤",
        "│  [ Backend NestJS / BFF Proxy ] ──(GET /api/v1/universe)     │",
        "└──────────────────────────────────────────────────────────────┘",
        "```",
      ].join("\n"),
    };

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatEvidenceSheet
          evidence={{
            kind: "document",
            citation: vietnameseDiagramCitation,
          }}
          projectId="proj-1"
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    // Callout blockquote & monospace architecture diagram block are rendered distinctly
    expect(screen.getByTestId("evidence-callout-block")).toBeTruthy();
    const diagramBlock = screen.getByTestId("evidence-code-block");
    expect(diagramBlock.textContent).toContain("ARCHITECTURE DIAGRAM");
    expect(diagramBlock.textContent).toContain(
      "3D KNOWLEDGE GALAXY CLIENT PIPELINE",
    );

    // Verify no broken 1-syllable Vietnamese highlight ("thức" alone must never be highlighted)
    const marks = screen
      .queryAllByTestId("evidence-highlight-mark")
      .map((el) => el.textContent?.trim().toLowerCase());
    expect(marks).not.toContain("thức");
    expect(marks).not.toContain("vũ");
    expect(marks).not.toContain("trụ");
  });

  it("hydrates full uncut canonical chunk + expandable prev/next passages and supports drawer width controls", async () => {
    const projectId = "507f1f77bcf86cd799439099";
    const resolvedContinuumId = "507f1f77bcf86cd799439088";

    vi.spyOn(workNotesApi, "listDocuments").mockResolvedValue({
      data: [
        {
          id: resolvedContinuumId,
          projectId,
          title: "02_FRONTEND_NEXTJS.md",
          type: "ARCHITECTURE",
          version: 1,
          status: "APPROVED",
          createdBy: "507f1f77bcf86cd799439001",
          createdAt: "2026-10-30T00:00:00.000Z",
          updatedAt: "2026-10-30T00:00:00.000Z",
          file: {
            name: "02_FRONTEND_NEXTJS.md",
            contentType: "text/markdown",
            size: 4096,
          },
          permissions: {
            canCreate: true,
            canEdit: true,
            canSubmit: true,
            canReview: true,
            canConfigure: true,
          },
          knowledgeSync: {
            documentId: resolvedContinuumId,
            version: 1,
            status: "READY",
            sagDocumentId: "c1b2a3d4-0000-4000-8000-111122223333",
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 50,
        totalItems: 1,
        totalPages: 1,
      },
    });

    vi.spyOn(workNotesApi, "getDocumentKnowledgeChunks").mockResolvedValue({
      documentId: resolvedContinuumId,
      version: 1,
      sagDocumentId: "c1b2a3d4-0000-4000-8000-111122223333",
      sagVersionNo: 1,
      sourceStage: "SEARCH_UNITS",
      totalChunks: 3,
      totalTokens: 116,
      items: [
        {
          chunkId: "chunk-0",
          ordinal: 0,
          sectionPath: "5. AI Chat Streaming",
          blockType: "PARAGRAPH",
          pageFrom: 1,
          pageTo: 1,
          content: "Preceding canonical section about SSE streaming.",
          tokenCount: 24,
        },
        {
          chunkId: "chunk-1",
          ordinal: 1,
          sectionPath: "6. 3D Knowledge Galaxy",
          blockType: "PARAGRAPH",
          pageFrom: 1,
          pageTo: 1,
          content:
            "Full uncut canonical chunk body with complete architecture pipeline details.",
          tokenCount: 64,
        },
        {
          chunkId: "chunk-2",
          ordinal: 2,
          sectionPath: "7. Security & CSP",
          blockType: "PARAGRAPH",
          pageFrom: 1,
          pageTo: 1,
          content: "Following canonical section about strict CSP headers.",
          tokenCount: 28,
        },
      ],
    });

    // Citation arrives with legacy SAG UUID instead of 24-hex ObjectId
    const legacyUuidCitation: AiChatCitation = {
      number: 1,
      sourceId: "src-uuid",
      documentId: "c1b2a3d4-0000-4000-8000-111122223333",
      documentName: "02_FRONTEND_NEXTJS.md",
      chunkId: "chunk-1",
      heading: "6. 3D Knowledge Galaxy",
      snippet: "Truncated snippet…",
    };

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatEvidenceSheet
          evidence={{
            kind: "document",
            citation: legacyUuidCitation,
          }}
          projectId={projectId}
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Full uncut canonical chunk body with complete architecture pipeline details.",
        ),
      ).toBeTruthy();
    });

    // Resolved Continuum ObjectId enables "Open document" link even when citation came with SAG UUID
    expect(
      screen.getByRole("link", { name: /Open document/i }).getAttribute("href"),
    ).toBe(
      `/projects/${projectId}/documents?documentId=${resolvedContinuumId}`,
    );

    // Expand preceding & following passages
    fireEvent.click(screen.getByTestId("evidence-prev-chunk-toggle"));
    expect(
      screen.getByText("Preceding canonical section about SSE streaming."),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("evidence-next-chunk-toggle"));
    expect(
      screen.getByText("Following canonical section about strict CSP headers."),
    ).toBeTruthy();

    // Desktop drawer width toggle & keyboard resize on 1440px viewport
    Object.defineProperty(window, "innerWidth", {
      value: 1440,
      configurable: true,
      writable: true,
    });
    const dialog = screen.getByTestId("ai-chat-evidence-sheet");
    expect(dialog.style.getPropertyValue("--evidence-drawer-width")).toBe(
      "540px",
    );
    fireEvent.click(screen.getByTestId("evidence-width-toggle"));
    expect(dialog.style.getPropertyValue("--evidence-drawer-width")).toBe(
      "740px",
    );
    fireEvent.keyDown(screen.getByTestId("evidence-resize-handle"), {
      key: "ArrowRight",
    });
    expect(dialog.style.getPropertyValue("--evidence-drawer-width")).toBe(
      "716px",
    );
  });
});
