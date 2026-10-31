import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { AiChatThread } from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatSidebar, {
  AI_CHAT_SIDEBAR_DEFAULT_WIDTH,
  AI_CHAT_SIDEBAR_MAX_WIDTH,
  AI_CHAT_SIDEBAR_MIN_WIDTH,
  AI_CHAT_SIDEBAR_WIDTH_STORAGE_KEY,
} from "./AiChatSidebar";

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

describe("AiChatSidebar (Full-width fade-mask rows + Draggable resize handle)", () => {
  const sampleThreads: readonly AiChatThread[] = [
    {
      id: "t-1",
      title: "Khi upload attachment lên R2 thì luồng xác thực quyền hoạt động thế nào",
      createdAt: "2026-10-30T08:00:00Z",
      updatedAt: "2026-10-30T08:05:00Z",
    },
    {
      id: "t-2",
      title: "Vai trò của React Server Components và BFF trong kiến trúc Next.js 16",
      createdAt: "2026-10-30T09:00:00Z",
      updatedAt: "2026-10-30T09:10:00Z",
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dir = "ltr";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });
  });

  function renderSidebar(
    overrides: Partial<React.ComponentProps<typeof AiChatSidebar>> = {},
  ) {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatSidebar
          projectId="proj-fe"
          projectCode="FE"
          projectName="Frontend Portal"
          threads={sampleThreads}
          pinnedThreadIds={new Set<string>(["t-1"])}
          activeThreadId={null}
          isLoading={false}
          isError={false}
          isDesktopOpen={true}
          isMobileOpen={false}
          isCreatingThread={false}
          onStartNewChat={vi.fn()}
          onSelectThread={vi.fn()}
          onTogglePinThread={vi.fn()}
          onRenameThread={vi.fn().mockResolvedValue(undefined)}
          onDeleteThread={vi.fn().mockResolvedValue(undefined)}
          onRetryThreads={vi.fn()}
          onCollapseDesktop={vi.fn()}
          onCloseMobile={vi.fn()}
          {...overrides}
        />
      </NextIntlClientProvider>,
    );
  }

  it("renders full-width fade-masked thread titles without ellipsis truncation or static action-bar whitespace", () => {
    renderSidebar();

    const titleBtn = screen.getByRole("button", {
      name: sampleThreads[1]!.title,
    });
    expect(titleBtn.className).toContain("w-full");
    expect(titleBtn.className).toContain("chat-sidebar-fade-mask");
    expect(titleBtn.className).not.toContain("truncate");

    const pinBtn = screen.getByRole("button", {
      name: `Pin ${sampleThreads[1]!.title}`,
    });
    expect(pinBtn.parentElement?.className).toContain("absolute");

    // Flat New chat button does not force active gray box when activeThreadId is null
    const newChatBtn = screen.getByRole("button", { name: "New chat" });
    expect(newChatBtn.className).not.toContain("bg-gray-200/80");
  });

  it("resizes wider and narrower via mouse drag, clamps min/max bounds, persists width, and resets on double-click", () => {
    const { unmount } = renderSidebar();

    const aside = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    const resizer = screen.getByRole("separator", {
      name: "Resize chat history sidebar",
    });

    expect(aside).toHaveStyle({ width: `${AI_CHAT_SIDEBAR_DEFAULT_WIDTH}px` });
    expect(resizer).toHaveAttribute(
      "aria-valuenow",
      String(AI_CHAT_SIDEBAR_DEFAULT_WIDTH),
    );

    // Drag right by +110px -> 370px
    fireEvent.mouseDown(resizer, { button: 0, clientX: 260 });
    expect(document.body.style.cursor).toBe("col-resize");
    act(() => {
      fireEvent.mouseMove(window, { clientX: 370 });
    });
    expect(aside).toHaveStyle({ width: "370px" });

    // Drag far right past max -> clamps to 480px
    act(() => {
      fireEvent.mouseMove(window, { clientX: 900 });
    });
    expect(aside).toHaveStyle({ width: `${AI_CHAT_SIDEBAR_MAX_WIDTH}px` });

    // Drag far left past min -> clamps to 200px
    act(() => {
      fireEvent.mouseMove(window, { clientX: 40 });
    });
    expect(aside).toHaveStyle({ width: `${AI_CHAT_SIDEBAR_MIN_WIDTH}px` });

    // Drag to 320px and release mouse
    act(() => {
      fireEvent.mouseMove(window, { clientX: 320 });
      fireEvent.mouseUp(window);
    });
    expect(aside).toHaveStyle({ width: "320px" });
    expect(document.body.style.cursor).toBe("");
    expect(
      window.localStorage.getItem(AI_CHAT_SIDEBAR_WIDTH_STORAGE_KEY),
    ).toBe("320");

    // Remount restores persisted 320px width
    unmount();
    renderSidebar();
    const restoredAside = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    const restoredResizer = screen.getByRole("separator", {
      name: "Resize chat history sidebar",
    });
    expect(restoredAside).toHaveStyle({ width: "320px" });

    // Keyboard ArrowRight (+16px -> 336px) & double-click resets to 260px
    fireEvent.keyDown(restoredResizer, { key: "ArrowRight" });
    expect(restoredAside).toHaveStyle({ width: "336px" });

    fireEvent.doubleClick(restoredResizer);
    expect(restoredAside).toHaveStyle({
      width: `${AI_CHAT_SIDEBAR_DEFAULT_WIDTH}px`,
    });
  });

  it("cleans up body cursor and window listeners if unmounted mid-drag", () => {
    const { unmount } = renderSidebar();
    const resizer = screen.getByRole("separator", {
      name: "Resize chat history sidebar",
    });

    fireEvent.mouseDown(resizer, { button: 0, clientX: 260 });
    expect(document.body.style.cursor).toBe("col-resize");

    unmount();
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("renders subtle BranchIcon indicator on branched threads while preserving accessible button names", () => {
    renderSidebar({
      threads: [
        ...sampleThreads,
        {
          id: "t-branch-1",
          title: "Branch · Kiến trúc Zero-Mem ECCE",
          createdAt: "2026-10-30T10:00:00Z",
          updatedAt: "2026-10-30T10:05:00Z",
          isBranched: true,
          parentThreadId: "t-2",
          parentThreadTitle: sampleThreads[1]!.title,
          branchPointMessageId: "msg-a1",
        },
      ],
    });

    const branchTitleBtn = screen.getByRole("button", {
      name: "Branch · Kiến trúc Zero-Mem ECCE",
    });
    expect(branchTitleBtn).toBeVisible();
    expect(
      screen.getByTestId("sidebar-branch-icon-t-branch-1"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-branch-icon-t-1"),
    ).not.toBeInTheDocument();
  });
});
