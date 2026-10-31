import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { AiChatCitation } from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatEvidenceSheet from "./AiChatEvidenceSheet";

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

describe("AiChatEvidenceSheet — structured excerpt formatting, keyword highlighting & source tabs", () => {
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

  it("renders section breadcrumbs, styles inline code pills, highlights focus keywords, and switches source tabs", () => {
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

    // Inline `[FACT]` and `[IMPLEMENTED]` are styled as code pills without raw backticks
    const codePills = screen.getAllByTestId("evidence-code-pill");
    expect(codePills.map((el) => el.textContent)).toEqual([
      "[FACT]",
      "[IMPLEMENTED]",
    ]);

    // Focus terms ("Evidence classification" / "classification") are highlighted with <mark>
    expect(
      screen.getAllByTestId("evidence-highlight-mark").length,
    ).toBeGreaterThanOrEqual(1);

    // Switch to tab [2]
    fireEvent.click(screen.getByTestId("evidence-tab-2"));
    expect(screen.getByText("p. 2–4")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Open document/i }).getAttribute("href"),
    ).toBe("/projects/proj-1/documents/507f1f77bcf86cd799439022");
  });
});

