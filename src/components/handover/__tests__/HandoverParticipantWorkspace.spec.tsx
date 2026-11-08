import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type {
  HandoverParticipantView,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import HandoverParticipantWorkspace from "../HandoverParticipantWorkspace";

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

vi.mock("@/components/work-notes/TaskNotesPanel", () => ({
  default: ({ taskId }: { taskId: string }) => (
    <div data-testid="task-note-editor">Task note editor for {taskId}</div>
  ),
}));

vi.mock("../HandoverQaPanel", () => ({
  default: () => (
    <div data-testid="handover-ai-chat">Cited Package Q&amp;A</div>
  ),
}));

const PROJECT_ID = "69e923c77859fd1c702d4c21";

const handover: HandoverSummaryDto = {
  id: "69e923c77859fd1c702d4d01",
  projectId: PROJECT_ID,
  teamId: null,
  departingUserId: "69e923c77859fd1c702d4a01",
  assignedLeaderId: "69e923c77859fd1c702d4a02",
  successorUserId: "69e923c77859fd1c702d4a03",
  assignmentVersion: 1,
  title: "A long but readable project handover title for the next owner",
  version: 2,
  status: "OPEN",
  publishedRevisionId: "69e923c77859fd1c702d4e01",
  draftVersion: 1,
  targetCompletionDate: "2026-11-15T00:00:00.000Z",
  overdue: false,
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T02:00:00.000Z",
};

function task(
  id: string,
  dueDate: string | null,
  status = "IN_PROGRESS",
  canAddNote = false,
) {
  return {
    id,
    key: `PULSE-${id.slice(-3)}`,
    title: `Task ${id}`,
    status,
    dueDate,
    disposition: "TRANSFERRED" as const,
    canAddNote,
  };
}

function renderWorkspace(view: HandoverParticipantView, onAccept = vi.fn()) {
  return {
    onAccept,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <HandoverParticipantWorkspace
          projectId={PROJECT_ID}
          handover={handover}
          view={view}
          published
          canManage={false}
          busy={false}
          actionError={null}
          onAccept={onAccept}
        >
          <div data-testid="published-clarification">
            Report missing information
          </div>
        </HandoverParticipantWorkspace>
      </NextIntlClientProvider>,
    ),
  };
}

describe("HandoverParticipantWorkspace", () => {
  it("puts the successor's three earliest unfinished tasks before sources and AI, then confirms receipt", () => {
    const overdue = task(
      "111111111111111111111111",
      "2026-10-30T00:00:00.000Z",
    );
    const dueSoon = task(
      "222222222222222222222222",
      "2026-11-10T00:00:00.000Z",
    );
    const noDue = task("333333333333333333333333", null, "BLOCKED");
    const completed = task(
      "444444444444444444444444",
      "2026-09-01T00:00:00.000Z",
      "DONE",
    );
    const view: HandoverParticipantView = {
      role: "SUCCESSOR",
      packageAccepted: false,
      canQuickAccept: true,
      tasks: [noDue, completed, dueSoon, overdue],
      sources: [
        {
          kind: "PROJECT_DOCUMENT",
          id: "69e923c77859fd1c702d4b21",
          version: "1",
          title: "Current project runbook",
        },
      ],
    };
    const { onAccept } = renderWorkspace(view);

    const taskSection = screen
      .getByRole("heading", { name: "What to do first" })
      .closest("section");
    expect(taskSection).not.toBeNull();
    const taskList = taskSection!.querySelector(":scope > ul");
    expect(taskList).not.toBeNull();
    const taskLinks = within(taskList as HTMLElement).getAllByRole("link");
    expect(taskLinks.map((item) => item.getAttribute("href"))).toEqual([
      `/projects/${PROJECT_ID}/work?taskId=${overdue.id}`,
      `/projects/${PROJECT_ID}/work?taskId=${dueSoon.id}`,
      `/projects/${PROJECT_ID}/work?taskId=${noDue.id}`,
    ]);
    expect(screen.getByText("Current project runbook")).toBeVisible();
    expect(screen.getByTestId("handover-ai-chat")).toBeVisible();
    fireEvent.click(
      screen.getByText("Review package or report missing information"),
    );
    expect(screen.getByText("Report missing information")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm receipt" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm receipt" }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("All received tasks (4)"));
    expect(screen.getByRole("link", { name: /Task 444/ })).toBeVisible();
  });

  it("shows an empty task state and waits for transfer verification before enabling receipt", () => {
    const view: HandoverParticipantView = {
      role: "SUCCESSOR",
      packageAccepted: false,
      canQuickAccept: false,
      tasks: [],
      sources: [],
    };

    renderWorkspace(view);

    expect(
      screen.getByText("You have no unfinished transferred tasks to start."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "You can accept once the selected task transfers are verified.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirm receipt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No sources are available to you in this handover."),
    ).toBeVisible();
  });

  it("opens the existing Task Note editor for a departing member and closes it accessibly", async () => {
    const ownedTask = task(
      "555555555555555555555555",
      "2026-11-04T00:00:00.000Z",
      "IN_REVIEW",
      true,
    );
    const view: HandoverParticipantView = {
      role: "DEPARTING",
      packageAccepted: false,
      canQuickAccept: false,
      tasks: [ownedTask],
      sources: [],
    };

    renderWorkspace(view);

    fireEvent.click(
      screen.getByRole("button", { name: "Add a handover note" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add a handover note" });
    expect(within(dialog).getByTestId("task-note-editor")).toHaveTextContent(
      ownedTask.id,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
