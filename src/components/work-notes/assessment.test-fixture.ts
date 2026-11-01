import type { AssessmentView } from "@/lib/queries/work-notes/work-note-assessment.types";
/** Synthetic fixture only; never application data. */
export const assessmentFixture: AssessmentView = {
  schemaVersion: "task-note-assessment/v1",
  id: "assessment-one",
  revision: 1,
  sourceRevision: 1,
  taskContextHash: "a".repeat(64),
  answerLedgerHash: "b".repeat(64),
  purpose: "PROGRESS",
  state: "waiting_for_answer",
  contextManifest: {
    acquisitionStatus: "LOADED",
    sourceCatalogVersion: "1",
    sources: [
      {
        id: "task-description",
        kind: "TASK",
        label: "Task description",
        text: "Implement the queue retry.",
        version: "4",
        loadStatus: "LOADED",
        includedInRequest: true,
      },
      {
        id: "note-body",
        kind: "NOTE",
        label: "Note content",
        text: "We have not tested the queue.",
        version: "1",
        loadStatus: "LOADED",
        includedInRequest: true,
      },
      {
        id: "task-checklist",
        kind: "TASK",
        label: "Task checklist",
        text: "",
        version: "4",
        loadStatus: "LOADED",
        includedInRequest: false,
      },
    ],
  },
  taskUnderstanding: {
    objective: "Implement queue retry",
    scope: "Queue only",
    requirements: [
      {
        id: "requirement-one",
        text: "Implement the queue retry.",
        sourceRefs: [
          { sourceId: "task-description", quote: "Implement the queue retry." },
        ],
      },
    ],
    unknowns: ["No test outcome was provided."],
  },
  claims: [
    {
      id: "claim-one",
      text: "The queue has not been tested.",
      sourceRefs: [
        { sourceId: "note-body", quote: "We have not tested the queue." },
      ],
      originKind: "AUTHOR_REPORT",
      supportRelation: "FULL",
      verificationStatus: "AUTHOR_REPORTED",
    },
  ],
  coverage: [
    {
      requirementId: "requirement-one",
      status: "PARTIAL",
      sourceRefs: [
        { sourceId: "note-body", quote: "We have not tested the queue." },
      ],
    },
  ],
  gaps: [
    {
      id: "gap-one",
      kind: "IMPLEMENTATION",
      target: "Retry implementation",
      impact: "BLOCKING",
      owner: "NOTE_AUTHOR",
      status: "open",
      sourceRefs: [
        { sourceId: "task-description", quote: "Implement the queue retry." },
      ],
    },
  ],
  nextQuestion: {
    id: "question-one",
    gapId: "gap-one",
    text: "Which retry behavior was implemented?",
    reason: "The note does not say what changed.",
    options: ["Manual retry", "Automatic retry"],
  },
  taskContextStatus: "CLEAR",
  noteAdequacy: "NEEDS_AUTHOR_INPUT",
  counters: { questionCount: 1, noProgress: 0 },
  allowedActions: [
    "reply",
    "correct",
    "reset",
    "feedback",
    "manual",
    "validate_author",
  ],
  answers: [],
  authorValidated: false,
  reviewerSemanticAssessment: "NOT_ESTABLISHED",
  signals: {
    proposalApplied: false,
    authorValidated: false,
    saved: false,
    reviewerSemanticAssessment: "NOT_ESTABLISHED",
  },
  createdAt: "2026-10-29T00:00:00.000Z",
  expiresAt: "2026-10-30T00:00:00.000Z",
  trace: [],
  promptVersion: "assessment-test-v1",
  model: "synthetic/model",
};
