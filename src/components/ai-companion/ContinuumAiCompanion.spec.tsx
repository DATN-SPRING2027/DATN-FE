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

  it("renders the floating 3D robot dock, opens the companion panel, and allows switching between all 4 animation states (Chờ / Nghĩ / Nói / Vui)", () => {
    render(<ContinuumAiCompanion />);

    expect(
      screen.getByTestId("ai-companion-floating-dock"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open Continuum AI Companion" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Continuum AI Companion" }),
    ).toBeVisible();
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Chờ · Idle");

    fireEvent.click(screen.getByRole("button", { name: "Nghĩ" }));
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Đang xử lý · Thinking");
    expect(screen.getByTestId("robot-3d-stage")).toHaveAttribute(
      "data-status",
      "thinking",
    );

    fireEvent.click(screen.getByRole("button", { name: "Nói" }));
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Đang trả lời · Speaking");
    expect(screen.getByTestId("robot-3d-stage")).toHaveAttribute(
      "data-status",
      "speaking",
    );

    fireEvent.click(screen.getByRole("button", { name: "Vui" }));
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Hoàn thành · Happy");
    expect(screen.getByTestId("robot-3d-stage")).toHaveAttribute(
      "data-status",
      "happy",
    );

    fireEvent.click(screen.getByRole("button", { name: "Chờ" }));
    expect(
      screen.getByTestId("ai-companion-status-badge"),
    ).toHaveTextContent("Chờ · Idle");
  });

  it("queries real project Task Notes, Documents, and Work Reports and transitions through thinking -> speaking -> happy -> idle", async () => {
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
    ).toHaveTextContent("Đang xử lý · Thinking");

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
