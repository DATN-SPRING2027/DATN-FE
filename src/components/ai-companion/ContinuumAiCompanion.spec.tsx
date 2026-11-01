import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionChatClient } from "./companion-chat-client";
import ContinuumAiCompanion from "./ContinuumAiCompanion";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key === "chatCompleted" ? "Your AI Chat answer is ready." : key,
}));
vi.mock("./WorkReportReminderNotice", () => ({ default: () => null }));

vi.mock("./CompanionProjectPicker", () => ({ default: () => <div>Project picker</div> }));

const routeState = vi.hoisted(() => ({
  pathname: "/projects/6ad88b72ed7cd148fcd0e621/work-notes",
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => routeState.pathname,
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

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

vi.mock("@/lib/queries/work-notes/useWorkNotes", () => ({
  workNotesApi: {
    listProjectTaskNotes: vi.fn(),
    listDocuments: vi.fn(),
    listReports: vi.fn(),
  },
}));

describe("ContinuumAiCompanion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.pathname = "/projects/6ad88b72ed7cd148fcd0e621/work-notes";
  });

  it("renders the floating 3D robot dock, supports minimizing, and opens the clean companion panel without manual debug state buttons", () => {
    render(<ContinuumAiCompanion />);

    expect(
      screen.getByTestId("ai-companion-floating-dock"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Minimize AI Companion" }),
    );
    expect(
      screen.queryByRole("button", { name: "Minimize AI Companion" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open Continuum AI Companion" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Continuum AI Companion" }),
    ).toBeVisible();
    expect(screen.getByTestId("ai-companion-status-badge")).toHaveTextContent(
      "Sẵn sàng",
    );
    expect(screen.getByTestId("robot-3d-stage")).toHaveAttribute(
      "data-status",
      "idle",
    );
    expect(
      screen.queryByRole("group", { name: "Robot animation states" }),
    ).not.toBeInTheDocument();
  });

  it("allows dragging the floating robot anywhere on screen without accidentally opening the chat panel on release", () => {
    render(<ContinuumAiCompanion />);

    const dock = screen.getByTestId("ai-companion-floating-dock");
    const openBtn = screen.getByRole("button", {
      name: "Open Continuum AI Companion",
    });

    fireEvent.pointerDown(dock, { button: 0, clientX: 800, clientY: 600 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 200 });

    expect(dock).toHaveAttribute("data-dragging", "true");
    expect(screen.getByTestId("robot-3d-stage")).toHaveAttribute(
      "data-status",
      "happy",
    );
    expect(dock.style.left).not.toBe("");
    expect(dock.style.top).not.toBe("");

    fireEvent.pointerUp(window);
    fireEvent.click(openBtn);

    expect(
      screen.queryByRole("dialog", { name: "Continuum AI Companion" }),
    ).not.toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(
      screen.getByRole("dialog", { name: "Continuum AI Companion" }),
    ).toBeVisible();
  });

  it("streams the actual AI answer instead of a canned workspace summary", async () => {
    const ask = vi.spyOn(CompanionChatClient.prototype, "ask").mockImplementation(async (_project, query, _signal, onText) => {
      onText(`Real AI response to: ${query}`);
      return { content: `Real AI response to: ${query}`, threadId: "thread-1" };
    });
    render(<ContinuumAiCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Continuum AI Companion" }));
    fireEvent.click(screen.getByRole("button", { name: /Tóm tắt dự án/i }));
    expect(await screen.findByText(/Real AI response to:/)).toBeVisible();
    expect(ask).toHaveBeenCalledWith(routeState.pathname.split("/")[2], expect.any(String), expect.any(AbortSignal), expect.any(Function));
    ask.mockRestore();
  });

  it("shows an AI outage and retains the question for retry instead of repeating the introduction", async () => {
    const ask = vi.spyOn(CompanionChatClient.prototype, "ask").mockRejectedValue(new Error("Offline"));
    render(<ContinuumAiCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Continuum AI Companion" }));
    fireEvent.click(screen.getByRole("button", { name: /Tóm tắt dự án/i }));
    expect(await screen.findByText("aiUnavailable")).toBeVisible();
    expect(screen.getByRole("textbox")).not.toHaveValue("");
    ask.mockRestore();
  });

  it("asks for a project instead of calling the obsolete organizations project URL", async () => {
    routeState.pathname = "/dashboard";
    const ask = vi.spyOn(CompanionChatClient.prototype, "ask");
    render(<ContinuumAiCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Continuum AI Companion" }));
    fireEvent.click(screen.getByRole("button", { name: /Tóm tắt dự án/i }));
    expect(screen.getByText("chooseProjectHelp")).toBeVisible();
    expect(ask).not.toHaveBeenCalled();
    ask.mockRestore();
  });

  it("shows a completion bubble after AI Chat completes, including when the bot was minimized", () => {
    vi.useFakeTimers();
    render(<ContinuumAiCompanion locale="en" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Minimize AI Companion" }),
    );
    act(() =>
      window.dispatchEvent(
        new CustomEvent("continuum:ai-chat-completed", {
          detail: { projectId: "project-1", threadId: "thread-1" },
        }),
      ),
    );
    expect(screen.getByText("Your AI Chat answer is ready.")).toBeVisible();
    act(() => vi.advanceTimersByTime(8000));
    expect(
      screen.queryByText("Your AI Chat answer is ready."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Hi! Need a quick project summary?"),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders English labels and greetings when locale is 'en'", () => {
    render(<ContinuumAiCompanion locale="en" />);

    expect(
      screen.getByText("Hi! Need a quick project summary?"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open Continuum AI Companion" }),
    );

    expect(screen.getByTestId("ai-companion-status-badge")).toHaveTextContent(
      "Ready",
    );
    expect(
      screen.getByRole("button", { name: /Summarize project/i }),
    ).toBeInTheDocument();
  });
});
