"use client";

import { useState, type FormEvent } from "react";
import { INITIAL_INTAKE_FORMS, PREVIEW_PEOPLE } from "./work-preview-data";
import type {
  CreatePreviewWorkItem,
  WorkIntakeForm,
  WorkIntakeFormType,
  WorkItemType,
} from "./work-types";

const AVAILABLE_FIELDS = [
  { id: "assignee", name: "Assignee", icon: "👤", prompt: "Choose an assignee" },
  { id: "duedate", name: "Due date", icon: "⏱", prompt: "Pick target completion date" },
  { id: "fixversions", name: "Fix versions", icon: "🏷", prompt: "Target release version" },
  { id: "labels", name: "Labels", icon: "🏷", prompt: "Categorization tags" },
  { id: "parent", name: "Parent", icon: "🗂", prompt: "Select parent epic or work item" },
  { id: "startdate", name: "Start date", icon: "📅", prompt: "Work start date" },
  { id: "team", name: "Team", icon: "👥", prompt: "Assign to a team" },
] as const;

const TEMPLATES: readonly {
  label: string;
  type: WorkIntakeFormType;
  title: string;
  fields: readonly string[];
}[] = [
  {
    label: "Blank form",
    type: "Task",
    title: "Continuum AI - Task Intake Form",
    fields: ["assignee", "duedate"],
  },
  {
    label: "Feature request",
    type: "Feature",
    title: "Feature Requests Intake",
    fields: ["team", "labels"],
  },
  {
    label: "Bug report",
    type: "Bug",
    title: "Bug Report Portal",
    fields: ["assignee", "labels", "duedate"],
  },
  {
    label: "Technical review",
    type: "Story",
    title: "Architecture & Technical Review Form",
    fields: ["assignee", "parent"],
  },
  {
    label: "Epic proposal",
    type: "Epic",
    title: "Continuum AI - Epic Intake Form",
    fields: ["assignee", "duedate", "team"],
  },
];

export default function WorkFormsView({
  onCreateItem,
}: {
  onCreateItem: (item: CreatePreviewWorkItem) => void;
}) {
  const [forms, setForms] = useState<WorkIntakeForm[]>([
    ...INITIAL_INTAKE_FORMS,
  ]);
  const [mode, setMode] = useState<"landing" | "builder" | "submit">("landing");
  const [workType, setWorkType] = useState<WorkIntakeFormType>("Epic");
  const [formTitle, setFormTitle] = useState("Continuum AI - Epic Intake Form");
  const [formDesc, setFormDesc] = useState(
    "Add help text and instructions to fill in this form",
  );
  const [activeFields, setActiveFields] = useState<string[]>([
    "assignee",
    "duedate",
  ]);
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
              ✓ All changes saved
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
            className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
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
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Form Canvas */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="h-2 bg-brand-500" />
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Issue type:
                    <select
                      value={workType}
                      onChange={(event) =>
                        setWorkType(event.target.value as WorkIntakeFormType)
                      }
                      className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-brand-700 dark:border-gray-700 dark:bg-gray-950 dark:text-brand-300"
                    >
                      <option value="Epic">⚡ Epic</option>
                      <option value="Task">☑ Task</option>
                      <option value="Story">🔖 Story</option>
                      <option value="Feature">📦 Feature</option>
                      <option value="Bug">🐛 Bug</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <input
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    aria-label="Form title"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-base font-semibold text-gray-900 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-white/90"
                  />
                  <input
                    value={formDesc}
                    onChange={(event) => setFormDesc(event.target.value)}
                    aria-label="Form description"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-brand-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400"
                  />
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-950/50">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white/90">
                      Summary *
                    </span>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Mandatory summary field mapped directly to work item title.
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-950/50">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white/90">
                      Description
                    </span>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Detailed context and requirements.
                    </p>
                  </div>

                  {activeFields.map((fieldId) => {
                    const field = AVAILABLE_FIELDS.find(
                      (item) => item.id === fieldId,
                    );
                    if (!field) return null;
                    return (
                      <div
                        key={field.id}
                        className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/30 p-3.5 dark:border-brand-500/30 dark:bg-brand-500/10"
                      >
                        <div>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white/90">
                            {field.icon} {field.name}
                          </span>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {field.prompt}
                          </p>
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
                </div>
              </div>
            </div>

            {/* Right Sidebar Fields */}
            <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Form fields
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Click fields below to include or remove them from your intake
                form.
              </p>
              <div className="mt-4 space-y-2">
                {AVAILABLE_FIELDS.map((field) => {
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
                      <span>
                        {field.icon} {field.name}
                      </span>
                      <span>{added ? "Added ✓" : "+ Add"}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
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

      {/* Hero Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
            The simple way to collect and track work requests
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use forms to seamlessly create structured work items from stakeholder
            requests in this project workspace.
          </p>
        </div>

        {/* Templates Row */}
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Create a form from template
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => openBuilder(tpl.type, tpl.title, tpl.fields)}
                className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-xs font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-brand-500"
              >
                + {tpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Created Forms Table */}
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
              openBuilder("Task", "Continuum AI - Custom Form", ["assignee"])
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
