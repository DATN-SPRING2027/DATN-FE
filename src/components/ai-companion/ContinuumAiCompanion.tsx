"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { workNotesApi } from "@/lib/queries/work-notes/useWorkNotes";
import { apiClient } from "@/lib/api-client";
import Robot3D, { type RobotStatus } from "./Robot3D";

type CompanionActionLink = {
  label: string;
  href: string;
};

type CompanionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: CompanionActionLink[];
};

const STATUS_META: Record<
  RobotStatus,
  {
    label: string;
    shortLabel: string;
    bubble: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  idle: {
    label: "Chờ · Idle",
    shortLabel: "Chờ",
    bubble: "Xin chào! Mình có thể giúp gì cho bạn?",
    badgeClass:
      "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dotClass: "bg-emerald-500",
  },
  thinking: {
    label: "Đang xử lý · Thinking",
    shortLabel: "Nghĩ",
    bubble: "Đang truy vấn ngữ cảnh dự án và phân tích dữ liệu...",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    dotClass: "bg-amber-500 animate-ping",
  },
  speaking: {
    label: "Đang trả lời · Speaking",
    shortLabel: "Nói",
    bubble: "Mình đã tổng hợp thông tin từ workspace cho bạn!",
    badgeClass:
      "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
    dotClass: "bg-brand-500 animate-pulse",
  },
  happy: {
    label: "Hoàn thành · Happy",
    shortLabel: "Vui",
    bubble: "Hoàn tất! Bạn cần mình kiểm tra thêm mục nào không?",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
};

const ALL_STATUSES: readonly RobotStatus[] = [
  "idle",
  "thinking",
  "speaking",
  "happy",
];

function extractProjectId(pathname: string): string | null {
  const source =
    pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  const match = /(?:^|\/)projects\/([^/?#]+)/.exec(source);
  if (!match?.[1] || match[1] === "new") return null;
  return decodeURIComponent(match[1]);
}

async function buildContextualReply(
  query: string,
  projectId: string | null,
): Promise<{ text: string; links: CompanionActionLink[] }> {
  const normalized = query.toLowerCase().trim();

  if (
    normalized.includes("what") ||
    normalized.includes("how") ||
    normalized.includes("soạn") ||
    normalized.includes("viết báo cáo") ||
    normalized.includes("draft")
  ) {
    if (projectId) {
      try {
        const notesPage = await workNotesApi.listProjectTaskNotes(projectId, 1);
        const latest = notesPage.data[0];
        if (latest) {
          return {
            text:
              `Dựa trên ghi chú công việc gần nhất (${latest.taskKey ? `${latest.taskKey} · ` : ""}${latest.title}), đây là bản nháp chuẩn cấu trúc 3 phần để bạn đưa vào Work Report:\n\n` +
              `• What was done: ${latest.accomplishments}\n` +
              `• How it was done: ${latest.approach}\n` +
              `• Why this approach: ${latest.reason}`,
            links: [
              {
                label: "Mở Work Reports",
                href: `/projects/${projectId}/work-reports`,
              },
              {
                label: "Mở Task Notes",
                href: `/projects/${projectId}/work-notes`,
              },
            ],
          };
        }
      } catch {
        // Fallback to template below
      }
    }

    return {
      text:
        `Gợi ý khung ghi chú & báo cáo chuẩn Continuum AI (What / How / Why):\n\n` +
        `• What was done: Tóm tắt hạng mục đã hoàn thành và kết quả đầu ra rõ ràng.\n` +
        `• How it was done: Nêu giải pháp kỹ thuật, API/component hoặc quy trình đã áp dụng.\n` +
        `• Why this approach: Giải thích lý do chọn hướng này để người tiếp nhận (Handover) hiểu rõ bối cảnh.`,
      links: projectId
        ? [
            {
              label: "Mở Work Reports",
              href: `/projects/${projectId}/work-reports`,
            },
          ]
        : [{ label: "Danh sách Projects", href: "/projects" }],
    };
  }

  if (
    normalized.includes("handover") ||
    normalized.includes("bàn giao") ||
    normalized.includes("quyết định") ||
    normalized.includes("decision")
  ) {
    if (projectId) {
      const [notesRes, docsRes] = await Promise.allSettled([
        workNotesApi.listProjectTaskNotes(projectId, 1),
        workNotesApi.listDocuments(projectId, "ALL", 1),
      ]);
      if (notesRes.status === "fulfilled" || docsRes.status === "fulfilled") {
        const notesPage =
          notesRes.status === "fulfilled" ? notesRes.value : null;
        const docsPage = docsRes.status === "fulfilled" ? docsRes.value : null;
        const decisions = (notesPage?.data ?? [])
          .slice(0, 3)
          .map(
            (n) =>
              `• [${n.taskKey ?? "Task"}] ${n.title}: ${n.reason} (Thực hiện bởi ${n.authorName})`,
          )
          .join("\n");
        const docTitles = (docsPage?.data ?? [])
          .slice(0, 3)
          .map((d) => `• ${d.title} (${d.type} · v${d.version})`)
          .join("\n");

        return {
          text:
            `Bản tóm tắt Bàn giao (Handover Brief) của dự án hiện tại:\n\n` +
            `1. Quyết định kỹ thuật gần đây (${notesPage?.pagination.totalItems ?? 0} Task Notes):\n` +
            `${decisions || "• Chưa có Task Note nào được ghi nhận."}\n\n` +
            `2. Tài liệu nền tảng (${docsPage?.pagination.totalItems ?? 0} Project Documents):\n` +
            `${docTitles || "• Chưa có tài liệu nào."}`,
          links: [
            {
              label: "Xem Task Notes Explorer",
              href: `/projects/${projectId}/work-notes`,
            },
            {
              label: "Xem Project Documents",
              href: `/projects/${projectId}/documents`,
            },
          ],
        };
      }
    }
  }

  if (projectId) {
    const [notesRes, docsRes, reportsRes] = await Promise.allSettled([
      workNotesApi.listProjectTaskNotes(projectId, 1),
      workNotesApi.listDocuments(projectId, "ALL", 1),
      workNotesApi.listReports(projectId, "ALL", 1),
    ]);

    if (
      notesRes.status === "fulfilled" ||
      docsRes.status === "fulfilled" ||
      reportsRes.status === "fulfilled"
    ) {
      const notesPage = notesRes.status === "fulfilled" ? notesRes.value : null;
      const docsPage = docsRes.status === "fulfilled" ? docsRes.value : null;
      const reportsPage =
        reportsRes.status === "fulfilled" ? reportsRes.value : null;

      const pendingReports = (reportsPage?.data ?? []).filter(
        (r) => r.status === "PENDING_REVIEW",
      ).length;
      const overdueOrDraft = (reportsPage?.data ?? []).filter(
        (r) => r.status === "OVERDUE" || r.status === "DRAFT",
      ).length;
      const latestNote = notesPage?.data[0];

      return {
        text:
          `Tổng quan nhanh dữ liệu dự án hiện tại:\n\n` +
          `• Task Notes: ${notesPage?.pagination.totalItems ?? 0} ghi chú${latestNote ? ` (Mới nhất: "${latestNote.title}" bởi ${latestNote.authorName})` : ""}.\n` +
          `• Project Documents: ${docsPage?.pagination.totalItems ?? 0} tài liệu kỹ thuật.\n` +
          `• Work Reports: ${reportsPage?.pagination.totalItems ?? 0} báo cáo (${pendingReports} chờ duyệt, ${overdueOrDraft} bản nháp/quá hạn).`,
        links: [
          {
            label: "Task Notes",
            href: `/projects/${projectId}/work-notes`,
          },
          {
            label: "Documents",
            href: `/projects/${projectId}/documents`,
          },
          {
            label: "Work Reports",
            href: `/projects/${projectId}/work-reports`,
          },
          {
            label: "Workspace Tasks",
            href: `/projects/${projectId}/work`,
          },
        ],
      };
    }
  }

  try {
    const me = await apiClient<{
      id: string;
      organizationId?: string;
    }>("/auth/me");
    if (me?.organizationId) {
      const projectsRes = await apiClient<{
        data?: Array<{ id: string; name: string; code: string }>;
      }>(
        `/organizations/${encodeURIComponent(me.organizationId)}/projects?page=1&pageSize=5&status=ACTIVE`,
      );
      const list = projectsRes?.data ?? [];
      if (list.length > 0) {
        const summary = list
          .map((p) => `• ${p.name} (${p.code})`)
          .join("\n");
        return {
          text:
            `Mình đã kiểm tra Workspace của bạn. Hiện có ${list.length} dự án đang hoạt động:\n\n${summary}\n\n` +
            `Bạn có thể mở một dự án bất kỳ để mình tóm tắt Task Notes, tài liệu và Work Reports chi tiết!`,
          links: [
            ...list.slice(0, 2).map((p) => ({
              label: `Mở ${p.code}`,
              href: `/projects/${p.id}/work-notes`,
            })),
            { label: "Tất cả Projects", href: "/projects" },
            { label: "Mở Chat", href: "/chat" },
          ],
        };
      }
    }
  } catch {
    // Ignore and return general helpful response
  }

  return {
    text:
      `Mình là Trợ lý AI 3D của Continuum AI. Mình có thể giúp bạn:\n` +
      `• Tóm tắt tiến độ Task Notes, Project Documents và Work Reports.\n` +
      `• Tổng hợp bản tin Bàn giao (Handover Brief) từ các quyết định kỹ thuật.\n` +
      `• Gợi ý viết báo cáo theo cấu trúc chuẩn What / How / Why.`,
    links: [
      { label: "Danh sách Projects", href: "/projects" },
      { label: "Trò chuyện (Chat)", href: "/chat" },
    ],
  };
}

export default function ContinuumAiCompanion() {
  const pathname = usePathname();
  const activeProjectId = useMemo(() => extractProjectId(pathname), [pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [robotStatus, setRobotStatus] = useState<RobotStatus>("idle");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CompanionMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Mình là Continuum AI Companion. Bạn có thể bấm thử 4 trạng thái cử động (Chờ / Nghĩ / Nói / Vui) hoặc chọn một tác vụ bên dưới để mình phân tích dữ liệu dự án nhé!",
    },
  ]);

  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    const handleOpenEvent = () => {
      setIsMinimized(false);
      setIsOpen(true);
    };
    window.addEventListener("continuum:open-ai-companion", handleOpenEvent);
    return () => {
      window.removeEventListener(
        "continuum:open-ai-companion",
        handleOpenEvent,
      );
    };
  }, []);

  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const runPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || robotStatus === "thinking") return;

      clearTimers();
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: trimmed },
      ]);
      setInput("");
      setRobotStatus("thinking");

      let reply: { text: string; links: CompanionActionLink[] };
      try {
        const resolvedProjectId =
          activeProjectId ??
          extractProjectId(
            typeof window !== "undefined" ? window.location.pathname : "",
          );
        const [built] = await Promise.all([
          buildContextualReply(trimmed, resolvedProjectId),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
        reply = built;
      } catch {
        reply = {
          text: "Mình chưa thể kết nối dữ liệu lúc này. Bạn vui lòng thử lại nhé!",
          links: [],
        };
      }

      setRobotStatus("speaking");
      const words = reply.text.split(" ");
      let index = 0;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: words.slice(0, 3).join(" "),
          links: reply.links,
        },
      ]);
      index = 3;

      streamTimerRef.current = setInterval(() => {
        index += 4;
        if (index >= words.length) {
          if (streamTimerRef.current) {
            clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: reply.text } : m,
            ),
          );
          setRobotStatus("happy");
          transitionTimerRef.current = setTimeout(() => {
            setRobotStatus("idle");
          }, 1500);
          return;
        }

        const partial = words.slice(0, index).join(" ");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: partial } : m,
          ),
        );
      }, 65);
    },
    [activeProjectId, clearTimers, robotStatus],
  );

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrompt(input);
  }

  const currentMeta = STATUS_META[robotStatus];

  return (
    <>
      {/* Floating 3D Robot Widget in Bottom-Right Corner */}
      {!isOpen && (
        <div
          data-testid="ai-companion-floating-dock"
          className="fixed end-4 bottom-4 z-40 flex flex-col items-end sm:end-6 sm:bottom-5"
        >
          {isMinimized ? (
            <button
              type="button"
              onClick={() => {
                setIsMinimized(false);
                setIsOpen(true);
              }}
              aria-label="Open Continuum AI Companion"
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-brand-700 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-400 dark:border-brand-500/30 dark:bg-gray-900/95 dark:text-brand-300"
            >
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              <span>AI Companion</span>
            </button>
          ) : (
            <div className="group relative flex flex-col items-end">
              {/* Greeting bubble above the floating 3D robot */}
              <div className="mb-1 flex items-center gap-1.5 rounded-2xl rounded-ee-xs border border-gray-200/90 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur transition group-hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span>Xin chào! Cần mình tóm tắt dự án không?</span>
                <button
                  type="button"
                  aria-label="Minimize AI Companion"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsMinimized(true);
                  }}
                  className="ms-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>

              {/* 3D Robot Floating Trigger */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label="Open Continuum AI Companion"
                className="relative flex h-28 w-28 cursor-pointer flex-col items-center justify-end overflow-visible rounded-3xl transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none sm:h-32 sm:w-32"
              >
                <div className="pointer-events-none absolute inset-0 rounded-full bg-brand-500/10 blur-xl transition group-hover:bg-brand-500/20" />
                <div className="pointer-events-none h-24 w-24 sm:h-28 sm:w-28">
                  <Robot3D status={robotStatus} interactiveMouse />
                </div>
                <span className="relative z-10 -mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-gray-900/95 dark:text-brand-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  AI Companion
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expanded AI Companion Panel */}
      {isOpen && (
        <section
          role="dialog"
          aria-label="Continuum AI Companion"
          data-testid="ai-companion-panel"
          className="fixed end-3 bottom-3 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:end-6 sm:bottom-5"
        >
          {/* Top Bar */}
          <header className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600 shadow-[0_0_8px_#3b82f6]" />
              <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                Continuum AI Companion
              </h2>
              <span
                data-testid="ai-companion-status-badge"
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${currentMeta.badgeClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${currentMeta.dotClass}`}
                />
                {currentMeta.label}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Close AI Companion"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-200/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </header>

          {/* 3D Robot Stage + Speech Bubble + 4 State Switcher Pills */}
          <div className="relative border-b border-gray-100 bg-gradient-to-b from-brand-50/50 via-white to-gray-50/60 px-4 pt-3 pb-3 dark:border-gray-800 dark:from-brand-500/10 dark:via-gray-900 dark:to-gray-950">
            <div className="flex items-center gap-3">
              <div className="relative h-36 w-36 shrink-0">
                <div className="pointer-events-none absolute inset-3 rounded-full bg-brand-500/15 blur-xl" />
                <Robot3D status={robotStatus} interactiveMouse />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="rounded-2xl rounded-es-xs border border-brand-100 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-2xs dark:border-gray-800 dark:bg-gray-800/90 dark:text-gray-200">
                  <p className="font-semibold text-brand-700 dark:text-brand-300">
                    {activeProjectId
                      ? "Trợ lý ngữ cảnh Dự án"
                      : "Trợ lý ngữ cảnh Workspace"}
                  </p>
                  <p className="mt-1 text-gray-600 dark:text-gray-300">
                    {currentMeta.bubble}
                  </p>
                </div>

                {/* 4 State Switcher Pills (Chờ / Nghĩ / Nói / Vui) */}
                <div>
                  <span className="block text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                    Trạng thái Robot 3D
                  </span>
                  <div
                    role="group"
                    aria-label="Robot animation states"
                    className="mt-1 grid grid-cols-4 gap-1"
                  >
                    {ALL_STATUSES.map((stateKey) => {
                      const active = robotStatus === stateKey;
                      return (
                        <button
                          key={stateKey}
                          type="button"
                          onClick={() => {
                            clearTimers();
                            setRobotStatus(stateKey);
                          }}
                          className={`rounded-lg border px-2 py-1 text-center text-[11px] font-semibold transition ${
                            active
                              ? "border-brand-600 bg-brand-600 text-white shadow-2xs dark:border-brand-500 dark:bg-brand-500"
                              : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {STATUS_META[stateKey].shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Context Prompts */}
          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 bg-gray-50/50 px-3.5 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <button
              type="button"
              onClick={() =>
                void runPrompt(
                  activeProjectId
                    ? "Tóm tắt tình hình dự án hiện tại"
                    : "Tóm tắt các dự án trong Workspace",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              📊 Tóm tắt dự án
            </button>
            <button
              type="button"
              onClick={() =>
                void runPrompt(
                  "Tổng hợp bản tin Bàn giao (Handover Brief) và các quyết định kỹ thuật",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              🤝 Bản tin Handover
            </button>
            <button
              type="button"
              onClick={() =>
                void runPrompt(
                  "Gợi ý soạn nhanh Work Report theo chuẩn What / How / Why",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              ✍️ Soạn What / How / Why
            </button>
          </div>

          {/* Conversation Feed */}
          <div className="max-h-60 min-h-44 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    message.role === "user"
                      ? "rounded-ee-xs bg-brand-600 text-white"
                      : "rounded-es-xs border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-100"
                  }`}
                >
                  {message.content}
                </div>

                {message.links && message.links.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.links.map((link) => (
                      <Link
                        key={`${message.id}-${link.href}-${link.label}`}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Hỏi AI về dự án, Task Notes, Handover..."
                aria-label="Hỏi AI điều gì đó"
                className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || robotStatus === "thinking"}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 px-3.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gửi
              </button>
            </div>
            <p className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <span>Đồng bộ dữ liệu thật theo quyền RBAC của bạn</span>
              <a
                href="https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-600 dark:hover:text-gray-300"
              >
                3D Model: Shayan (CC BY 4.0)
              </a>
            </p>
          </form>
        </section>
      )}
    </>
  );
}
