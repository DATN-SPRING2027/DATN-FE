"use client";

import { useState, type FormEvent } from "react";
import { INITIAL_INTAKE_FORMS, PREVIEW_PEOPLE } from "./work-preview-data";
import type {
  CreatePreviewWorkItem,
  WorkIntakeForm,
  WorkIntakeFormType,
  WorkItemType,
} from "./work-types";

type FormFieldDef = {
  id: string;
  name: string;
  icon: string;
  prompt: string;
};

const DEFAULT_FIELDS: readonly FormFieldDef[] = [
  { id: "assignee", name: "Assignee", icon: "👤", prompt: "Choose an assignee" },
  {
    id: "duedate",
    name: "Due date",
    icon: "⏱",
    prompt: "Pick target completion date",
  },
  {
    id: "fixversions",
    name: "Fix versions",
    icon: "🏷",
    prompt: "Target release version",
  },
  { id: "labels", name: "Labels", icon: "🏷", prompt: "Categorization tags" },
  {
    id: "parent",
    name: "Parent",
    icon: "🗂",
    prompt: "Select parent epic or work item",
  },
  { id: "startdate", name: "Start date", icon: "📅", prompt: "Work start date" },
  { id: "team", name: "Team", icon: "👥", prompt: "Assign to a team" },
];

const TEMPLATES: readonly {
  id: string;
  icon: string;
  label: string;
  type: WorkIntakeFormType;
  title: string;
  fields: readonly string[];
}[] = [
  {
    id: "blank",
    icon: "📄",
    label: "Blank form",
    type: "Epic",
    title: "Continuum AI - Epic Intake Form",
    fields: ["assignee", "duedate"],
  },
  {
    id: "feature",
    icon: "⚡",
    label: "Feature request",
    type: "Feature",
    title: "Feature Requests Intake",
    fields: ["team", "labels"],
  },
  {
    id: "bug",
    icon: "🐛",
    label: "Bug report",
    type: "Bug",
    title: "Bug Report Portal",
    fields: ["assignee", "labels", "duedate"],
  },
  {
    id: "incident",
    icon: "⚠️",
    label: "Incident report",
    type: "Bug",
    title: "Production Incident Report",
    fields: ["assignee", "duedate", "team"],
  },
  {
    id: "tech-review",
    icon: "⚙️",
    label: "Technical review",
    type: "Story",
    title: "Architecture & Technical Review Form",
    fields: ["assignee", "parent"],
  },
  {
    id: "change-request",
    icon: "⇄",
    label: "Change request",
    type: "Task",
    title: "Engineering Change Request Form",
    fields: ["assignee", "duedate", "fixversions"],
  },
];

const WORK_TYPES: readonly {
  type: WorkIntakeFormType;
  icon: string;
  color: string;
}[] = [
  { type: "Epic", icon: "⚡", color: "text-purple-600 dark:text-purple-400" },
  { type: "Task", icon: "☑", color: "text-brand-600 dark:text-brand-400" },
  { type: "Story", icon: "🔖", color: "text-success-600 dark:text-success-400" },
  { type: "Feature", icon: "📦", color: "text-warning-600 dark:text-warning-400" },
  { type: "Bug", icon: "🐛", color: "text-error-600 dark:text-error-400" },
];

export default function WorkFormsView({
  onCreateItem,
}: {
  onCreateItem: (item: CreatePreviewWorkItem) => void;
}) {
  const [forms, setForms] = useState<WorkIntakeForm[]>([
    ...INITIAL_INTAKE_FORMS,
  ]);
  const [availableFields, setAvailableFields] = useState<FormFieldDef[]>([
    ...DEFAULT_FIELDS,
  ]);
  const [mode, setMode] = useState<"landing" | "builder" | "submit">("landing");
  const [typePopoverForTemplate, setTypePopoverForTemplate] = useState<
    string | null
  >(null);
  const [workType, setWorkType] = useState<WorkIntakeFormType>("Epic");
  const [formTitle, setFormTitle] = useState("Continuum AI - Epic Intake Form");
  const [formDesc, setFormDesc] = useState(
    "Add help text and instructions to fill in this form",
  );
  const [activeFields, setActiveFields] = useState<string[]>([
    "assignee",
    "duedate",
  ]);
  const [includeAttachment, setIncludeAttachment] = useState(true);
  const [formActive, setFormActive] = useState(true);
  const [accessLevel, setAccessLevel] = useState<"workspace" | "public">(
    "workspace",
  );
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [tutorialModalOpen, setTutorialModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [creatingCustomField, setCreatingCustomField] = useState(false);
  const [customFieldName, setCustomFieldName] = useState("");
  const [submitSummary, setSubmitSummary] = useState("");
  const [submitDescription, setSubmitDescription] = useState("");
  const [submitDueDate, setSubmitDueDate] = useState("");
  const [submittedNotice, setSubmittedNotice] = useState("");

  function openBuilder(
    nextType: WorkIntakeFormType,
    nextTitle: string,
    nextFields: readonly string[],
  ) {
    setWorkType(nextType);
    setFormTitle(nextTitle);
    setActiveFields([...nextFields]);
    setFormActive(true);
    setTypePopoverForTemplate(null);
    setMoreMenuOpen(false);
    setSubmittedNotice("");
    setMode("builder");
  }

  function toggleField(fieldId: string) {
    setActiveFields((current) =>
      current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId],
    );
  }

  function handleAddCustomField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = customFieldName.trim();
    if (!trimmed) return;
    const newId = `custom-${Date.now()}`;
    setAvailableFields((current) => [
      ...current,
      {
        id: newId,
        name: trimmed,
        icon: "✨",
        prompt: `Enter ${trimmed.toLowerCase()}`,
      },
    ]);
    setActiveFields((current) => [...current, newId]);
    setCustomFieldName("");
    setCreatingCustomField(false);
  }

  function handleShareFormLink() {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(
        `${window.location.origin}/workspace?form=${encodeURIComponent(formTitle)}`,
      );
    }
    setSubmittedNotice(`🔗 Shareable form link copied for "${formTitle}".`);
  }

  function handleDeleteCurrentForm() {
    setForms((current) => current.filter((f) => f.name !== formTitle));
    setDeleteConfirmOpen(false);
    setMode("landing");
    setSubmittedNotice(`🗑 Deleted form "${formTitle}".`);
  }

  function handleLiveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = submitSummary.trim();
    if (!normalized) return;

    const mappedType: WorkItemType =
      workType === "Bug" ? "BUG" : workType === "Story" ? "STORY" : "TASK";

    onCreateItem({
      title: normalized,
      type: mappedType,
      priority: workType === "Bug" || workType === "Epic" ? "HIGH" : "MEDIUM",
      assignee: PREVIEW_PEOPLE[0],
      dueDate: submitDueDate || null,
      description: submitDescription.trim() || undefined,
    });

    setForms((current) => {
      const existing = current.find((item) => item.name === formTitle);
      if (existing) {
        return current.map((item) =>
          item.id === existing.id
            ? { ...item, submissions: item.submissions + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          id: `form-${Date.now()}`,
          name: formTitle,
          type: workType,
          submissions: 1,
          status: "Active",
          createdAt: "2026-10-21",
          desc: formDesc,
          fields: activeFields,
        },
      ];
    });

    setSubmitSummary("");
    setSubmitDescription("");
    setSubmitDueDate("");
    setSubmittedNotice(
      `Submitted request "${normalized}" to project workspace.`,
    );
    setMode("landing");
  }

  if (mode === "builder" || mode === "submit") {
    return (
      <section aria-label="Form builder" className="min-w-0 space-y-4">
        {submittedNotice && (
          <div
            role="status"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
          >
            {submittedNotice}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMode("landing")}
            className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            ← Back to forms
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-success-700 dark:text-success-400">
              {formActive ? "✓ All changes saved" : "⊘ Form deactivated"}
            </span>
            <button
              type="button"
              onClick={() =>
                setMode(mode === "submit" ? "builder" : "submit")
              }
              className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              {mode === "submit"
                ? "Back to form builder"
                : "Preview & submit request ↗"}
            </button>
          </div>
        </div>

        {mode === "submit" ? (
          <form
            onSubmit={handleLiveSubmit}
            className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="h-2.5 bg-gradient-to-r from-rose-500 to-orange-400" />
            <div className="space-y-4 p-6">
              <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                  {workType} Request Form
                </span>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white/90">
                  {formTitle}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formDesc}
                </p>
              </div>

              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Summary *
                <input
                  required
                  value={submitSummary}
                  onChange={(event) => setSubmitSummary(event.target.value)}
                  placeholder="Summary of stakeholder request…"
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
                <textarea
                  rows={3}
                  value={submitDescription}
                  onChange={(event) => setSubmitDescription(event.target.value)}
                  placeholder="Detailed context and acceptance criteria…"
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                />
              </label>

              {activeFields.includes("duedate") && (
                <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Target due date
                  <input
                    type="date"
                    value={submitDueDate}
                    onChange={(event) => setSubmitDueDate(event.target.value)}
                    className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  />
                </label>
              )}

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setMode("builder")}
                  className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 cursor-pointer rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  Submit request
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {/* Left Main Form Builder Canvas */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              {/* Jira Forms Signature Coral Stripe */}
              <div className="h-2.5 bg-gradient-to-r from-rose-500 to-orange-400" />

              <div className="space-y-5 p-5 sm:p-6">
                {/* Canvas Top Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <select
                        aria-label="Issue type"
                        value={workType}
                        onChange={(event) =>
                          setWorkType(event.target.value as WorkIntakeFormType)
                        }
                        className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="Epic">⚡ Epic</option>
                        <option value="Task">☑ Task</option>
                        <option value="Story">🔖 Story</option>
                        <option value="Feature">📦 Feature</option>
                        <option value="Bug">🐛 Bug</option>
                      </select>
                    </label>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <span className="text-success-600 dark:text-success-400">
                        ✓
                      </span>
                      All changes saved
                    </span>
                  </div>

                  {/* 4 Canvas Action Buttons */}
                  <div className="relative flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAccessModalOpen(true)}
                      title="Manage form access"
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      <span>🔒</span>
                      <span className="hidden sm:inline">
                        {accessLevel === "public" ? "Public" : "Restricted"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareFormLink}
                      title="Share form link"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      🔗
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("submit")}
                      title="Open and preview form"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      ↗
                    </button>

                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen((prev) => !prev)}
                      title="More form options"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      ···
                    </button>

                    {moreMenuOpen && (
                      <div className="absolute end-0 top-10 z-20 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setTutorialModalOpen(true);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <span>ℹ</span> Tutorial
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setFormActive((prev) => !prev);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <span>⊘</span>{" "}
                          {formActive ? "Deactivate form" : "Activate form"}
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setDeleteConfirmOpen(true);
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-semibold text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                        >
                          <span>🗑</span> Delete form
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title & Help Text Inputs */}
                <div className="space-y-2.5">
                  <input
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    aria-label="Form title"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-base font-bold text-gray-900 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                  />
                  <input
                    value={formDesc}
                    onChange={(event) => setFormDesc(event.target.value)}
                    aria-label="Form description"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-600 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
                  />
                </div>

                {/* Form Fields Stack */}
                <div className="space-y-3">
                  {/* Mandatory Summary Field */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-950/50">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white/90">
                      <span className="text-gray-400">⠿</span>
                      <span>
                        Summary <span className="text-error-500">*</span>
                      </span>
                    </div>
                    <div className="mt-2 h-9 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2 text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                      Short summary of the request…
                    </div>
                  </div>

                  {/* Description Rich Text Field */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-950/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white/90">
                        <span className="text-gray-400">⠿</span>
                        <span>Description</span>
                      </div>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                        <span>Paragraph ⌵</span>
                        <span className="font-bold">B</span>
                        <span className="italic">I</span>
                        <span>≡</span>
                        <span>🔗</span>
                      </div>
                      <div className="h-16 bg-white p-2.5 text-xs text-gray-400 dark:bg-gray-950">
                        Detailed context, steps to reproduce, or acceptance
                        criteria…
                      </div>
                    </div>
                  </div>

                  {/* Attachment Field Card */}
                  {includeAttachment && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-950/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white/90">
                          <span className="text-gray-400">⠿</span>
                          <span>Attachment</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIncludeAttachment(false)}
                          className="cursor-pointer rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                        <span>☁</span>
                        <span>Attachments will be uploaded here</span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Added Fields */}
                  {activeFields.map((fieldId) => {
                    const field = availableFields.find(
                      (item) => item.id === fieldId,
                    );
                    if (!field) return null;
                    return (
                      <div
                        key={field.id}
                        className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/30 p-3.5 dark:border-brand-500/30 dark:bg-brand-500/10"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-400">⠿</span>
                          <div>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white/90">
                              {field.icon} {field.name}
                            </span>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {field.prompt}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleField(field.id)}
                          aria-label={`Remove ${field.name}`}
                          className="cursor-pointer rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  {/* Bottom Dropzone */}
                  <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/40 py-5 text-center text-xs font-medium text-gray-400 dark:border-gray-800 dark:bg-gray-950/30">
                    Drag another field here or select from the right sidebar
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Build Your Form */}
            <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white/90">
                  Build your form
                </h3>
                <button
                  type="button"
                  onClick={() => setTutorialModalOpen(true)}
                  title="Form builder guide"
                  className="text-xs text-gray-400 hover:text-brand-600"
                >
                  ℹ
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Create a customized form by clicking or dragging fields into the
                template, or create new fields.
              </p>

              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Fields
              </p>
              <div className="mt-2 space-y-2">
                {availableFields.map((field) => {
                  const added = activeFields.includes(field.id);
                  return (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => toggleField(field.id)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        added
                          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="text-gray-400">⠿</span>
                        <span>{field.icon}</span>
                        <span>{field.name}</span>
                      </span>
                      <span>{added ? "Added ✓" : "+ Add"}</span>
                    </button>
                  );
                })}
              </div>

              {/* + Create New Field */}
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                {creatingCustomField ? (
                  <form onSubmit={handleAddCustomField} className="space-y-2">
                    <input
                      value={customFieldName}
                      onChange={(event) =>
                        setCustomFieldName(event.target.value)
                      }
                      placeholder="Custom field name…"
                      className="h-8 w-full rounded-lg border border-brand-300 bg-white px-2.5 text-xs text-gray-900 outline-none dark:border-brand-500 dark:bg-gray-950 dark:text-white"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingCustomField(false);
                          setCustomFieldName("");
                        }}
                        className="h-7 cursor-pointer rounded px-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="h-7 cursor-pointer rounded bg-brand-500 px-2.5 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        Add field
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingCustomField(true)}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-700 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    <span>+</span> Create new field
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Access Settings Modal */}
        {accessModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Form Access Settings"
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                🔒 Form Access Settings
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Choose who can view and submit work items through this form.
              </p>
              <div className="mt-4 space-y-2.5">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 p-3 text-xs dark:border-gray-800">
                  <input
                    type="radio"
                    name="formAccess"
                    checked={accessLevel === "workspace"}
                    onChange={() => setAccessLevel("workspace")}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-gray-900 dark:text-white">
                      Workspace members only (Internal)
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Only authenticated members in this project workspace can
                      submit.
                    </span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 p-3 text-xs dark:border-gray-800">
                  <input
                    type="radio"
                    name="formAccess"
                    checked={accessLevel === "public"}
                    onChange={() => setAccessLevel("public")}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-gray-900 dark:text-white">
                      Anyone with the public link
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      External stakeholders can submit requests directly into the
                      backlog.
                    </span>
                  </div>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAccessModalOpen(false)}
                  className="h-8 cursor-pointer rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  Save access settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial Modal */}
        {tutorialModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jira Forms User Guide"
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                ℹ Jira Forms User Guide
              </h3>
              <ul className="mt-3 list-disc space-y-2 ps-5 text-xs text-gray-600 dark:text-gray-300">
                <li>
                  <strong>Select Work Type:</strong> Choose Epic, Task, Story,
                  Feature, or Bug at the top-left of the form canvas.
                </li>
                <li>
                  <strong>Customize Fields:</strong> Click fields in the right
                  sidebar to include or remove them, or create custom fields.
                </li>
                <li>
                  <strong>Live Intake:</strong> Click{" "}
                  <em>Preview &amp; submit request ↗</em> to raise a real work
                  item straight into your workspace.
                </li>
              </ul>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTutorialModalOpen(false)}
                  className="h-8 cursor-pointer rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Form Confirmation Modal */}
        {deleteConfirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete form confirmation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-base font-bold text-error-600 dark:text-error-400">
                🗑 Delete this form?
              </h3>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Are you sure you want to permanently delete{" "}
                <strong>{formTitle}</strong>? Existing work items created from
                this form will not be affected.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCurrentForm}
                  className="h-8 cursor-pointer rounded-lg bg-error-600 px-3.5 text-xs font-semibold text-white hover:bg-error-700"
                >
                  Delete form
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Workspace intake forms" className="min-w-0 space-y-5">
      {submittedNotice && (
        <div
          role="status"
          className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-xs font-semibold text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400"
        >
          {submittedNotice}
        </div>
      )}

      {/* Jira Forms Hero Card with 2-Card Visual Illustration */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white/90">
            The simple way to collect and track work requests
          </h2>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Use forms to seamlessly create structured work items from stakeholder
            requests.
          </p>
        </div>

        {/* 2-Card Hero Illustration Stage (Submit a form -> Track requests) */}
        <div className="mt-7 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-8">
          {/* Left Card: Submit a form */}
          <div className="flex flex-col items-center text-center">
            <div className="w-52 -rotate-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-md dark:border-gray-700 dark:bg-gray-950">
              <div className="h-2.5 bg-gradient-to-r from-rose-500 to-orange-400" />
              <div className="space-y-2.5 p-3.5 text-start">
                <div className="h-2.5 w-3/5 rounded bg-gray-700 dark:bg-gray-300" />
                <div className="space-y-1">
                  <div className="h-1.5 w-2/5 rounded bg-gray-300 dark:bg-gray-700" />
                  <div className="h-5 rounded border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-1/2 rounded bg-gray-300 dark:bg-gray-700" />
                  <div className="h-5 rounded border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />
                </div>
                <div className="flex justify-end">
                  <span className="inline-block h-4 w-12 rounded bg-brand-500" />
                </div>
              </div>
            </div>
            <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white/90">
              Submit a form
            </h3>
            <p className="mt-0.5 max-w-48 text-xs text-gray-500 dark:text-gray-400">
              Capture key details and raise requests
            </p>
          </div>

          {/* Center Curved Hand-Drawn Arrow */}
          <div aria-hidden="true" className="hidden md:block">
            <svg width="70" height="35" viewBox="0 0 70 35" fill="none">
              <path
                d="M4 26 C 22 6, 46 6, 62 20"
                stroke="#475467"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M55 21 L63 21 L60 13"
                stroke="#475467"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {/* Right Card: Track requests with Green Circle Backdrop */}
          <div className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center">
              <div
                aria-hidden="true"
                className="absolute h-44 w-44 rounded-full bg-success-100/70 dark:bg-success-500/10"
              />
              <div className="relative z-1 w-60 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-md dark:border-gray-700 dark:bg-gray-950">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-bold text-gray-800 dark:border-gray-800 dark:text-gray-200">
                  <span>Track requests</span>
                  <span className="text-brand-600">+</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="grid grid-cols-3 text-start font-semibold text-gray-400">
                    <span>Summary</span>
                    <span>Status</span>
                    <span>Due</span>
                  </div>
                  <div className="grid grid-cols-3 items-center rounded bg-gray-50 px-1.5 py-1 text-start dark:bg-gray-900">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      UI fixes
                    </span>
                    <span className="w-fit rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      TO DO
                    </span>
                    <span className="text-gray-500">12 Oct</span>
                  </div>
                  <div className="grid grid-cols-3 items-center rounded bg-gray-50 px-1.5 py-1 text-start dark:bg-gray-900">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      API sync
                    </span>
                    <span className="w-fit rounded bg-success-100 px-1.5 py-0.5 text-[9px] font-bold text-success-700 dark:bg-success-500/20 dark:text-success-300">
                      DONE
                    </span>
                    <span className="text-gray-500">15 Oct</span>
                  </div>
                </div>
              </div>
            </div>
            <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white/90">
              Track requests
            </h3>
            <p className="mt-0.5 max-w-48 text-xs text-gray-500 dark:text-gray-400">
              Prioritize work on your board or list
            </p>
          </div>
        </div>

        {/* Templates Bar + Jira Type Selector Popover */}
        <div className="mt-8 border-t border-gray-100 pt-6 text-center dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Create a form from template
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {TEMPLATES.map((tpl) => {
              const isPopoverOpen = typePopoverForTemplate === tpl.id;
              return (
                <div key={tpl.id} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setTypePopoverForTemplate(isPopoverOpen ? null : tpl.id)
                    }
                    className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                      isPopoverOpen
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                    }`}
                  >
                    <span>{tpl.icon}</span>
                    <span>{tpl.label}</span>
                    {tpl.id === "blank" && <span className="opacity-70">▾</span>}
                  </button>

                  {isPopoverOpen && (
                    <div
                      role="menu"
                      aria-label={`Select work type for ${tpl.label}`}
                      className="absolute start-0 top-11 z-30 w-56 rounded-2xl border border-gray-200 bg-white p-2 text-start shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                      <p className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Choose work type
                      </p>
                      {WORK_TYPES.map((wt) => (
                        <button
                          key={wt.type}
                          type="button"
                          onClick={() =>
                            openBuilder(
                              wt.type,
                              `Continuum AI - ${wt.type} ${tpl.label}`,
                              tpl.fields,
                            )
                          }
                          className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className={wt.color}>{wt.icon}</span>
                            <span>{wt.type}</span>
                          </span>
                          <span className="text-[10px] text-gray-400">→</span>
                        </button>
                      ))}
                      <p className="mt-1 border-t border-gray-100 px-2.5 pt-2 text-[11px] leading-4 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        Receive different types of work mapped directly to your
                        backlog.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Created Forms Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Active workspace forms ({forms.length})
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Forms connected to this project space’s backlog.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              openBuilder("Epic", "Continuum AI - Epic Intake Form", [
                "assignee",
                "duedate",
              ])
            }
            className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            + Create form
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/70">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Form name
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Issue type
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Submissions
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {forms.map((form) => (
                <tr
                  key={form.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white/90">
                      {form.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {form.createdAt} • {form.desc}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {form.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-600 dark:text-brand-400">
                    {form.submissions} submissions
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                      {form.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkType(form.type);
                          setFormTitle(form.name);
                          setFormDesc(form.desc);
                          setActiveFields([...form.fields]);
                          setMode("submit");
                        }}
                        className="cursor-pointer rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                      >
                        Submit request
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openBuilder(form.type, form.name, form.fields)
                        }
                        className="cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
