import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import WorkNoteAssessment, {
  type WorkNoteAssessmentProps,
} from "./WorkNoteAssessment";
import { assessmentFixture } from "./assessment.test-fixture";

function mount(overrides: Partial<WorkNoteAssessmentProps> = {}) {
  const props: WorkNoteAssessmentProps = {
    value: structuredClone(assessmentFixture),
    busy: false,
    stale: false,
    onAssess: vi.fn(),
    onReply: vi.fn(),
    onRewrite: vi.fn(),
    onCorrect: vi.fn(),
    onReset: vi.fn(),
    onValidate: vi.fn(),
    onFeedback: vi.fn(),
    ...overrides,
  };
  const rendered = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkNoteAssessment {...props} />
    </NextIntlClientProvider>,
  );
  return { ...props, rerender: rendered.rerender };
}
it("keeps unsent text scoped to its question when a suggested answer advances to another gap", () => {
  const props = mount();
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: "Unsent implementation detail for the first question." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Manual retry" }));
  props.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkNoteAssessment
        {...props}
        value={{
          ...assessmentFixture,
          revision: 2,
          nextQuestion: {
            ...assessmentFixture.nextQuestion!,
            id: "question-two",
            gapId: "gap-two",
            text: "What test result was observed?",
          },
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByLabelText("Your answer")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Send answer" })).toBeDisabled();
  expect(props.onReply).toHaveBeenCalledExactlyOnceWith(
    "answered",
    "Manual retry",
  );
});
it("shows the real acquisition manifest, separate support/verification, and the exact workflow state", () => {
  mount();
  expect(screen.getByText("waiting_for_answer")).toBeInTheDocument();
  expect(screen.getByText("Task checklist")).toBeInTheDocument();
  expect(
    screen.getByText("Not included in this request", { exact: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Fully supported by the cited text.*Reported by the author/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Independent semantic review: not established/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Your answer")).toHaveFocus();
});
it("sends typed unknown/skipped without answer content and permits free text or a suggested answer", () => {
  const props = mount();
  fireEvent.click(screen.getByRole("button", { name: "I do not know" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip this question" }));
  fireEvent.click(screen.getByRole("button", { name: "Manual retry" }));
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: "Manual button after timeout." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
  expect(props.onReply).toHaveBeenNthCalledWith(1, "unknown");
  expect(props.onReply).toHaveBeenNthCalledWith(2, "skipped");
  expect(props.onReply).toHaveBeenNthCalledWith(3, "answered", "Manual retry");
  expect(props.onReply).toHaveBeenNthCalledWith(
    4,
    "answered",
    "Manual button after timeout.",
  );
});
it("does not rewrite stale information, but keeps explicit manual editing, reset and feedback available", () => {
  const props = mount({ stale: true });
  expect(screen.getByText("stale", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  ).toBeDisabled();
  expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Keep uncertainties and edit manually",
    }),
  );
  expect(
    screen.getByText(/Unanswered information remains unknown/),
  ).toBeInTheDocument();
  expect(props.onRewrite).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Record quality feedback" }),
  ).toBeEnabled();
});
it("carries no answers by default and only sends the explicitly selected answer when resetting purpose", () => {
  const answer = {
    id: "answer-one",
    gapId: "gap-one",
    target: "Retry implementation",
    disposition: "answered" as const,
    answer: "Manual retry",
    purpose: "PROGRESS" as const,
    taskContextHash: "a".repeat(64),
  };
  const props = mount({ value: { ...assessmentFixture, answers: [answer] } });
  fireEvent.change(screen.getByLabelText("Purpose of this note"), {
    target: { value: "HANDOVER" },
  });
  expect(
    screen.getByRole("button", { name: "Check information" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Start a new assessment" }),
  );
  expect(
    screen.getByRole("checkbox", { name: "Carry answer: Manual retry" }),
  ).not.toBeChecked();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Carry answer: Manual retry" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Start with selected answers" }),
  );
  expect(props.onReset).toHaveBeenCalledWith("HANDOVER", ["answer-one"]);
});
it("routes claim correction independently from quality feedback and author validation", () => {
  const props = mount();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Correct statement: The queue has not been tested.",
    }),
  );
  fireEvent.change(
    screen.getByLabelText("Explain what the Agent understood incorrectly"),
    {
      target: {
        value: "The network-loss scenario is untested, not the entire queue.",
      },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reassess with this correction" }),
  );
  expect(props.onCorrect).toHaveBeenCalledWith(
    "claim-one",
    "The network-loss scenario is untested, not the entire queue.",
  );
  fireEvent.change(screen.getByLabelText("Issue category"), {
    target: { value: "WRONG_SOURCE" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Record quality feedback" }),
  );
  expect(props.onFeedback).toHaveBeenCalledWith("WRONG_SOURCE");
  fireEvent.click(
    screen.getByRole("button", { name: "I confirm this reflects my note" }),
  );
  expect(props.onValidate).toHaveBeenCalledOnce();
  expect(props.onRewrite).not.toHaveBeenCalled();
});
it("exposes paused state without asking again or treating the note as independently accepted", () => {
  mount({
    value: {
      ...assessmentFixture,
      state: "paused",
      nextQuestion: null,
      noteAdequacy: "UNDETERMINED",
      counters: { questionCount: 3, noProgress: 2 },
      allowedActions: ["rewrite", "reset", "manual", "feedback"],
    },
  });
  expect(screen.getByText("paused", { exact: true })).toBeInTheDocument();
  expect(
    screen.getByText(/Automatic questions have paused/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Assessment clarification" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Prepare a proposal from this assessment",
    }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "I confirm this reflects my note" }),
  ).toBeDisabled();
});
it("renders source text as plain text rather than executing model-supplied markup", () => {
  const value = structuredClone(assessmentFixture);
  value.claims[0].text = '<img src=x onerror="alert(1)">';
  mount({ value });
  expect(
    screen.getByText('<img src=x onerror="alert(1)">'),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("region", { name: "Task information check" }),
    ).queryByRole("img"),
  ).not.toBeInTheDocument();
});
