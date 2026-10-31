import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import enLegal from "@/messages/legal/en.json";
import viLegal from "@/messages/legal/vi.json";
import LegalCenterView from "./LegalCenterView";

vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));

vi.mock("@/components/common/ThemeToggleButton", () => ({
  ThemeToggleButton: () => <button type="button">ThemeToggle</button>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span />,
  CheckCircleIcon: () => <span />,
  CheckLineIcon: () => <span />,
  ChevronDownIcon: () => <span />,
  ChevronUpIcon: () => <span />,
  CloseLineIcon: () => <span />,
  CopyIcon: () => <span />,
  DocsIcon: () => <span />,
  DownloadIcon: () => <span />,
  EnvelopeIcon: () => <span />,
  InfoIcon: () => <span />,
  LockIcon: () => <span />,
  SearchIcon: () => <span />,
}));

function renderLegal(initialTab: "terms" | "privacy") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LegalCenterView initialTab={initialTab} />
    </NextIntlClientProvider>,
  );
}

describe("LegalCenterView", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it("maintains exact structural parity between Vietnamese and English legal corpora", () => {
    expect(viLegal.terms.articles).toHaveLength(15);
    expect(enLegal.terms.articles).toHaveLength(15);
    expect(viLegal.privacy.articles).toHaveLength(12);
    expect(enLegal.privacy.articles).toHaveLength(12);

    expect(viLegal.terms.articles.map((a) => a.id)).toEqual(
      enLegal.terms.articles.map((a) => a.id),
    );
    expect(viLegal.privacy.articles.map((a) => a.id)).toEqual(
      enLegal.privacy.articles.map((a) => a.id),
    );
  });

  it("renders all 15 Terms articles, official contact, and switches smoothly to Privacy Policy", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    renderLegal("terms");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Continuum AI Platform Terms and Conditions",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Article 5. Ownership of Workspace Content and Knowledge Handover Continuity (A → D → B)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Article 15. Governing Law, Dispute Resolution, and Contact",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("kimthang.work@gmail.com").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("link", { name: /Privacy Policy/i })[0]);

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/privacy");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Privacy Policy & Personal Data Protection Notice",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "View Google API Services User Data Policy",
      }),
    ).toHaveAttribute(
      "href",
      "https://developers.google.com/terms/api-services-user-data-policy",
    );
  });

  it("keeps the full legal operator name available on narrow screens", () => {
    renderLegal("terms");

    const operatorName = screen.getByText(enLegal.terms.operatorValue);

    expect(operatorName).toHaveClass("min-w-0", "break-words");
    expect(operatorName).not.toHaveClass("truncate");
  });

  it("toggles between the Vietnamese governing original and English counterpart", () => {
    renderLegal("privacy");

    const viButton = screen.getByRole("button", {
      name: "Tiếng Việt (Original)",
    });
    fireEvent.click(viButton);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Chính sách Bảo mật và Bảo vệ Dữ liệu Cá nhân",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mục 4. Quy định Riêng về Dữ liệu Người dùng Google (Google OAuth Limited Use)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tiếng Việt (Bản gốc)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("filters clauses by search query, renders empty filtered state, and resets cleanly", () => {
    renderLegal("terms");

    const searchInput = screen.getByRole("searchbox", {
      name: "Search legal clauses",
    });

    fireEvent.change(searchInput, { target: { value: "familyId" } });
    expect(
      screen.getByText("Showing 1 / 15 matching sections"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Article 3. Eligibility, Account Registration, and Session Security",
      ),
    ).toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "nonexistent-clause-xyz-999" },
    });
    expect(
      screen.getByRole("heading", { name: "No matching clauses found" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear search filter" })[0],
    );
    expect(searchInput).toHaveValue("");
    expect(
      screen.getByText("Article 1. Introduction, Scope, and Acceptance of Terms"),
    ).toBeInTheDocument();
  });

  it("supports mobile quick-jump TOC disclosure and section link copying", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    renderLegal("terms");

    const mobileToggle = screen.getByRole("button", {
      name: "Quick jump menu (15 sections)",
    });
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(mobileToggle);
    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");

    const copyButtons = screen.getAllByRole("button", {
      name: "Copy direct link to this section",
    });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Link copied")).toBeInTheDocument();
    });
  });
});
