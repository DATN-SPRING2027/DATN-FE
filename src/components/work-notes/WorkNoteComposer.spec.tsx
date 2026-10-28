import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import {
  agentApi,
  type EditorSourceIdentity,
  type AgentDraft,
} from "@/lib/queries/work-notes/work-note-agent.api";
import WorkNoteComposer from "./WorkNoteComposer";
import { assessmentApi } from "@/lib/queries/work-notes/work-note-assessment.api";
import { assessmentFixture } from "./assessment.test-fixture";
vi.mock("@/lib/queries/work-notes/work-note-assessment.api", () => ({
  assessmentApi: {
    assess: vi.fn(),
    reply: vi.fn(),
    rewrite: vi.fn(),
    correct: vi.fn(),
    reset: vi.fn(),
    validateAuthor: vi.fn(),
    feedback: vi.fn(),
  },
}));
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

it("offers an explicit Task information check without inference on opening the editor", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  try {
    mount();
    await screen.findByLabelText("Content");
    expect(
      screen.getByRole("button", { name: "Check information" }),
    ).toBeEnabled();
    expect(agentApi.message).not.toHaveBeenCalled();
    expect(assessmentApi.assess).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
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
  vi.mocked(assessmentApi.assess).mockResolvedValue(
    structuredClone(assessmentFixture),
  );
});
afterEach(() => vi.unstubAllEnvs());
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

it("assesses only on request and flushes the latest note before sending its server revision", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(assessmentApi.assess).mockResolvedValue({
    ...assessmentFixture,
    sourceRevision: 2,
  });
  mount();
  await screen.findByLabelText("Content");
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "Changed note, still untested." },
  });
  expect(assessmentApi.assess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check information" }));
  await screen.findByText("Which retry behavior was implemented?");
  expect(agentApi.update).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({
      contentMarkdown: "Changed note, still untested.",
    }),
  );
  expect(assessmentApi.assess).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    expect.objectContaining({ expectedRevision: 2, purpose: "AUTO" }),
  );
  expect(agentApi.message).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Content")).toHaveValue(
    "Changed note, still untested.",
  );
});

it("keeps typed unknown separate from an answer and does not silently deem the missing information sufficient", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(assessmentApi.reply).mockResolvedValue({
    ...assessmentFixture,
    revision: 2,
    state: "paused",
    nextQuestion: null,
    noteAdequacy: "UNDETERMINED",
    gaps: [{ ...assessmentFixture.gaps[0], status: "unknown" }],
    allowedActions: ["reset", "manual", "feedback"],
  });
  mount();
  await screen.findByLabelText("Content");
  fireEvent.click(screen.getByRole("button", { name: "Check information" }));
  fireEvent.click(await screen.findByRole("button", { name: "I do not know" }));
  await screen.findByText("paused", { exact: true });
  expect(assessmentApi.reply).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    assessmentFixture.id,
    expect.objectContaining({
      expectedRevision: 1,
      expectedAssessmentRevision: 1,
      gapId: "gap-one",
      questionId: "question-one",
      disposition: "unknown",
    }),
  );
  expect(vi.mocked(assessmentApi.reply).mock.calls[0][3]).not.toHaveProperty(
    "answer",
  );
  expect(
    screen.getByText("Note information: Not determined"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
});

it("discards a late assessment's authority after local typing and preserves ordinary Save", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  let resolve!: (value: typeof assessmentFixture) => void;
  vi.mocked(assessmentApi.assess).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  mount();
  await screen.findByLabelText("Content");
  fireEvent.click(screen.getByRole("button", { name: "Check information" }));
  await waitFor(() => expect(assessmentApi.assess).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: "New typing while analysis runs." },
  });
  resolve({
    ...assessmentFixture,
    state: "ready_to_edit",
    allowedActions: ["rewrite", "reset", "manual"],
  });
  await screen.findByText("stale", { exact: true });
  expect(
    screen.getByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Content")).toHaveValue(
    "New typing while analysis runs.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalledOnce());
  expect(assessmentApi.rewrite).not.toHaveBeenCalled();
});

it("leaves Save working after an assessment provider failure", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(assessmentApi.assess).mockRejectedValueOnce(
    Error("Assessment provider timed out"),
  );
  mount();
  await screen.findByLabelText("Content");
  fireEvent.click(screen.getByRole("button", { name: "Check information" }));
  await screen.findByText("Assessment provider timed out");
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(agentApi.save).toHaveBeenCalledOnce());
  expect(assessmentApi.assess).toHaveBeenCalledOnce();
  expect(agentApi.message).not.toHaveBeenCalled();
});

it("does not expose Task assessment in Document or Report editors even when the flag is on", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    workflow: "WORK_REPORT",
    resourceId: "report-one",
  });
  mount({ workflow: "WORK_REPORT", resourceId: "report-one" });
  await screen.findByRole("dialog", { name: "Edit work report" });
  await screen.findByLabelText("Content");
  expect(
    screen.queryByRole("button", { name: "Check information" }),
  ).not.toBeInTheDocument();
  expect(assessmentApi.assess).not.toHaveBeenCalled();
});

it("resumes an assessment, resets with no automatic answer carry-over, and sends the current assessment revision", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    assessment: {
      ...assessmentFixture,
      revision: 5,
      answers: [
        {
          id: "answer-one",
          gapId: "gap-one",
          target: "Retry",
          disposition: "answered",
          answer: "Manual retry",
          purpose: "PROGRESS",
          taskContextHash: "a".repeat(64),
        },
      ],
    },
  });
  vi.mocked(assessmentApi.reset).mockResolvedValue({
    ...assessmentFixture,
    id: "new-assessment",
    revision: 1,
    purpose: "HANDOVER",
  });
  mount();
  await screen.findByText("Which retry behavior was implemented?");
  expect(assessmentApi.assess).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Purpose of this note"), {
    target: { value: "HANDOVER" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Start a new assessment" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Start with selected answers" }),
  );
  await waitFor(() => expect(assessmentApi.reset).toHaveBeenCalledOnce());
  expect(assessmentApi.reset).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    assessmentFixture.id,
    expect.objectContaining({
      expectedAssessmentRevision: 5,
      newPurpose: "HANDOVER",
      carryAnswerIds: [],
    }),
  );
});

it("refreshes assessment revision after rewrite and keeps author validation separate from proposal Apply and Save", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  const ready = {
    ...assessmentFixture,
    state: "ready_to_edit" as const,
    nextQuestion: null,
    noteAdequacy: "ENOUGH_FOR_PURPOSE" as const,
    allowedActions: [
      "rewrite",
      "validate_author",
      "feedback",
      "reset",
      "manual",
    ],
  };
  const suggestion = {
    id: "proposal-from-assessment",
    scope: "whole_note" as const,
    operation: "custom" as const,
    baseRevision: 1,
    replacementText: "The queue has not been tested yet.",
    suggestedTitle: null,
    changeSummary: ["Kept the testing limitation."],
  };
  vi.mocked(agentApi.resume)
    .mockResolvedValueOnce({ ...base, assessment: ready })
    .mockResolvedValue({
      ...base,
      suggestion,
      assessment: { ...ready, revision: 2 },
    });
  vi.mocked(assessmentApi.rewrite).mockResolvedValue({
    status: "SUGGESTION_READY",
    message: "Review this proposal.",
    suggestion,
    questions: [],
    uncertainties: [],
    sourceRevision: 1,
  });
  vi.mocked(assessmentApi.validateAuthor).mockResolvedValue({
    ...ready,
    revision: 3,
    authorValidated: true,
    signals: { ...ready.signals, authorValidated: true },
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  );
  await screen.findByRole("button", { name: "Apply proposal" });
  expect(agentApi.resume).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Content")).toHaveValue(base.contentMarkdown);
  fireEvent.click(
    screen.getByRole("button", { name: "I confirm this reflects my note" }),
  );
  await waitFor(() =>
    expect(assessmentApi.validateAuthor).toHaveBeenCalledOnce(),
  );
  expect(assessmentApi.validateAuthor).toHaveBeenCalledWith(
    expect.any(String),
    base.id,
    ready.id,
    expect.objectContaining({
      expectedRevision: 1,
      expectedAssessmentRevision: 2,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "I confirm this reflects my note" }),
    ).toBeDisabled(),
  );
  expect(screen.getByRole("button", { name: "Apply proposal" })).toBeEnabled();
  expect(agentApi.apply).not.toHaveBeenCalled();
  expect(agentApi.save).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Independent semantic review: not established/),
  ).toBeInTheDocument();
});

it("invalidates the ready badge when the server rejects a changed Task context even if the note revision is unchanged", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    assessment: {
      ...assessmentFixture,
      state: "ready_to_edit",
      nextQuestion: null,
      allowedActions: [
        "rewrite",
        "validate_author",
        "reset",
        "feedback",
        "manual",
      ],
    },
  });
  vi.mocked(assessmentApi.rewrite).mockRejectedValue(
    new ApiError(409, "ASSESSMENT_STALE", "The Task context changed"),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  );
  await screen.findByText("The Task context changed");
  expect(screen.queryByText("stale", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
});

it("does not reopen a dismissed proposal when the author only validates the assessment", async () => {
  vi.stubEnv("NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED", "true");
  const ready = {
    ...assessmentFixture,
    state: "ready_to_edit" as const,
    nextQuestion: null,
    allowedActions: ["validate_author", "reset", "feedback", "manual"],
  };
  const suggestion = {
    id: "dismissed-proposal",
    scope: "whole_note" as const,
    operation: "custom" as const,
    baseRevision: 1,
    replacementText: "The queue has not been tested yet.",
    suggestedTitle: null,
    changeSummary: ["Kept the testing limitation."],
  };
  vi.mocked(agentApi.resume).mockResolvedValue({
    ...base,
    assessment: ready,
    suggestion,
  });
  vi.mocked(assessmentApi.validateAuthor).mockResolvedValue({
    ...ready,
    revision: 2,
    authorValidated: true,
    signals: { ...ready.signals, authorValidated: true },
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
  expect(
    screen.queryByRole("button", { name: "Apply proposal" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "I confirm this reflects my note" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "I confirm this reflects my note" }),
    ).toBeDisabled(),
  );
  expect(
    screen.queryByRole("button", { name: "Apply proposal" }),
  ).not.toBeInTheDocument();
  expect(agentApi.apply).not.toHaveBeenCalled();
});
