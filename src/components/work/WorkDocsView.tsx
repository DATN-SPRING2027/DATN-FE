"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SearchIcon } from "@/icons";
import { INITIAL_DOC_ARTICLES, PREVIEW_PEOPLE } from "./work-preview-data";
import type { WorkDocArticle, WorkItem } from "./work-types";

type DocsMode = "list" | "calendar" | "reader" | "gateway";

const DOC_CALENDAR_EVENTS: Record<
  number,
  readonly { docId: string; label: string; colorClass: string }[]
> = {
  4: [
    {
      docId: "06",
      label: "📋 Sprint 3 Kickoff",
      colorClass:
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    },
  ],
  11: [
    {
      docId: "08",
      label: "🧭 Playbook Draft",
      colorClass:
        "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-500/15 dark:text-warning-300 dark:border-warning-500/30",
    },
  ],
  14: [
    {
      docId: "07",
      label: "🛡️ RBAC Policy",
      colorClass:
        "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-500/15 dark:text-warning-300 dark:border-warning-500/30",
    },
  ],
  15: [
    {
      docId: "05",
      label: "🗄️ DB Multi-Tenant",
      colorClass:
        "bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-300 dark:border-success-500/30",
    },
  ],
  16: [
    {
      docId: "06",
      label: "📊 Sprint 3 Review",
      colorClass:
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    },
  ],
  17: [
    {
      docId: "03",
      label: "⚡ SAG Engine Spec",
      colorClass:
        "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
    },
    {
      docId: "04",
      label: "📋 API Contract V1",
      colorClass:
        "bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-300 dark:border-success-500/30",
    },
  ],
  18: [
    {
      docId: "02",
      label: "🏛️ Microservices",
      colorClass:
        "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
    },
  ],
  19: [
    {
      docId: "01",
      label: "📖 Project Scope V1",
      colorClass:
        "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
    },
  ],
  21: [
    {
      docId: "03",
      label: "🔥 SAG Sync & Eval",
      colorClass:
        "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
    },
  ],
  24: [
    {
      docId: "04",
      label: "🔒 Security Audit",
      colorClass:
        "bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-300 dark:border-success-500/30",
    },
  ],
  28: [
    {
      docId: "06",
      label: "🏁 Sprint 3 Retro",
      colorClass:
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    },
  ],
};

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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sagSynced, setSagSynced] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editBulletsText, setEditBulletsText] = useState("");
  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState(
    "Architecture & System Design",
  );
  const [newDocExcerpt, setNewDocExcerpt] = useState("");
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [docNotice, setDocNotice] = useState("");
  const [docComments, setDocComments] = useState<
    Record<string, { id: string; author: string; text: string; time: string }[]>
  >({
    "01": [
      {
        id: "dc-1",
        author: "Thu Hà",
        text: "Verified SAG architecture alignment with Sprint 3 deliverables.",
        time: "2 hours ago",
      },
    ],
  });
  const [commentInput, setCommentInput] = useState("");

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
      const matchesStatus =
        statusFilter === "ALL" || doc.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, docs, searchQuery, statusFilter]);

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
    setEditBulletsText(currentDoc.bullets.join("\n"));
    setIsEditing(true);
  }

  function insertEditorBlock(snippet: string) {
    setEditBulletsText((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  }

  function saveEdit() {
    if (!editTitle.trim()) return;
    const nextBullets = editBulletsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    setDocs((current) =>
      current.map((doc) =>
        doc.id === currentDoc.id
          ? {
              ...doc,
              title: editTitle.trim(),
              shortTitle: editTitle.trim(),
              excerpt: editExcerpt.trim() || doc.excerpt,
              bullets: nextBullets.length > 0 ? nextBullets : doc.bullets,
              updated: "Just now",
            }
          : doc,
      ),
    );
    setIsEditing(false);
    setDocNotice(`✓ Saved updates to "${editTitle.trim()}".`);
  }

  function handleCreateDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newDocTitle.trim();
    if (!title) return;
    const nextNum = String(docs.length + 1).padStart(2, "0");
    const created: WorkDocArticle = {
      id: nextNum,
      category: newDocCategory,
      categoryKey: newDocCategory.includes("Architecture")
        ? "arch"
        : newDocCategory.includes("Contract")
          ? "contract"
          : newDocCategory.includes("Governance")
            ? "governance"
            : "template",
      title: `${nextNum}. ${title}`,
      shortTitle: `${nextNum}. ${title}`,
      excerpt:
        newDocExcerpt.trim() ||
        "Project page created in workspace documentation hub.",
      icon: "📄",
      author: PREVIEW_PEOPLE[0].name,
      role: "Project Member",
      updated: "Just now",
      readTime: "3 min read",
      status: "VERIFIED",
      access: "Anyone in Org",
      sagChunks: 8,
      linkedTasks: ["KNW-142"],
      views: 1,
      callout: {
        kind: "info",
        text:
          newDocExcerpt.trim() ||
          "Newly authored specification indexed into the project knowledge space.",
      },
      bullets: [
        "Initial architectural context and specification scope.",
        "Linked directly to active workspace backlog items.",
      ],
      checklist: [
        {
          id: `chk-${nextNum}-1`,
          text: "Peer review specification with project team",
          owner: PREVIEW_PEOPLE[0].name,
          done: false,
        },
      ],
    };
    setDocs((current) => [created, ...current]);
    setNewDocTitle("");
    setNewDocExcerpt("");
    setCreateDocOpen(false);
    setSelectedDocId(created.id);
    setMode("reader");
    setDocNotice(`✓ Created document "${created.title}".`);
  }

  function handleAddDocComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    setDocComments((current) => ({
      ...current,
      [currentDoc.id]: [
        ...(current[currentDoc.id] ?? []),
        {
          id: `dc-${Date.now()}`,
          author: PREVIEW_PEOPLE[0].name,
          text: trimmed,
          time: "Just now",
        },
      ],
    }));
    setCommentInput("");
  }

  return (
    <section aria-label="Project documentation" className="min-w-0 space-y-4">
      {docNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
        >
          <span>{docNotice}</span>
          <button
            type="button"
            onClick={() => setDocNotice("")}
            className="cursor-pointer text-brand-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top 4-Mode Segmented Switcher Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Project Pages & Knowledge Docs ({docs.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Architecture specs, API contracts, and SAG-indexed project pages.
            </p>
          </div>
          <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
            ● 100% SAG Indexed
          </span>
        </div>

        <div
          className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950"
          role="group"
          aria-label="Documentation display mode"
        >
          {(
            [
              { id: "list", label: "Document List" },
              { id: "calendar", label: "📅 Calendar View" },
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

      {/* MODE 1: DOCUMENT LIST (SPREADSHEET TABLE) */}
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
                <option value="ALL">All Categories (4)</option>
                <option value="Architecture & System Design">
                  Architecture & System Design
                </option>
                <option value="Technical Contracts & Schemas">
                  Technical Contracts & Schemas
                </option>
                <option value="Agile Delivery & Governance">
                  Agile Delivery & Governance
                </option>
                <option value="Templates & Playbooks">
                  Templates & Playbooks
                </option>
              </select>

              <select
                aria-label="Filter documents by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="ALL">Status: All</option>
                <option value="VERIFIED">Verified</option>
                <option value="APPROVED">Approved</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateDocOpen(true)}
                className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                + New Document
              </button>
              <button
                type="button"
                onClick={() => setSagSynced(true)}
                className="h-9 cursor-pointer rounded-lg border border-brand-200 bg-brand-50 px-3.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {sagSynced ? "✓ 100% SAG Indexed" : "⚡ Sync SAG Index"}
              </button>
            </div>
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

      {/* MODE 2: CALENDAR VIEW (DOCUMENT RELEASE & SPRINT CALENDAR) */}
      {mode === "calendar" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white/90">
                📅 Document Release & Sprint Schedule — October 2026
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Click any scheduled document milestone to open it in Document
                Reader.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                Architecture
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
                Contracts
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                Sprint & Review
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full bg-warning-500" />
                Governance
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/70 dark:text-gray-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="border-e border-gray-200 py-2.5 last:border-e-0 dark:border-gray-800"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 dark:divide-gray-800">
            {Array.from({ length: 31 }, (_, index) => {
              const dayNum = index + 1;
              const events = DOC_CALENDAR_EVENTS[dayNum] ?? [];
              const isToday = dayNum === 21;
              return (
                <div
                  key={dayNum}
                  className={`min-h-24 p-2 ${
                    isToday
                      ? "bg-brand-50/40 dark:bg-brand-500/10"
                      : "bg-white dark:bg-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        isToday
                          ? "rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white"
                          : "font-semibold text-gray-500 dark:text-gray-400"
                      }
                    >
                      {isToday ? `${dayNum} TODAY` : dayNum}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {events.map((ev) => (
                      <button
                        key={`${dayNum}-${ev.docId}-${ev.label}`}
                        type="button"
                        onClick={() => openReader(ev.docId)}
                        className={`block w-full cursor-pointer truncate rounded border px-1.5 py-1 text-start text-[11px] font-semibold transition hover:brightness-95 ${ev.colorClass}`}
                      >
                        {ev.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 3: DOCUMENT READER & RICH CONFLUENCE EDITOR */}
      {mode === "reader" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* Left Page Tree Grouped by Category */}
          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Project Pages ({docs.length})
              </h3>
              <button
                type="button"
                onClick={() => setCreateDocOpen(true)}
                className="cursor-pointer rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
              >
                + New
              </button>
            </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                  {currentDoc.status}
                </span>
                <button
                  type="button"
                  onClick={() => setAccessModalOpen(true)}
                  className="h-8 cursor-pointer rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  🔒 {currentDoc.access}
                </button>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    ✏️ Edit page
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-5 space-y-4">
                {/* Confluence Rich Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-800 dark:bg-gray-950">
                  <button
                    type="button"
                    onClick={() =>
                      insertEditorBlock(
                        "• [New Specification] Key architectural requirement",
                      )
                    }
                    className="cursor-pointer rounded px-2 py-1 font-bold hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertEditorBlock(
                        "• [Callout] Zero-trust RBAC verification enforced on API boundary",
                      )
                    }
                    className="cursor-pointer rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    💬 Callout
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertEditorBlock(
                        "• [Code Block] GET /api/v1/projects/:projectId/work-items",
                      )
                    }
                    className="cursor-pointer rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    💻 Code
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertEditorBlock(
                        "• [Linked Jira Task] KNW-142 — Citation source verification",
                      )
                    }
                    className="cursor-pointer rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    ⚡ Jira Task
                  </button>
                </div>

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
                    rows={2}
                    value={editExcerpt}
                    onChange={(event) => setEditExcerpt(event.target.value)}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Specification bullets (one per line)
                  <textarea
                    rows={5}
                    value={editBulletsText}
                    onChange={(event) => setEditBulletsText(event.target.value)}
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

                {/* Discussion & Feedback Section */}
                <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    💬 Discussion & Feedback (
                    {(docComments[currentDoc.id] ?? []).length})
                  </h4>
                  <form
                    onSubmit={handleAddDocComment}
                    className="mt-3 flex items-center gap-2"
                  >
                    <input
                      value={commentInput}
                      onChange={(event) => setCommentInput(event.target.value)}
                      placeholder="Write a comment or review note on this page…"
                      className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <button
                      type="submit"
                      className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      Post comment
                    </button>
                  </form>
                  <ul className="mt-3 space-y-2">
                    {(docComments[currentDoc.id] ?? []).map((c) => (
                      <li
                        key={c.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-950/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {c.author}
                          </span>
                          <span className="text-gray-400">{c.time}</span>
                        </div>
                        <p className="mt-1 text-gray-700 dark:text-gray-300">
                          {c.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </article>
        </div>
      )}

      {/* MODE 4: JIRA CONFLUENCE GATEWAY REPLICA */}
      {mode === "gateway" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Minh Anh, Thu Hà, Quang Huy and 4 others have access
          </p>
          <div className="mt-2.5 flex -space-x-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-600 text-xs font-bold text-white dark:border-gray-900">
              TH
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs font-bold text-white dark:border-gray-900">
              QH
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-xs font-bold text-white dark:border-gray-900">
              MA
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-xs font-bold text-white dark:border-gray-900">
              HN
            </span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white/90">
            Space pages require access to Confluence
          </h3>
          <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Request access to view, edit, and collaborate on pages in Jira with
            your team.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRequestAccessOpen(true)}
              className="h-9 cursor-pointer rounded-xl bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Request access
            </button>
            <button
              type="button"
              onClick={() => setMode("reader")}
              className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              Or open Confluence Project Pages directly ↗
            </button>
          </div>
          <p className="mt-8 text-xs font-semibold text-gray-400">
            ❖ Powered by Confluence
          </p>
        </div>
      )}

      {/* + New Document Modal */}
      {createDocOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create new project document"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
        >
          <form
            onSubmit={handleCreateDoc}
            className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              📄 Create New Project Document
            </h3>
            <label className="grid gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Document title *
              <input
                required
                value={newDocTitle}
                onChange={(event) => setNewDocTitle(event.target.value)}
                placeholder="e.g., Sprint 4 Architecture ADR"
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Category
              <select
                value={newDocCategory}
                onChange={(event) => setNewDocCategory(event.target.value)}
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              >
                <option value="Architecture & System Design">
                  Architecture & System Design
                </option>
                <option value="Technical Contracts & Schemas">
                  Technical Contracts & Schemas
                </option>
                <option value="Agile Delivery & Governance">
                  Agile Delivery & Governance
                </option>
                <option value="Templates & Playbooks">
                  Templates & Playbooks
                </option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Executive summary
              <textarea
                rows={3}
                value={newDocExcerpt}
                onChange={(event) => setNewDocExcerpt(event.target.value)}
                placeholder="Brief summary of the specification…"
                className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateDocOpen(false)}
                className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Create & Open
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Document Access Modal */}
      {accessModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Document Access & Permissions"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              🔒 Page Restrictions & Access
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Configure who can view or edit <strong>{currentDoc.title}</strong>
              .
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDocs((current) =>
                    current.map((d) =>
                      d.id === currentDoc.id
                        ? {
                            ...d,
                            access:
                              d.access === "Anyone in Org"
                                ? "Specific people"
                                : "Anyone in Org",
                          }
                        : d,
                    ),
                  );
                  setAccessModalOpen(false);
                }}
                className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Toggle access ({currentDoc.access})
              </button>
              <button
                type="button"
                onClick={() => setAccessModalOpen(false)}
                className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Confluence Access Modal */}
      {requestAccessOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request Confluence Space Access"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              🔑 Request Confluence Space Access
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Send an access request to space administrator{" "}
              <strong>Minh Anh</strong>.
            </p>
            <textarea
              rows={3}
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Optional note for the space administrator…"
              className="mt-3 w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestAccessOpen(false)}
                className="h-8 cursor-pointer rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestAccessOpen(false);
                  setRequestNote("");
                  setMode("reader");
                  setDocNotice(
                    "✓ Access granted! Opened Confluence Project Pages Reader.",
                  );
                }}
                className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Send request & Open Reader
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
