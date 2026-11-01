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
import { ApiError } from "@/lib/api-client";
import { CompanionChatClient } from "./companion-chat-client";
import CompanionProjectPicker from "./CompanionProjectPicker";
import { useTranslations } from "next-intl";
import WorkReportReminderNotice from "./WorkReportReminderNotice";
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

export default function ContinuumAiCompanion({
  locale = "vi",
}: {
  locale?: string;
} = {}) {
  const t = useTranslations("aiCompanionNotifications");
  const [chatNotice, setChatNotice] = useState(false);
  const isEn = locale === "en";
  const pathname = usePathname();
  const activeProjectId = useMemo(() => extractProjectId(pathname), [pathname]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const chatClient = useRef(new CompanionChatClient());
  const requestController = useRef<AbortController | null>(null);
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
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { clearTimers(); requestController.current?.abort(); };
  }, [clearTimers]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleCompleted = (event: Event) => {
      const detail = (
        event as CustomEvent<{ projectId: string; threadId: string }>
      ).detail;
      if (!detail?.projectId || !detail.threadId) return;
      setChatNotice(true);
      setIsMinimized(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setChatNotice(false), 8000);
    };
    window.addEventListener("continuum:ai-chat-completed", handleCompleted);
    return () => {
      window.removeEventListener(
        "continuum:ai-chat-completed",
        handleCompleted,
      );
      if (timer) clearTimeout(timer);
    };
  }, []);

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
    if (
      isOpen &&
      typeof messagesEndRef.current?.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => () => { requestController.current?.abort(); }, [activeProjectId]);

  const runPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || requestController.current) return;
      const projectId = activeProjectId ?? selectedProjectId;
      if (!projectId) {
        setMessages((previous) => [...previous, { id: `context-${Date.now()}`, role: "assistant", content: t("chooseProjectHelp") }]);
        return;
      }
      clearTimers();
      const controller = new AbortController();
      requestController.current = controller;
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((previous) => [...previous,
        { id: `user-${Date.now()}`, role: "user", content: trimmed },
        { id: assistantMsgId, role: "assistant", content: "" },
      ]);
      setInput("");
      setRobotStatus("thinking");
      try {
        const reply = await chatClient.current.ask(projectId, trimmed, controller.signal, (content) => {
          if (controller.signal.aborted) return;
          setRobotStatus("speaking");
          setMessages((previous) => previous.map((message) => message.id === assistantMsgId ? { ...message, content } : message));
        });
        if (controller.signal.aborted) return;
        setMessages((previous) => previous.map((message) => message.id === assistantMsgId ? {
          ...message, content: reply.content, links: [{ label: t("openAiChat"), href: `/ai-chat?projectId=${encodeURIComponent(projectId)}` }],
        } : message));
        setRobotStatus("happy");
        setChatNotice(true);
        transitionTimerRef.current = setTimeout(() => { setRobotStatus("idle"); setChatNotice(false); }, 8000);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError && error.code === "AI_ENGINE_NOT_CONFIGURED"
          ? t("notConfigured") : error instanceof ApiError && [401, 403, 404].includes(error.status)
            ? t("accessDenied") : t("aiUnavailable");
        setMessages((previous) => previous.map((item) => item.id === assistantMsgId ? { ...item, content: message } : item));
        setRobotStatus("idle");
        setInput(trimmed);
      } finally {
        if (controller.signal.aborted) setRobotStatus("idle");
        if (requestController.current === controller) requestController.current = null;
      }
    }, [activeProjectId, selectedProjectId, clearTimers, t],
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
    (event: ReactPointerEvent<HTMLElement>, targetType: "dock" | "panel") => {
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
    const left = Math.min(
      Math.max(12, position.x),
      Math.max(12, viewportW - 412),
    );
    const top = Math.min(
      Math.max(12, position.y),
      Math.max(12, viewportH - 510),
    );
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
          className={`fixed z-40 flex touch-none flex-col select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } ${isOnLeftHalf ? "items-start" : "items-end"} ${
            position ? "" : "end-4 bottom-4 sm:end-6 sm:bottom-5"
          }`}
        >
          <WorkReportReminderNotice visible={!isOpen} />
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
                <span role="status" aria-live="polite">
                  {chatNotice ? (
                    t("chatCompleted")
                  ) : isEn ? (
                    "Hi! Need a quick project summary?"
                  ) : (
                    "Xin chào! Cần mình tóm tắt dự án không?"
                  )}
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
            className={`relative flex touch-none items-center gap-3 border-b border-gray-100 bg-gradient-to-b from-brand-50/60 via-white to-gray-50/40 px-3.5 py-2.5 select-none dark:border-gray-800 dark:from-brand-500/10 dark:via-gray-900 dark:to-gray-900 ${
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
          {!activeProjectId && <CompanionProjectPicker value={selectedProjectId} onChange={setSelectedProjectId} disabled={robotStatus === "thinking" || robotStatus === "speaking"} />}

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
                  {message.id === "welcome"
                    ? getWelcomeText(isEn)
                    : message.content}
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
              disabled={(robotStatus === "thinking" || robotStatus === "speaking")}
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
              disabled={(robotStatus === "thinking" || robotStatus === "speaking")}
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
              disabled={(robotStatus === "thinking" || robotStatus === "speaking")}
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
                disabled={!input.trim() || (robotStatus === "thinking" || robotStatus === "speaking")}
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
