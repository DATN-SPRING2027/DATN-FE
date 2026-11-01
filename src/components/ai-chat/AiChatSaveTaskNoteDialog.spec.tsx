import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { AiChatMessage } from "@/lib/queries/ai-chat/ai-chat.types";

const { useProjectTasksQueryMock, composerPropsMock } = vi.hoisted(() => ({
  useProjectTasksQueryMock: vi.fn(),
  composerPropsMock: vi.fn(),
}));

vi.mock("@/lib/queries/tasks/useTasks", () => ({
  useProjectTasksQuery: (...args: unknown[]) => useProjectTasksQueryMock(...args),
}));

vi.mock("../work-notes/WorkNoteComposer", () => ({
  default: (props: Record<string, unknown>) => {
    composerPropsMock(props);
    return (
      <button type="button" data-testid="save-note" onClick={() => (props.onSaved as () => void)()}>
        Save note from editor
      </button>
    );
  },
}));

import AiChatSaveTaskNoteDialog from "./AiChatSaveTaskNoteDialog";

const message: AiChatMessage = {
  id: "507f1f77bcf86cd799439099",
  role: "assistant",
  content: "Reviewed release plan [1] and prior context [S1].",
  status: "ok",
  citations: [
    {
      number: 1,
      sourceId: "source-1",
      documentId: "507f1f77bcf86cd799439088",
      documentName: "Architecture Runbook",
      versionNo: 2,
      heading: "Release process",
      pageFrom: 2,
      pageTo: 3,
      mapped: true,
      snippet: "private excerpt must not be saved",
    },
  ],
  sessionCitations: [
    {
      ref: "S1",
      source: "selected_group",
      groupId: "group-1",
      turnIds: ["turn-1"],
      summaryExcerpt: "private conversation excerpt",
    },
  ],
  retrievalSteps: [],
  createdAt: "2026-10-31T10:00:00.000Z",
};

function renderDialog(onSaved = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiChatSaveTaskNoteDialog
        projectId="507f1f77bcf86cd799439077"
        threadId="507f1f77bcf86cd799439066"
        message={message}
        questionText="What should we do for release?"
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </NextIntlClientProvider>,
  );
}

describe("AiChatSaveTaskNoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectTasksQueryMock.mockReturnValue({
      data: {
        items: [
          {
            id: "507f1f77bcf86cd799439055",
            key: "OPS-12",
            title: "Prepare release",
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("requires a task, lets the user edit the preview, and sends only reference metadata to the editor", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: "Close Task Note dialog" }),
    ).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByLabelText("Answer preview · edit before saving")).toHaveValue(
      message.content,
    );

    const continueButton = screen.getByRole("button", {
      name: "Continue to editor",
    });
    expect(continueButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "507f1f77bcf86cd799439055" },
    });
    fireEvent.change(
      screen.getByLabelText("Answer preview · edit before saving"),
      { target: { value: "Edited release decision [1]." } },
    );
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    const props = composerPropsMock.mock.calls[0]?.[0] as {
      taskId: string;
      initialFields: { title: string; contentMarkdown: string };
      aiChatSource: {
        citations: readonly Record<string, unknown>[];
        sessionCitations: readonly Record<string, unknown>[];
      };
    };
    expect(props.taskId).toBe("507f1f77bcf86cd799439055");
    expect(props.initialFields).toEqual({
      title: "What should we do for release?",
      contentMarkdown: "Edited release decision [1].",
    });
    expect(props.aiChatSource.citations[0]).toMatchObject({
      number: 1,
      documentId: "507f1f77bcf86cd799439088",
      sourceLabel: "Architecture Runbook",
    });
    expect(props.aiChatSource.citations[0]).not.toHaveProperty("snippet");
    expect(props.aiChatSource.sessionCitations[0]).toEqual({
      ref: "S1",
      groupId: "group-1",
      turnIds: ["turn-1"],
    });
    expect(props.aiChatSource.sessionCitations[0]).not.toHaveProperty(
      "summaryExcerpt",
    );
  });
});
