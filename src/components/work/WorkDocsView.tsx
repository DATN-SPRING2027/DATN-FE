"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/icons";
import { INITIAL_DOC_ARTICLES } from "./work-preview-data";
import type { WorkDocArticle, WorkItem } from "./work-types";

type DocsMode = "list" | "reader" | "gateway";

export default function WorkDocsView({
  items,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const [docs, setDocs] = useState<WorkDocArticle[]>([
    ...INITIAL_DOC_ARTICLES,
  ]);
  const [mode, setMode] = useState<DocsMode>("list");
  const [selectedDocId, setSelectedDocId] = useState<string>("01");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sagSynced, setSagSynced] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");

  const filteredDocs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return docs.filter((doc) => {
      const matchesQuery =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        doc.author.toLowerCase().includes(query) ||
        doc.linkedTasks.some((task) => task.toLowerCase().includes(query));
      const matchesCategory =
        categoryFilter === "ALL" || doc.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [categoryFilter, docs, searchQuery]);

  const currentDoc =
    docs.find((doc) => doc.id === selectedDocId) ?? docs[0];

  function openReader(docId: string) {
    setSelectedDocId(docId);
    setIsEditing(false);
    setMode("reader");
  }

  function toggleChecklistItem(docId: string, checkId: string) {
    setDocs((current) =>
      current.map((doc) =>
        doc.id !== docId
          ? doc
          : {
              ...doc,
              checklist: doc.checklist.map((item) =>
                item.id === checkId ? { ...item, done: !item.done } : item,
              ),
            },
      ),
    );
  }

  function startEditing() {
    setEditTitle(currentDoc.title);
    setEditExcerpt(currentDoc.excerpt);
    setIsEditing(true);
  }

  function saveEdit() {
    if (!editTitle.trim()) return;
    setDocs((current) =>
      current.map((doc) =>
        doc.id === currentDoc.id
          ? {
              ...doc,
              title: editTitle.trim(),
              shortTitle: editTitle.trim(),
              excerpt: editExcerpt.trim() || doc.excerpt,
              updated: "Just now",
            }
          : doc,
      ),
    );
    setIsEditing(false);
  }

  return (
    <section aria-label="Project documentation" className="min-w-0 space-y-4">
      {/* Top Mode Switcher Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Project Pages & Knowledge Docs
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Architecture specs, API contracts, and SAG-indexed project pages.
          </p>
        </div>

        <div
          className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950"
          role="group"
          aria-label="Documentation display mode"
        >
          {(
            [
              { id: "list", label: "Document List" },
              { id: "reader", label: "Document Reader" },
              { id: "gateway", label: "Confluence Gateway" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === item.id
                  ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "list" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="relative min-w-60">
                <span className="sr-only">Search documents</span>
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search documents by title, author, or key…"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white ps-9 pe-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                />
              </label>

              <select
                aria-label="Filter documents by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="ALL">All Categories</option>
                <option value="Architecture & System Design">
                  Architecture & System Design
                </option>
                <option value="Technical Contracts & Schemas">
                  Technical Contracts & Schemas
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setSagSynced(true)}
              className="h-9 cursor-pointer rounded-lg border border-brand-200 bg-brand-50 px-3.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {sagSynced ? "✓ 100% SAG Indexed" : "⚡ Sync SAG Index"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Document & Summary
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Linked Work
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                    SAG Ingestion
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                  >
                    <td className="max-w-md px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openReader(doc.id)}
                        className="cursor-pointer text-start"
                      >
                        <span className="block font-medium text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400">
                          {doc.icon} {doc.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {doc.excerpt}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {doc.category}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {doc.linkedTasks.map((taskKey) => {
                          const linkedItem = items.find(
                            (item) => item.key === taskKey,
                          );
                          return linkedItem ? (
                            <button
                              key={taskKey}
                              type="button"
                              onClick={(event) =>
                                onOpenItem(linkedItem, event.currentTarget)
                              }
                              className="cursor-pointer rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                            >
                              {taskKey}
                            </button>
                          ) : (
                            <span
                              key={taskKey}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            >
                              {taskKey}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                        ✓ {doc.sagChunks} Chunks
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-xs text-gray-500 dark:text-gray-400">
                      <span className="block font-medium text-gray-800 dark:text-gray-200">
                        {doc.updated}
                      </span>
                      <span>{doc.author}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "reader" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Left Page Tree */}
          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Project Pages
            </h3>
            <div className="mt-3 space-y-1.5">
              {docs.map((doc) => {
                const active = doc.id === currentDoc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => openReader(doc.id)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-medium transition ${
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span>{doc.icon}</span>
                    <span className="truncate">{doc.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Reader / Editor Canvas */}
          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentDoc.category} • {currentDoc.readTime} •{" "}
                  {currentDoc.views} views
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Verified by <strong>{currentDoc.author}</strong> (
                  {currentDoc.role}) • Updated {currentDoc.updated}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                  {currentDoc.status}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Edit page
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-5 space-y-4">
                <label className="grid gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Page title
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Executive summary
                  <textarea
                    rows={3}
                    value={editExcerpt}
                    onChange={(event) => setEditExcerpt(event.target.value)}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white/90">
                  {currentDoc.title}
                </h3>

                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                  {currentDoc.callout.text}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    Key Architectural Specifications
                  </h4>
                  <ul className="mt-2.5 list-disc space-y-1.5 ps-5 text-sm text-gray-700 dark:text-gray-300">
                    {currentDoc.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    Action Items Checklist
                  </h4>
                  <ul className="mt-2.5 space-y-2">
                    {currentDoc.checklist.map((chk) => (
                      <li
                        key={chk.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3.5 py-2 text-sm dark:border-gray-800"
                      >
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={chk.done}
                            onChange={() =>
                              toggleChecklistItem(currentDoc.id, chk.id)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          />
                          <span
                            className={
                              chk.done
                                ? "line-through text-gray-400 dark:text-gray-500"
                                : "text-gray-800 dark:text-gray-200"
                            }
                          >
                            {chk.text}
                          </span>
                        </label>
                        <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                          @{chk.owner}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </article>
        </div>
      )}

      {mode === "gateway" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex -space-x-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-600 text-xs font-bold text-white dark:border-gray-900">
              TH
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs font-bold text-white dark:border-gray-900">
              QH
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-xs font-bold text-white dark:border-gray-900">
              MA
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white/90">
            Space pages are connected to Project Knowledge Hub
          </h3>
          <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            View, edit, and collaborate on verified project documentation and
            architecture decision records with your team.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setMode("reader")}
              className="h-9 cursor-pointer rounded-xl bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Open Project Pages Reader
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              View Document Spreadsheet
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
