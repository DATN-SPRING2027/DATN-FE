import { renderToString } from "react-dom/server";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";
import { CONTINUUM_MCP_TOOLS } from "./docs-tools-data";
import { DOCS_CORPUS } from "./docs-corpus";
import DeveloperDocsView from "./DeveloperDocsView";

const routerReplaceMock = vi.fn();

vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));

vi.mock("@/components/common/ThemeToggleButton", () => ({
  ThemeToggleButton: () => <button type="button">ThemeToggle</button>,
}));

vi.mock("@/lib/queries/auth/useSharedSignIn", () => ({
  useSignInSessionQuery: vi.fn(() => ({ data: undefined, isPending: false })),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
  usePathname: () => "/docs",
  Link: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/icons", () => {
  const Icon = () => null;
  return {
    ArrowRightIcon: Icon,
    CheckCircleIcon: Icon,
    CheckLineIcon: Icon,
    ChevronDownIcon: Icon,
    ChevronUpIcon: Icon,
    CloseLineIcon: Icon,
    CopyIcon: Icon,
    LockIcon: Icon,
    PlugInIcon: Icon,
    SearchIcon: Icon,
  };
});

function renderDocs(locale: "en" | "vi" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : messages}
    >
      <DeveloperDocsView />
    </NextIntlClientProvider>,
  );
}

describe("DeveloperDocsView", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: undefined,
      isPending: false,
    } as never);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("maintains structural parity across all 36 canonical tools, 2 resources, and 4 prompts in VI and EN", () => {
    expect(CONTINUUM_MCP_TOOLS).toHaveLength(36);
    expect(DOCS_CORPUS.en.sections).toHaveLength(5);
    expect(DOCS_CORPUS.vi.sections).toHaveLength(5);
    expect(DOCS_CORPUS.en.resourcesAndPrompts.resources).toHaveLength(2);
    expect(DOCS_CORPUS.vi.resourcesAndPrompts.resources).toHaveLength(2);
    expect(DOCS_CORPUS.en.resourcesAndPrompts.prompts).toHaveLength(4);
    expect(DOCS_CORPUS.vi.resourcesAndPrompts.prompts).toHaveLength(4);
    expect(DOCS_CORPUS.en.resourcesAndPrompts.playbooks).toHaveLength(3);
    expect(DOCS_CORPUS.vi.resourcesAndPrompts.playbooks).toHaveLength(3);

    for (const tool of CONTINUUM_MCP_TOOLS) {
      const paramNames = new Set(tool.params.map((p) => p.name));
      for (const argKey of Object.keys(tool.exampleArgs)) {
        expect(
          paramNames.has(argKey),
          `${tool.name}: exampleArgs.${argKey} missing from params`,
        ).toBe(true);
      }
      for (const param of tool.params) {
        if (param.required) {
          expect(
            param.name in tool.exampleArgs,
            `${tool.name}: required param ${param.name} missing from exampleArgs`,
          ).toBe(true);
        }
      }
      for (const [k, v] of Object.entries(tool.exampleArgs)) {
        if (k.endsWith("Id") && typeof v === "string") {
          expect(
            v,
            `${tool.name}: exampleArgs.${k}="${v}" must be 24-hex ObjectId`,
          ).toMatch(/^[a-fA-F0-9]{24}$/);
        }
      }
    }
  });

  it("renders SSR HTML with empty origin before mount so hydration never mismatches", () => {
    const ssrHtml = renderToString(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DeveloperDocsView />
      </NextIntlClientProvider>,
    );

    expect(ssrHtml).toContain("https://app.continuum.ai/api/backend/mcp");
    expect(ssrHtml).not.toContain("http://localhost");
  });

  it("renders EN & VI documentation, syncs locale route on language switch, exposes mobile theme toggle, and renders canonical footer links", () => {
    const { container } = renderDocs("en");

    expect(container.firstElementChild).toHaveAttribute("lang", "en");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Continuum System-Wide MCP Gateway",
      }),
    ).toBeInTheDocument();

    // ThemeToggleButton must not be wrapped in `hidden sm:block`
    const themeToggle = screen.getByRole("button", { name: "ThemeToggle" });
    expect(themeToggle.parentElement).not.toHaveClass("hidden");

    // Canonical footer links
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(footer).getByRole("link", { name: "Terms of Use" }),
    ).toHaveAttribute("href", "/terms");
    expect(
      within(footer).getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      within(footer).getByRole("link", { name: "MCP API Keys" }),
    ).toHaveAttribute("href", "/signin");

    // Switch to Vietnamese and verify route sync + natural Vietnamese sentence case
    fireEvent.click(screen.getByRole("button", { name: "VI" }));
    expect(routerReplaceMock).toHaveBeenCalledWith("/docs", { locale: "vi" });
    expect(container.firstElementChild).toHaveAttribute("lang", "vi");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Cổng tích hợp Continuum MCP",
      }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Tài liệu nhà phát triển & MCP · Continuum");
  });

  it("shows Manage MCP Keys link to /organization/integrations in header, sidebar, and footer when user has an active session", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: {
        id: "user-1",
        name: "Thang",
        email: "thang@continuum.ai",
        context: "ORGANIZATION",
        organizationId: "org-1",
        roles: ["MEMBER"],
      },
      isPending: false,
    } as never);

    renderDocs("en");
    const manageLinks = screen.getAllByRole("link", {
      name: /Manage MCP Keys/i,
    });
    expect(manageLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of manageLinks) {
      expect(link).toHaveAttribute("href", "/organization/integrations");
    }

    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "MCP API Keys" }),
    ).toHaveAttribute("href", "/organization/integrations");
  });

  it("jumps from Section 01 subsystem '{count} tools' button and filters the 36-tool explorer with Escape search clear", () => {
    renderDocs("en");

    // Default: 0 tools expanded on initial load, hiding noisy readOnlyHint chips
    expect(screen.queryByText(/readOnlyHint:/)).not.toBeInTheDocument();

    const countStatus = screen.getByTestId("docs-tools-count");
    expect(countStatus).toHaveAttribute("role", "status");
    expect(countStatus).toHaveTextContent("Showing 36 of 36 MCP tools");

    // Click Section 01 subsystem button "5 tools" (Handover) -> filters Section 04 to Handover (5)
    fireEvent.click(screen.getByRole("button", { name: /^5 tools/i }));
    expect(screen.getByTestId("docs-tools-count")).toHaveTextContent(
      "Showing 5 of 36 MCP tools",
    );
    expect(
      screen.getByTestId("mcp-tool-card-continuum_create_and_bundle_handover"),
    ).toBeInTheDocument();

    // Intersect with FULL_OPERATIONS (10) scope -> 2 tools in Handover
    fireEvent.click(
      screen.getByRole("button", { name: "FULL_OPERATIONS (10)" }),
    );
    expect(screen.getByTestId("docs-tools-count")).toHaveTextContent(
      "Showing 2 of 36 MCP tools",
    );

    // Focus search via '/' shortcut, verify Jump button appears, then press Escape to clear & blur
    fireEvent.keyDown(document, { key: "/" });
    const searchInput = screen.getByRole("searchbox", {
      name: "Search developer documentation and MCP tools",
    });
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, { target: { value: "handover" } });
    expect(
      screen.getByRole("button", { name: /Jump to 2 tools/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("");
    expect(searchInput).not.toHaveFocus();

    fireEvent.change(searchInput, { target: { value: "zzz-no-tool-match" } });
    expect(
      screen.getByText("No MCP tools match the current filters"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset tool filters" }));
    expect(screen.getByTestId("docs-tools-count")).toHaveTextContent(
      "Showing 36 of 36 MCP tools",
    );
  });

  it("supports WAI-ARIA tablist keyboard navigation on both the 7-IDE configurator and 3-Playbook switcher, and guards clipboard failures", async () => {
    renderDocs("en");

    const antigravityTab = screen.getByRole("tab", {
      name: "Google Antigravity",
    });
    expect(antigravityTab).toHaveAttribute("aria-selected", "true");
    expect(antigravityTab).toHaveAttribute("tabIndex", "0");

    // Keyboard ArrowRight -> Claude Code CLI
    fireEvent.keyDown(antigravityTab, { key: "ArrowRight" });
    const claudeCodeTab = screen.getByRole("tab", { name: "Claude Code CLI" });
    expect(claudeCodeTab).toHaveAttribute("aria-selected", "true");
    expect(claudeCodeTab).toHaveFocus();
    expect(screen.getByTestId("docs-ide-config-pre")).toHaveTextContent(
      "claude mcp add --transport http continuum",
    );

    // Keyboard End -> JSON-RPC curl, Home -> Google Antigravity
    fireEvent.keyDown(claudeCodeTab, { key: "End" });
    const curlTab = screen.getByRole("tab", { name: "JSON-RPC curl" });
    expect(curlTab).toHaveAttribute("aria-selected", "true");
    expect(curlTab).toHaveFocus();
    expect(screen.getByTestId("docs-ide-config-pre")).toHaveTextContent(
      "continuum_get_context",
    );

    // Toggle Direct vs BFF endpoint
    fireEvent.click(
      screen.getByRole("button", { name: "Direct API (/api/v1/mcp)" }),
    );
    expect(screen.getByTestId("docs-ide-config-pre")).toHaveTextContent(
      "/api/v1/mcp",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Same-Origin BFF (/api/backend/mcp)" }),
    );
    expect(screen.getByTestId("docs-ide-config-pre")).toHaveTextContent(
      "/api/backend/mcp",
    );

    // 3-tab Playbook switcher WAI-ARIA keyboard navigation
    const pbTab1 = screen.getByRole("tab", { name: /01 · Daily Engineering/i });
    expect(pbTab1).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(pbTab1, { key: "ArrowRight" });
    const pbTab2 = screen.getByRole("tab", {
      name: /02 · Knowledge Handover/i,
    });
    expect(pbTab2).toHaveAttribute("aria-selected", "true");
    expect(pbTab2).toHaveFocus();
    const pbPanel2 = screen.getByRole("tabpanel", {
      name: /02 · Knowledge Handover/i,
    });
    expect(
      within(pbPanel2).getByText(/continuum_preview_departing_handover/),
    ).toBeInTheDocument();

    // Clipboard failure must NOT falsely mark button as "Copied"
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Denied")),
      },
    });
    document.execCommand = vi.fn(() => false);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("button", { name: "Copied" }),
    ).not.toBeInTheDocument();
  });

  it("enforces zero rounded outer containers on all non-button / non-link elements across expanded schemas and mobile TOC", () => {
    const { container } = renderDocs("en");

    // Open mobile TOC drawer so its <nav> and section list are mounted
    fireEvent.click(
      screen.getByRole("button", { name: /On this page \(5 sections\)/i }),
    );
    expect(document.getElementById("docs-mobile-toc")).toBeInTheDocument();

    // Expand both a zero-arg tool (continuum_get_context) and a parameterized tool (continuum_get_project)
    const getContextCard = screen.getByTestId(
      "mcp-tool-card-continuum_get_context",
    );
    fireEvent.click(
      within(getContextCard).getByRole("button", {
        name: /Inspect schema & payload/i,
      }),
    );
    expect(
      document.getElementById("tool-schema-continuum_get_context"),
    ).toBeInTheDocument();

    const getProjectCard = screen.getByTestId(
      "mcp-tool-card-continuum_get_project",
    );
    fireEvent.click(
      within(getProjectCard).getByRole("button", {
        name: /Inspect schema & payload/i,
      }),
    );
    expect(
      document.getElementById("tool-schema-continuum_get_project"),
    ).toBeInTheDocument();

    const forbiddenRoundedTokens = new Set([
      "rounded",
      "rounded-xs",
      "rounded-sm",
      "rounded-md",
      "rounded-lg",
      "rounded-xl",
      "rounded-2xl",
      "rounded-3xl",
      "rounded-full",
    ]);

    const violations: string[] = [];
    for (const el of Array.from(container.querySelectorAll("*"))) {
      const tag = el.tagName.toLowerCase();
      if (tag === "button" || tag === "a") {
        // Even interactive buttons/links must only use rounded-full or rounded-none (never rounded-xl/lg/md boxes)
        for (const cls of Array.from(el.classList)) {
          if (forbiddenRoundedTokens.has(cls) && cls !== "rounded-full") {
            violations.push(`<${tag}> has box-radius class "${cls}"`);
          }
        }
        continue;
      }

      for (const cls of Array.from(el.classList)) {
        if (forbiddenRoundedTokens.has(cls)) {
          violations.push(
            `<${tag}${el.id ? `#${el.id}` : ""}> has forbidden class "${cls}"`,
          );
        }
      }
    }

    expect(violations).toEqual([]);

    // Pressing Escape inside search input while mobile TOC is open clears search without closing mobile TOC
    const searchInput = screen.getByRole("searchbox", {
      name: "Search developer documentation and MCP tools",
    });
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: "project" } });
    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("");
    expect(document.getElementById("docs-mobile-toc")).toBeInTheDocument();
  });
});
