"use client";

import React, { useState, useId } from "react";
import {
  DocsIcon,
  CheckCircleIcon,
  ShootingStarIcon,
  TaskIcon,
  FileIcon,
  LockIcon,
  ArrowRightIcon,
} from "@/icons";

export interface KnowledgeNodeItem {
  id: string;
  step: string;
  label: string;
  badge: string;
  stageName: string;
  title: string;
  shortDesc: string;
  detail: string;
  actor: string;
  x: number; // SVG coordinate (viewBox 600x500)
  y: number;
  icon: (props: { className?: string }) => React.ReactElement;
  connectedTo: string[]; // Node IDs connected
  accentColor: string;
}

export const KNOWLEDGE_LIFECYCLE_NODES: KnowledgeNodeItem[] = [
  {
    id: "capture",
    step: "01",
    label: "Ghi nhận",
    badge: "In-flow Capture",
    stageName: "Giai đoạn 01 • Ghi nhận công việc",
    title: "Ghi nhận tri thức trong quá trình làm việc",
    shortDesc: "Work Notes & Quyết định kỹ thuật",
    detail:
      "Thành viên ghi nhận các quyết định kiến trúc, cách xử lý lỗi và trở ngại ngay khi công việc diễn ra, không để trôi vào chat hay chờ đến ngày bàn giao.",
    actor: "Thành viên dự án / Developer",
    x: 130,
    y: 130,
    icon: DocsIcon,
    connectedTo: ["core", "evidence", "handover"],
    accentColor: "#3B82F6",
  },
  {
    id: "evidence",
    step: "02",
    label: "Bằng chứng",
    badge: "Source & Context",
    stageName: "Giai đoạn 02 • Bằng chứng xác thực",
    title: "Liên kết lý do và nguồn gốc xác thực",
    shortDesc: "Git PR, commit & specs đính kèm",
    detail:
      "Mọi ghi chú đều đính kèm bằng chứng xác thực: PR kỹ thuật, commit hash, issue tracker hoặc tài liệu kiến trúc để người sau kiểm chứng nhanh chóng.",
    actor: "Hệ thống tích hợp (Git, Jira, Docs)",
    x: 300,
    y: 75,
    icon: FileIcon,
    connectedTo: ["core", "capture", "proposal"],
    accentColor: "#60A5FA",
  },
  {
    id: "proposal",
    step: "03",
    label: "AI Đề xuất",
    badge: "AI Synthesis",
    stageName: "Giai đoạn 03 • AI Tổng hợp & Đề xuất",
    title: "AI gom cụm ngữ cảnh & đề xuất tri thức",
    shortDesc: "Chắt lọc tri thức từ nguồn được phép",
    detail:
      "Continuum AI Engine phân tích các nguồn dữ liệu được cấp phép, gom cụm các quyết định liên quan và đề xuất tri thức ứng viên vào kho dự án.",
    actor: "Continuum AI Assistant",
    x: 470,
    y: 130,
    icon: ShootingStarIcon,
    connectedTo: ["core", "evidence", "verification"],
    accentColor: "#6366F1",
  },
  {
    id: "verification",
    step: "04",
    label: "Kiểm chứng",
    badge: "Human-in-the-loop",
    stageName: "Giai đoạn 04 • Thẩm định bởi con người",
    title: "Tri thức được con người xác minh 100%",
    shortDesc: "Tech Lead kiểm duyệt trước khi lưu",
    detail:
      "Nguyên tắc cốt lõi: AI hỗ trợ tổng hợp và đề xuất, nhưng chỉ người có thẩm quyền (Lead/Owner) mới được phê duyệt tri thức chính thức.",
    actor: "Tech Lead / Module Owner",
    x: 470,
    y: 370,
    icon: CheckCircleIcon,
    connectedTo: ["core", "proposal", "retrieval"],
    accentColor: "#2563EB",
  },
  {
    id: "retrieval",
    step: "05",
    label: "Truy xuất",
    badge: "Source-based RAG",
    stageName: "Giai đoạn 05 • Truy vấn có trích dẫn",
    title: "Câu trả lời có thể kiểm chứng nguồn",
    shortDesc: "Hỏi đáp tự nhiên với trích dẫn minh bạch",
    detail:
      "Thành viên tra cứu và hỏi đáp về dự án bằng ngôn ngữ tự nhiên. Câu trả lời luôn kèm trích dẫn nguồn; nếu thiếu tài liệu, hệ thống thông báo minh bạch.",
    actor: "Mọi thành viên trong nhóm",
    x: 300,
    y: 425,
    icon: LockIcon,
    connectedTo: ["core", "verification", "handover"],
    accentColor: "#4F46E5",
  },
  {
    id: "handover",
    step: "06",
    label: "Bàn giao",
    badge: "Zero-loss Handover",
    stageName: "Giai đoạn 06 • Bàn giao & Kế thừa",
    title: "Bàn giao trọn vẹn ngữ cảnh cho người mới",
    shortDesc: "Tiếp nối công việc không gián đoạn",
    detail:
      "Người tiếp nhận dự án kế thừa đầy đủ gói bàn giao gồm trách nhiệm đang mở, các câu hỏi chưa giải quyết và tài liệu đã thẩm định từ người đi trước.",
    actor: "Người kế nhiệm / Nhân sự mới",
    x: 130,
    y: 370,
    icon: TaskIcon,
    connectedTo: ["core", "retrieval", "capture"],
    accentColor: "#818CF8",
  },
];

export default function KnowledgeEcosystemGraph({
  className = "",
}: {
  className?: string;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("verification");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const filterId = useId();

  const activeId = hoveredNodeId || selectedNodeId;
  const activeNode =
    KNOWLEDGE_LIFECYCLE_NODES.find((n) => n.id === activeId) ||
    KNOWLEDGE_LIFECYCLE_NODES[3]; // default to verification

  const isConnected = (sourceId: string, targetId: string) => {
    if (activeId === "core") return true;
    if (sourceId === "core" && targetId === activeId) return true;
    if (targetId === "core" && sourceId === activeId) return true;
    const current = KNOWLEDGE_LIFECYCLE_NODES.find((n) => n.id === activeId);
    if (!current) return false;
    return current.connectedTo.includes(sourceId) || current.connectedTo.includes(targetId);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className={`relative rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-[#F8FAFC] to-[#EFF6FF]/40 p-4 sm:p-6 shadow-xl shadow-blue-500/5 transition-all dark:border-gray-800 dark:from-gray-900 dark:via-gray-900/95 dark:to-blue-950/20 ${className}`}
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 text-xs dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          <span className="font-bold text-[#0F172A] tracking-wide dark:text-white">
            Mạng lưới Tri thức Sống (Living Knowledge Network)
          </span>
        </div>
        <span className="hidden sm:inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/80 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
          Tương tác trực tiếp
        </span>
      </div>

      {/* SVG Network Graph Canvas */}
      <div className="relative aspect-[6/5] w-full overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xs border border-slate-200/70 p-1 dark:bg-gray-950/60 dark:border-gray-800">
        {/* Soft Grid Background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(#2563EB 1px, transparent 1px), radial-gradient(#2563EB 1px, #ffffff 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />

        <svg
          viewBox="0 0 600 500"
          className="h-full w-full select-none"
          role="img"
          aria-label="Sơ đồ vòng đời tri thức sống Continuum AI"
        >
          <defs>
            <filter id={`${filterId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id={`${filterId}-coreGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1D4ED8" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id={`${filterId}-pulseGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Central Pulsing Halo Ring */}
          <circle
            cx="300"
            cy="250"
            r="165"
            fill="none"
            stroke="url(#"
            strokeDasharray="4 6"
            className="stroke-blue-200/60 dark:stroke-blue-800/40 animate-[spin_60s_linear_infinite]"
          />
          <circle
            cx="300"
            cy="250"
            r="80"
            fill={`url(#${filterId}-pulseGrad)`}
            className="animate-pulse"
          />

          {/* Connected Edges between Lifecycle Nodes (Outer ring) */}
          {KNOWLEDGE_LIFECYCLE_NODES.map((node, i) => {
            const nextNode =
              KNOWLEDGE_LIFECYCLE_NODES[(i + 1) % KNOWLEDGE_LIFECYCLE_NODES.length];
            const activeEdge = isConnected(node.id, nextNode.id);
            return (
              <line
                key={`ring-${node.id}-${nextNode.id}`}
                x1={node.x}
                y1={node.y}
                x2={nextNode.x}
                y2={nextNode.y}
                stroke={activeEdge ? "#2563EB" : "#CBD5E1"}
                strokeWidth={activeEdge ? 2.5 : 1.2}
                strokeDasharray={activeEdge ? undefined : "3 3"}
                className={`transition-all duration-300 ${
                  activeEdge
                    ? "opacity-90 dark:stroke-blue-400"
                    : "opacity-40 dark:stroke-gray-700"
                }`}
              />
            );
          })}

          {/* Radial Spokes connecting Central Core to Nodes */}
          {KNOWLEDGE_LIFECYCLE_NODES.map((node) => {
            const activeSpoke = isConnected("core", node.id) && activeId === node.id;
            return (
              <g key={`spoke-${node.id}`}>
                <line
                  x1="300"
                  y1="250"
                  x2={node.x}
                  y2={node.y}
                  stroke={activeSpoke ? "#3B82F6" : "#E2E8F0"}
                  strokeWidth={activeSpoke ? 2.5 : 1}
                  className={`transition-all duration-300 ${
                    activeSpoke
                      ? "opacity-100 dark:stroke-blue-400"
                      : "opacity-50 dark:stroke-gray-800"
                  }`}
                />
                {activeSpoke && (
                  <circle
                    cx={(300 + node.x) / 2}
                    cy={(250 + node.y) / 2}
                    r="3"
                    fill="#2563EB"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}

          {/* Center Core Node: Continuum AI */}
          <g
            className="cursor-pointer"
            onClick={() => {
              setSelectedNodeId("verification");
            }}
          >
            <circle
              cx="300"
              cy="250"
              r="44"
              fill={`url(#${filterId}-coreGrad)`}
              filter={`url(#${filterId}-glow)`}
              className="drop-shadow-lg transition-transform duration-300 hover:scale-105"
            />
            <circle
              cx="300"
              cy="250"
              r="48"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeOpacity="0.6"
            />
            {/* Core Center Emblem */}
            <text
              x="300"
              y="246"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="12"
              fontWeight="800"
              letterSpacing="0.05em"
              className="pointer-events-none"
            >
              CONTINUUM
            </text>
            <text
              x="300"
              y="262"
              textAnchor="middle"
              fill="#93C5FD"
              fontSize="10"
              fontWeight="700"
              className="pointer-events-none"
            >
              AI CORE
            </text>
          </g>

          {/* The 6 Lifecycle Knowledge Nodes */}
          {KNOWLEDGE_LIFECYCLE_NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isActive = isSelected || isHovered;

            return (
              <g
                key={node.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${node.step}: ${node.label} - ${node.title}`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedNodeId(node.id);
                  }
                }}
                className="cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
              >
                {/* Node Outer Halo Glow when active */}
                {isActive && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="34"
                    fill={node.accentColor}
                    fillOpacity="0.25"
                    filter={`url(#${filterId}-glow)`}
                    className="animate-pulse"
                  />
                )}

                {/* Node Main Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="24"
                  fill={isActive ? "#2563EB" : "#FFFFFF"}
                  stroke={isActive ? "#60A5FA" : "#CBD5E1"}
                  strokeWidth={isActive ? "3" : "1.8"}
                  className="transition-all duration-200 drop-shadow-md dark:fill-gray-900 dark:stroke-gray-700"
                />

                {/* Node Step Badge */}
                <circle
                  cx={node.x + 18}
                  cy={node.y - 18}
                  r="10"
                  fill={isActive ? "#1E293B" : "#2563EB"}
                  className="drop-shadow-xs"
                />
                <text
                  x={node.x + 18}
                  y={node.y - 14.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="800"
                  className="pointer-events-none"
                >
                  {node.step}
                </text>

                {/* Short Node Label */}
                <text
                  x={node.x}
                  y={node.y + 38}
                  textAnchor="middle"
                  fill={isActive ? "#1D4ED8" : "#334155"}
                  fontSize="11"
                  fontWeight={isActive ? "800" : "600"}
                  className="pointer-events-none tracking-tight dark:fill-gray-200"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Detail Floating Panel (Updates on Hover / Click) */}
      <div className="mt-4 rounded-2xl border border-blue-200/90 bg-white p-4 sm:p-5 shadow-lg shadow-blue-500/5 dark:border-blue-900/50 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-extrabold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                {activeNode.stageName}
              </span>
              <span className="text-xs text-slate-500 dark:text-gray-400">
                • Phụ trách:{" "}
                <strong className="text-[#0F172A] dark:text-white">
                  {activeNode.actor}
                </strong>
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              {activeNode.title}
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
              {activeNode.detail}
            </p>
          </div>

          <button
            type="button"
            onClick={() => scrollToSection("cach-hoat-dong")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-2 text-xs transition-colors border border-blue-200/80 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300"
          >
            <span>Xem quy trình</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick Stepper Bar on bottom */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 dark:border-gray-700/80 dark:text-gray-400">
          <div className="flex items-center gap-1">
            {KNOWLEDGE_LIFECYCLE_NODES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedNodeId(n.id)}
                className={`h-2 rounded-full transition-all ${
                  selectedNodeId === n.id
                    ? "w-6 bg-blue-600"
                    : "w-2 bg-slate-300 hover:bg-blue-400 dark:bg-gray-600"
                }`}
                title={`${n.step}: ${n.label}`}
                aria-label={`Chọn giai đoạn ${n.step}: ${n.label}`}
              />
            ))}
          </div>
          <span className="font-semibold text-blue-700 dark:text-blue-400">
            Bước {activeNode.step} / 06: {activeNode.label}
          </span>
        </div>
      </div>
    </div>
  );
}
