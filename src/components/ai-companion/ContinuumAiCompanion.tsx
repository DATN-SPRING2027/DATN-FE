"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

type StatusMetaEntry = {
  label: string;
  subtitle: string;
  badgeClass: string;
  dotClass: string;
};

const STATUS_META_VI: Record<RobotStatus, StatusMetaEntry> = {
  idle: {
    label: "Sẵn sàng",
    subtitle:
      "Trợ lý ngữ cảnh dự án · Tự động tổng hợp Ghi chú công việc & Báo cáo",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  thinking: {
    label: "Đang phân tích...",
    subtitle: "Đang truy vấn dữ liệu dự án theo quyền truy cập của bạn...",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    dotClass: "bg-amber-500 animate-ping",
  },
  speaking: {
    label: "Đang trả lời...",
    subtitle: "Đang tổng hợp thông tin từ Không gian làm việc cho bạn...",
    badgeClass:
      "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
    dotClass: "bg-brand-500 animate-pulse",
  },
  happy: {
    label: "Hoàn tất",
    subtitle: "Đã phân tích xong! Bạn cần kiểm tra thêm mục nào không?",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
};

const STATUS_META_EN: Record<RobotStatus, StatusMetaEntry> = {
  idle: {
    label: "Ready",
    subtitle:
      "Project context assistant · Auto-synthesizes Task Notes & Reports",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  thinking: {
    label: "Analyzing...",
    subtitle: "Querying project workspace data within your RBAC permissions...",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    dotClass: "bg-amber-500 animate-ping",
  },
  speaking: {
    label: "Replying...",
    subtitle: "Synthesizing workspace insights for you...",
    badgeClass:
      "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
    dotClass: "bg-brand-500 animate-pulse",
  },
  happy: {
    label: "Done",
    subtitle: "Analysis complete! Need to inspect anything else?",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
};

function getWelcomeText(isEn: boolean): string {
  return isEn
    ? "Hello! I can summarize project progress, compile a Handover Brief, or draft structured What / How / Why reports for you."
    : "Xin chào! Mình có thể tóm tắt tiến độ dự án, tổng hợp bản tin bàn giao tri thức hoặc gợi ý báo cáo chuẩn Việc đã làm / Cách thực hiện / Lý do cho bạn.";
}

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
  isEn: boolean,
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
            text: isEn
              ? `Based on the latest task note (${latest.taskKey ? `${latest.taskKey} · ` : ""}${latest.title}), here is a structured 3-part draft for your Work Report:\n\n` +
                `• What was done: ${latest.accomplishments}\n` +
                `• How it was done: ${latest.approach}\n` +
                `• Why this approach: ${latest.reason}`
              : `Dựa trên ghi chú công việc gần nhất (${latest.taskKey ? `${latest.taskKey} · ` : ""}${latest.title}), đây là bản nháp chuẩn cấu trúc 3 phần để bạn đưa vào Báo cáo công việc:\n\n` +
                `• Việc đã làm: ${latest.accomplishments}\n` +
                `• Cách thực hiện: ${latest.approach}\n` +
                `• Lý do chọn hướng này: ${latest.reason}`,
            links: [
              {
                label: isEn ? "Open Work Reports" : "Mở Báo cáo công việc",
                href: `/projects/${projectId}/work-reports`,
              },
              {
                label: isEn ? "Open Task Notes" : "Mở Ghi chú công việc",
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
      text: isEn
        ? `Continuum AI structured note & report template (What / How / Why):\n\n` +
          `• What was done: Summarize completed items and concrete deliverables.\n` +
          `• How it was done: Describe technical implementation, APIs/components, or workflow.\n` +
          `• Why this approach: Explain the rationale so handover recipients understand the context.`
        : `Gợi ý khung ghi chú & báo cáo chuẩn Continuum AI (Việc đã làm / Cách thực hiện / Lý do):\n\n` +
          `• Việc đã làm: Tóm tắt hạng mục đã hoàn thành và kết quả đầu ra rõ ràng.\n` +
          `• Cách thực hiện: Nêu giải pháp kỹ thuật, API/thành phần hoặc quy trình đã áp dụng.\n` +
          `• Lý do chọn hướng này: Giải thích bối cảnh để người tiếp nhận bàn giao hiểu rõ quyết định.`,
      links: projectId
        ? [
            {
              label: isEn ? "Open Work Reports" : "Mở Báo cáo công việc",
              href: `/projects/${projectId}/work-reports`,
            },
          ]
        : [
            {
              label: isEn ? "All Projects" : "Danh sách Dự án",
              href: "/projects",
            },
          ],
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
          .map((n) =>
            isEn
              ? `• [${n.taskKey ?? "Task"}] ${n.title}: ${n.reason} (by ${n.authorName})`
              : `• [${n.taskKey ?? "Công việc"}] ${n.title}: ${n.reason} (Thực hiện bởi ${n.authorName})`,
          )
          .join("\n");
        const docTitles = (docsPage?.data ?? [])
          .slice(0, 3)
          .map((d) => `• ${d.title} (${d.type} · v${d.version})`)
          .join("\n");

        return {
          text: isEn
            ? `Handover Brief for the current project:\n\n` +
              `1. Recent technical decisions (${notesPage?.pagination.totalItems ?? 0} Task Notes):\n` +
              `${decisions || "• No task notes recorded yet."}\n\n` +
              `2. Reference documentation (${docsPage?.pagination.totalItems ?? 0} Project Documents):\n` +
              `${docTitles || "• No documents uploaded yet."}`
            : `Bản tóm tắt Bàn giao tri thức của dự án hiện tại:\n\n` +
              `1. Quyết định kỹ thuật gần đây (${notesPage?.pagination.totalItems ?? 0} ghi chú công việc):\n` +
              `${decisions || "• Chưa có ghi chú công việc nào được ghi nhận."}\n\n` +
              `2. Tài liệu nền tảng (${docsPage?.pagination.totalItems ?? 0} tài liệu dự án):\n` +
              `${docTitles || "• Chưa có tài liệu nào."}`,
          links: [
            {
              label: isEn ? "View Task Notes" : "Xem Ghi chú công việc",
              href: `/projects/${projectId}/work-notes`,
            },
            {
              label: isEn ? "View Project Documents" : "Xem Tài liệu dự án",
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
        text: isEn
          ? `Quick overview of the current project:\n\n` +
            `• Task Notes: ${notesPage?.pagination.totalItems ?? 0} notes${latestNote ? ` (Latest: "${latestNote.title}" by ${latestNote.authorName})` : ""}.\n` +
            `• Project Documents: ${docsPage?.pagination.totalItems ?? 0} technical documents.\n` +
            `• Work Reports: ${reportsPage?.pagination.totalItems ?? 0} reports (${pendingReports} pending review, ${overdueOrDraft} draft/overdue).`
          : `Tổng quan nhanh dữ liệu dự án hiện tại:\n\n` +
            `• Ghi chú công việc: ${notesPage?.pagination.totalItems ?? 0} ghi chú${latestNote ? ` (Mới nhất: "${latestNote.title}" bởi ${latestNote.authorName})` : ""}.\n` +
            `• Tài liệu dự án: ${docsPage?.pagination.totalItems ?? 0} tài liệu kỹ thuật.\n` +
            `• Báo cáo công việc: ${reportsPage?.pagination.totalItems ?? 0} báo cáo (${pendingReports} chờ duyệt, ${overdueOrDraft} bản nháp/quá hạn).`,
        links: [
          {
            label: isEn ? "Task Notes" : "Ghi chú công việc",
            href: `/projects/${projectId}/work-notes`,
          },
          {
            label: isEn ? "Documents" : "Tài liệu",
            href: `/projects/${projectId}/documents`,
          },
          {
            label: isEn ? "Work Reports" : "Báo cáo công việc",
            href: `/projects/${projectId}/work-reports`,
          },
          {
            label: isEn ? "Workspace Tasks" : "Công việc dự án",
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
          text: isEn
            ? `I checked your Workspace. There are ${list.length} active projects:\n\n${summary}\n\n` +
              `Open any project so I can summarize its Task Notes, Documents, and Work Reports in detail!`
            : `Mình đã kiểm tra Không gian làm việc của bạn. Hiện có ${list.length} dự án đang hoạt động:\n\n${summary}\n\n` +
              `Bạn có thể mở một dự án bất kỳ để mình tóm tắt Ghi chú công việc, Tài liệu và Báo cáo chi tiết!`,
          links: [
            ...list.slice(0, 2).map((p) => ({
              label: isEn ? `Open ${p.code}` : `Mở ${p.code}`,
              href: `/projects/${p.id}/work-notes`,
            })),
            {
              label: isEn ? "All Projects" : "Tất cả Dự án",
              href: "/projects",
            },
            { label: isEn ? "Open Chat" : "Mở Trò chuyện", href: "/chat" },
          ],
        };
      }
    }
  } catch {
    // Ignore and return general helpful response
  }

  return {
    text: isEn
      ? `I am Continuum AI's 3D Companion. I can help you:\n` +
        `• Summarize Task Notes, Project Documents, and Work Reports.\n` +
        `• Synthesize Handover Briefs from recent technical decisions.\n` +
        `• Draft structured reports using the What / How / Why format.`
      : `Mình là Trợ lý AI 3D của Continuum AI. Mình có thể giúp bạn:\n` +
        `• Tóm tắt tiến độ Ghi chú công việc, Tài liệu dự án và Báo cáo công việc.\n` +
        `• Tổng hợp bản tin Bàn giao tri thức từ các quyết định kỹ thuật.\n` +
        `• Gợi ý viết báo cáo theo cấu trúc chuẩn Việc đã làm / Cách thực hiện / Lý do.`,
    links: [
      {
        label: isEn ? "All Projects" : "Danh sách Dự án",
        href: "/projects",
      },
      { label: isEn ? "Open Chat" : "Trò chuyện", href: "/chat" },
    ],
  };
}

export default function ContinuumAiCompanion({
  locale = "vi",
}: {
  locale?: string;
} = {}) {
  const isEn = locale === "en";
  const pathname = usePathname();
  const activeProjectId = useMemo(() => extractProjectId(pathname), [pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [robotStatus, setRobotStatus] = useState<RobotStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CompanionMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: getWelcomeText(isEn),
    },
  ]);

  const dockRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const suppressNextClickRef = useRef(false);
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
          buildContextualReply(trimmed, resolvedProjectId, isEn),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
        reply = built;
      } catch {
        reply = {
          text: isEn
            ? "Could not connect to workspace data right now. Please try again!"
            : "Mình chưa thể kết nối dữ liệu lúc này. Bạn vui lòng thử lại nhé!",
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
    [activeProjectId, clearTimers, isEn, robotStatus],
  );

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || typeof window === "undefined") return prev;
        const maxX = Math.max(12, window.innerWidth - 150);
        const maxY = Math.max(12, window.innerHeight - 150);
        return {
          x: Math.min(Math.max(12, prev.x), maxX),
          y: Math.min(Math.max(12, prev.y), maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      targetType: "dock" | "panel",
    ) => {
      if (event.button !== 0) return;
      const targetEl = event.target as HTMLElement | null;
      if (targetEl?.closest('[data-no-drag="true"]')) return;

      const containerEl =
        targetType === "dock" ? dockRef.current : panelRef.current;
      const rect = containerEl?.getBoundingClientRect();
      const fallbackW = targetType === "dock" ? 160 : 400;
      const fallbackH = targetType === "dock" ? 160 : 480;
      const width = rect && rect.width > 0 ? rect.width : fallbackW;
      const height = rect && rect.height > 0 ? rect.height : fallbackH;

      const viewportW =
        typeof window !== "undefined" && window.innerWidth > 0
          ? window.innerWidth
          : 1440;
      const viewportH =
        typeof window !== "undefined" && window.innerHeight > 0
          ? window.innerHeight
          : 900;

      const hasMeasuredRect = Boolean(rect && (rect.left > 0 || rect.top > 0));
      const initialLeft =
        position?.x ??
        (hasMeasuredRect && rect
          ? rect.left
          : Math.max(12, viewportW - width - 24));
      const initialTop =
        position?.y ??
        (hasMeasuredRect && rect
          ? rect.top
          : Math.max(12, viewportH - height - 20));

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      let moved = false;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startClientX;
        const dy = moveEvent.clientY - startClientY;

        if (!moved && Math.hypot(dx, dy) >= 6) {
          moved = true;
          suppressNextClickRef.current = true;
          setIsDragging(true);
        }

        if (!moved) return;

        const curW =
          typeof window !== "undefined" && window.innerWidth > 0
            ? window.innerWidth
            : 1440;
        const curH =
          typeof window !== "undefined" && window.innerHeight > 0
            ? window.innerHeight
            : 900;
        const maxX = Math.max(12, curW - width - 12);
        const maxY = Math.max(12, curH - height - 12);

        const nextX = Math.min(Math.max(12, initialLeft + dx), maxX);
        const nextY = Math.min(Math.max(12, initialTop + dy), maxY);

        setPosition({
          x: Math.round(nextX),
          y: Math.round(nextY),
        });
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        if (moved) {
          setIsDragging(false);
          setTimeout(() => {
            suppressNextClickRef.current = false;
          }, 120);
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [position],
  );

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrompt(input);
  }

  const displayRobotStatus: RobotStatus =
    isDragging && robotStatus === "idle" ? "happy" : robotStatus;
  const currentMeta = (isEn ? STATUS_META_EN : STATUS_META_VI)[
    displayRobotStatus
  ];
  const companionPillLabel = isEn ? "AI Companion" : "Trợ lý AI";

  const isOnLeftHalf =
    position !== null &&
    typeof window !== "undefined" &&
    position.x < window.innerWidth / 2;

  const panelStyle = useMemo(() => {
    if (!position) return undefined;
    const viewportW =
      typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth
        : 1440;
    const viewportH =
      typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : 900;
    const left = Math.min(Math.max(12, position.x), Math.max(12, viewportW - 412));
    const top = Math.min(Math.max(12, position.y), Math.max(12, viewportH - 510));
    return { left: `${left}px`, top: `${top}px` };
  }, [position]);

  return (
    <>
      {/* Free-Draggable Floating 3D Robot Widget */}
      {!isOpen && (
        <div
          ref={dockRef}
          data-testid="ai-companion-floating-dock"
          data-dragging={isDragging ? "true" : "false"}
          onPointerDown={(event) => startDrag(event, "dock")}
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : undefined
          }
          className={`fixed z-40 flex flex-col select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } ${isOnLeftHalf ? "items-start" : "items-end"} ${
            position ? "" : "end-4 bottom-4 sm:end-6 sm:bottom-5"
          }`}
        >
          {isMinimized ? (
            <button
              type="button"
              onClick={(event) => {
                if (suppressNextClickRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  suppressNextClickRef.current = false;
                  return;
                }
                setIsMinimized(false);
                setIsOpen(true);
              }}
              aria-label="Open Continuum AI Companion"
              className="inline-flex cursor-grab items-center gap-2 rounded-full border border-brand-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-brand-700 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-400 active:cursor-grabbing dark:border-brand-500/30 dark:bg-gray-900/95 dark:text-brand-300"
            >
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              <span>{companionPillLabel}</span>
            </button>
          ) : (
            <div
              className={`group relative flex flex-col ${
                isOnLeftHalf ? "items-start" : "items-end"
              }`}
            >
              {/* Greeting bubble above the floating 3D robot */}
              <div
                className={`mb-1 flex items-center gap-1.5 rounded-2xl border border-gray-200/90 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur transition group-hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200 ${
                  isOnLeftHalf ? "rounded-es-xs" : "rounded-ee-xs"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span>
                  {isEn
                    ? "Hi! Need a quick project summary?"
                    : "Xin chào! Cần mình tóm tắt dự án không?"}
                </span>
                <button
                  type="button"
                  data-no-drag="true"
                  aria-label="Minimize AI Companion"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsMinimized(true);
                  }}
                  className="ms-1 cursor-pointer rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>

              {/* 3D Robot Floating Trigger (Click to open, Hold & Drag to move anywhere) */}
              <button
                type="button"
                onClick={(event) => {
                  if (suppressNextClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressNextClickRef.current = false;
                    return;
                  }
                  setIsOpen(true);
                }}
                title={
                  isEn
                    ? "Click to open AI Companion · Hold & drag anywhere"
                    : "Bấm để mở Trợ lý AI · Nhấn giữ chuột để kéo đi mọi nơi"
                }
                aria-label="Open Continuum AI Companion"
                className={`relative flex h-28 w-28 flex-col items-center justify-end overflow-visible rounded-3xl transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none sm:h-32 sm:w-32 ${
                  isDragging
                    ? "scale-105 cursor-grabbing"
                    : "cursor-grab hover:scale-105"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-full bg-brand-500/10 blur-xl transition group-hover:bg-brand-500/20" />
                <div className="pointer-events-none h-24 w-24 sm:h-28 sm:w-28">
                  <Robot3D status={displayRobotStatus} interactiveMouse />
                </div>
                <span className="relative z-10 -mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-gray-900/95 dark:text-brand-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {companionPillLabel}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expanded AI Companion Panel */}
      {isOpen && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Continuum AI Companion"
          data-testid="ai-companion-panel"
          style={panelStyle}
          className={`fixed z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 ${
            position ? "" : "end-3 bottom-3 sm:end-6 sm:bottom-5"
          }`}
        >
          {/* Unified Compact Hero Header with 3D Robot Stage (Also Draggable) */}
          <header
            data-testid="ai-companion-drag-handle"
            onPointerDown={(event) => startDrag(event, "panel")}
            className={`relative flex items-center gap-3 border-b border-gray-100 bg-gradient-to-b from-brand-50/60 via-white to-gray-50/40 px-3.5 py-2.5 select-none touch-none dark:border-gray-800 dark:from-brand-500/10 dark:via-gray-900 dark:to-gray-900 ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div className="pointer-events-none relative h-20 w-20 shrink-0">
              <div className="pointer-events-none absolute inset-2 rounded-full bg-brand-500/15 blur-lg" />
              <Robot3D status={displayRobotStatus} interactiveMouse />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                  Continuum AI
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
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500 dark:text-gray-400">
                {currentMeta.subtitle}
              </p>
            </div>

            <div
              data-no-drag="true"
              className="flex shrink-0 items-center gap-0.5 self-start pt-0.5"
            >
              <a
                href="https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2"
                target="_blank"
                rel="noreferrer"
                title={
                  isEn
                    ? "3D Model: Shayan (CC BY 4.0) · RBAC-synced"
                    : "Mô hình 3D: Shayan (CC BY 4.0) · Đồng bộ theo quyền truy cập"
                }
                aria-label="3D Model: Shayan (CC BY 4.0)"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                ⓘ
              </a>
              <button
                type="button"
                aria-label="Close AI Companion"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Spacious Conversation Feed */}
          <div className="max-h-80 min-h-56 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`ai-companion-msg-${message.role}`}
                className={`flex flex-col ${
                  message.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    message.role === "user"
                      ? "rounded-ee-xs bg-brand-600 text-white shadow-2xs"
                      : "rounded-es-xs border border-gray-200/80 bg-gray-50/90 text-gray-800 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-100"
                  }`}
                >
                  {message.id === "welcome" ? getWelcomeText(isEn) : message.content}
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

          {/* Quick Context Prompts Docked Above Composer */}
          <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-gray-50/60 px-3.5 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <button
              type="button"
              disabled={robotStatus === "thinking"}
              onClick={() =>
                void runPrompt(
                  isEn
                    ? activeProjectId
                      ? "Summarize current project status"
                      : "Summarize active workspace projects"
                    : activeProjectId
                      ? "Tóm tắt tình hình dự án hiện tại"
                      : "Tóm tắt các dự án trong Không gian làm việc",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {isEn ? "📊 Summarize project" : "📊 Tóm tắt dự án"}
            </button>
            <button
              type="button"
              disabled={robotStatus === "thinking"}
              onClick={() =>
                void runPrompt(
                  isEn
                    ? "Compile a Handover Brief and recent technical decisions"
                    : "Tổng hợp bản tin Bàn giao tri thức và các quyết định kỹ thuật",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {isEn ? "🤝 Handover Brief" : "🤝 Bản tin Bàn giao"}
            </button>
            <button
              type="button"
              disabled={robotStatus === "thinking"}
              onClick={() =>
                void runPrompt(
                  isEn
                    ? "Suggest a structured Work Report using What / How / Why"
                    : "Gợi ý soạn nhanh Báo cáo công việc theo chuẩn Việc đã làm / Cách thực hiện / Lý do",
                )
              }
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {isEn ? "✍️ Draft What / How / Why" : "✍️ Soạn Báo cáo chuẩn"}
            </button>
          </div>

          {/* Clean Chat Composer */}
          <form
            onSubmit={handleFormSubmit}
            className="border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  isEn
                    ? "Ask AI about project, Task Notes, Handover..."
                    : "Hỏi AI về dự án, Ghi chú công việc, Bàn giao..."
                }
                aria-label={isEn ? "Ask AI anything" : "Hỏi AI điều gì đó"}
                className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || robotStatus === "thinking"}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 px-3.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEn ? "Send" : "Gửi"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
