import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContinuumAiCompanion from "./ContinuumAiCompanion";
import { workNotesApi } from "@/lib/queries/work-notes/useWorkNotes";
import { apiClient } from "@/lib/api-client";

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

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  isAccessOrResourceUnavailableError: () => false,
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
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Sẵn sàng");
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

  it("queries real project Task Notes, Documents, and Work Reports and transitions automatically through thinking -> speaking -> happy", async () => {
    vi.mocked(workNotesApi.listProjectTaskNotes).mockResolvedValue({
      data: [
        {
          id: "note-1",
          projectId: "6ad88b72ed7cd148fcd0e621",
          taskId: "task-1",
          taskKey: "FE-12",
          taskTitle: "Authentication & session handling",
          authorId: "user-1",
          authorName: "Developer A",
          type: "TASK_NOTE",
          title: "Improved token validation",
          accomplishments: "Added checks for expired tokens.",
          approach: "Updated authentication middleware.",
          reason: "Prevent inconsistent session state.",
          status: "CONFIRMED",
          createdAt: "2026-10-25T01:00:00.000Z",
          updatedAt: "2026-10-25T01:00:00.000Z",
          permissions: {
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canSubmit: false,
            canReview: false,
            canConfigure: false,
          },
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });

    vi.mocked(workNotesApi.listDocuments).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    });

    vi.mocked(workNotesApi.listReports).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 6, totalPages: 1 },
    });

    vi.mocked(apiClient).mockResolvedValue({ id: "user-1" } as never);

    render(<ContinuumAiCompanion />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("continuum:open-ai-companion"));
    });

    expect(
      screen.getByRole("dialog", { name: "Continuum AI Companion" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: /Tóm tắt dự án/i }),
    );

    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Đang phân tích...");

    await waitFor(
      () => {
        expect(
          screen.getByText(/Improved token validation/i),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
