import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import {
  agentApi,
  type EditorSourceIdentity,
  type AgentDraft,
} from "@/lib/queries/work-notes/work-note-agent.api";
import WorkNoteComposer from "./WorkNoteComposer";
const sharedUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queries/work-notes/work-note-agent.api", () => {
  const api = {
    resume: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    message: vi.fn(),
    apply: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    reset: vi.fn(),
    versions: vi.fn(),
    restore: vi.fn(),
  };
  return {
    agentApi: api,
    editorAgentApi: () => ({ ...api, update: sharedUpdate }),
  };
});
const base: AgentDraft = {
  id: "f081a006-489c-4a50-a0df-a54567fdc01b",
  taskId: "851a2b3c4d5e6f7a8b9c0d21",
  noteId: null,
  workflow: "TASK_NOTE",
  baseNoteVersion: 0,
  revision: 1,
  title: "Queue",
  contentMarkdown: "We have not tested the queue.",
  expiresAt: "2026-11-01T00:00:00.000Z",
  hasAppliedRewrite: false,
  conversation: [],
  pendingQuestion: null,
  suggestion: null,
};
function mount(source?: EditorSourceIdentity) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkNoteComposer
          source={source}
          projectId="651a2b3c4d5e6f7a8b9c0d21"
          taskId={base.taskId}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(agentApi.resume).mockResolvedValue(structuredClone(base));
  vi.mocked(agentApi.update).mockImplementation(async (_p, _id, value) => ({
    ...base,
    ...value,
    revision: 2,
  }));
  vi.mocked(agentApi.save).mockResolvedValue({
    id: "751a2b3c4d5e6f7a8b9c0d21",
  } as Awaited<ReturnType<typeof agentApi.save>>);
});
it("uses two fields and saves ordinary text without an Agent call", async () => {
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Approach")).not.toBeInTheDocument();
});
it("requires an in-app confirmation before restoring a version and supports cancellation", async () => {
  const noteId = "751a2b3c4d5e6f7a8b9c0d21";
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    noteId,
    baseNoteVersion: 2,
  });
  vi.mocked(agentApi.versions).mockResolvedValue({
    data: [
      {
        versionNumber: 1,
        title: "Queue",
        contentMarkdown: base.contentMarkdown,
        createdAt: "2026-10-28T00:00:00.000Z",
      },
    ],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  });
  vi.mocked(agentApi.restore).mockResolvedValue({ id: noteId } as Awaited<
    ReturnType<typeof agentApi.restore>
  >);
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Version history" }));
  fireEvent.click(await screen.findByText("Version 1: Queue"));
  fireEvent.click(
    screen.getByRole("button", { name: "Restore as a new version" }),
  );
  await screen.findByRole("alertdialog");
  expect(agentApi.restore).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(agentApi.restore).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore as a new version" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Confirm restore" }),
  );
  await waitFor(() => expect(agentApi.discard).toHaveBeenCalled());
  expect(agentApi.restore).toHaveBeenCalledTimes(1);
  expect(agentApi.restore).toHaveBeenCalledWith(
    expect.any(String),
    base.taskId,
    noteId,
    expect.objectContaining({ expectedVersion: 2, versionNumber: 1 }),
  );
});
it("shows a proposal without changing the editor and requires confirmation before discarding the original", async () => {
  const suggestion = {
    id: "f081a006-489c-4a50-a0df-a54567fdc02b",
    scope: "whole_note" as const,
    operation: "grammar" as const,
    baseRevision: 1,
    replacementText: "The queue has not been tested.",
    suggestedTitle: null,
    changeSummary: ["Improved wording."],
  };
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "SUGGESTION_READY",
    message: "Proposal.",
    suggestion,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  vi.mocked(agentApi.apply).mockResolvedValue({
    ...base,
    contentMarkdown: suggestion.replacementText,
    hasAppliedRewrite: true,
    revision: 2,
  });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await screen.findByText("The queue has not been tested.");
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);
  expect(agentApi.apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply proposal" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Content")).toHaveValue(
      suggestion.replacementText,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await screen.findByText("Discard the before-rewrite original?");
  expect(agentApi.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(agentApi.save).not.toHaveBeenCalled();
});
it("preserves the editor and allows Save after an Agent failure", async () => {
  vi.mocked(agentApi.message).mockRejectedValue(Error("Provider unavailable"));
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
});

it("retries the failed Agent operation and opens a returned clarification", async () => {
  vi.mocked(agentApi.message)
    .mockRejectedValueOnce(Error("Agent timed out"))
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message: "One detail is needed.",
      suggestion: null,
      questions: [
        {
          id: "f081a006-489c-4a50-a0df-a54567fdc03b",
          text: "Which environment?",
          reason: "The source does not say.",
          options: [],
        },
      ],
      uncertainties: [],
      sourceRevision: 1,
    });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await screen.findByText("Agent timed out");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Which environment?");
  expect(agentApi.message).toHaveBeenCalledTimes(2);
  expect(agentApi.message).toHaveBeenLastCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ operation: "grammar", expectedRevision: 1 }),
  );
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);
  expect(agentApi.save).not.toHaveBeenCalled();
});

it("retries autosave rather than an older Agent failure after editing", async () => {
  vi.mocked(agentApi.message).mockRejectedValueOnce(Error("Agent timed out"));
  vi.mocked(agentApi.update).mockRejectedValueOnce(Error("Autosave failed"));
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await screen.findByText("Agent timed out");
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "Updated text, still not tested." },
  });
  await screen.findByText("Autosave failed");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(agentApi.update).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText("Autosave failed")).not.toBeInTheDocument(),
  );
  expect(agentApi.message).toHaveBeenCalledTimes(1);
});

it("flushes changed text before sending the request and uses the returned server revision", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 2,
  });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "New text, not tested." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await waitFor(() => expect(agentApi.message).toHaveBeenCalled());
  expect(agentApi.update).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({
      expectedRevision: 1,
      contentMarkdown: "New text, not tested.",
    }),
  );
  expect(agentApi.message).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ expectedRevision: 2 }),
  );
});
it("sends the exact selected quote and leaves whole-note context opt-in", async () => {
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  mount();
  const field = await screen.findByLabelText("Content");
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 11 } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));
  fireEvent.change(screen.getByLabelText("Message to Agent"), {
    target: { value: "Clarify this word." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        scope: "selection",
        selection: { start: 8, end: 11, quote: "not" },
        includeWholeNoteContext: false,
      }),
    ),
  );
});
it("sends source CRLF offsets even though the browser textarea exposes normalized LF offsets", async () => {
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    contentMarkdown: "🙂 same\r\nsame\r\nend",
  });
  vi.mocked(agentApi.message).mockResolvedValue({
    status: "ANSWER",
    message: "No edit.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  mount();
  const field = await screen.findByLabelText("Content");
  fireEvent.select(field, { target: { selectionStart: 8, selectionEnd: 12 } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));
  fireEvent.change(screen.getByLabelText("Message to Agent"), {
    target: { value: "Fix selected words." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        selection: { start: 9, end: 13, quote: "same" },
      }),
    ),
  );
});
it("opens a clarification automatically and can skip without an empty instruction", async () => {
  const question = {
    id: "f081a006-489c-4a50-a0df-a54567fdc03b",
    text: "Which environment?",
    reason: "The environment is not in the note.",
    options: [],
  };
  vi.mocked(agentApi.message)
    .mockResolvedValueOnce({
      status: "CLARIFICATION_REQUIRED",
      message: "A detail is needed.",
      suggestion: null,
      questions: [question],
      uncertainties: [],
      sourceRevision: 1,
    })
    .mockResolvedValueOnce({
      status: "ANSWER",
      message: "Kept the unknown detail.",
      suggestion: null,
      questions: [],
      uncertainties: [],
      sourceRevision: 1,
    });
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Make clearer" }));
  await screen.findByText(question.text);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue without adding information" }),
  );
  await waitFor(() =>
    expect(agentApi.message).toHaveBeenLastCalledWith(
      expect.any(String),
      base.id,
      expect.objectContaining({
        replyToQuestionId: question.id,
        questionDisposition: "skipped",
        instruction: "Continue without adding information",
      }),
    ),
  );
});
it("keeps newer typing when an Agent response arrives after a local edit", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof agentApi.message>>) => void;
  vi.mocked(agentApi.message).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  mount();
  await screen.findByDisplayValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Fix grammar" }));
  await waitFor(() => expect(agentApi.message).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "A newer draft, still not tested." },
  });
  resolve({
    status: "ANSWER",
    message: "Earlier response.",
    suggestion: null,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Content")).toHaveValue(
    "A newer draft, still not tested.",
  );
  expect(agentApi.apply).not.toHaveBeenCalled();
});

it("uses the shared Document composer without displaying a linked Task or submitting on Save", async () => {
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    workflow: "PROJECT_DOCUMENT",
    resourceId: "document",
    noteId: "document",
    baseContentHash: "a".repeat(64),
  });
  sharedUpdate.mockImplementation(async (_p, _id, value) => ({
    ...base,
    ...value,
    workflow: "PROJECT_DOCUMENT",
    revision: 2,
  }));
  mount({ workflow: "PROJECT_DOCUMENT", resourceId: "document" });
  await screen.findByRole("dialog", { name: "Edit project document" });
  await screen.findByLabelText("Content");
  expect(
    screen.queryByText("Sources and request scope"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Linked task/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "Updated Document body." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalled());
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(sharedUpdate).toHaveBeenCalled();
  expect(agentApi.update).not.toHaveBeenCalled();
});
