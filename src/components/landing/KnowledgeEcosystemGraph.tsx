"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  FileIcon,
  CheckLineIcon,
  UserIcon,
} from "@/icons";

export interface GraphNode {
  id: string;
  type: "decision" | "evidence" | "verification" | "handover";
  stage: string;
  title: string;
  actor: string;
  badge: string;
  meta: string;
  highlightText: string;
  detail: {
    heading: string;
    description: string;
    evidenceTag?: string;
  };
}

export const GRAPH_NODES: Record<string, GraphNode> = {
  center: {
    id: "center",
    type: "decision",
    stage: "Ghi nhận",
    title: "Work Note WN-104",
    actor: "Nguyễn Văn A (Backend)",
    badge: "Quyết định kiến trúc",
    meta: "Sprint 24 • Redis Pub/Sub",
    highlightText: "Tại sao nhóm quyết định chọn Redis Pub/Sub?",
    detail: {
      heading: "Quyết định: Sử dụng Redis Pub/Sub cho Session Cache",
      description:
        "Tải 100k users gây nghẽn memory. Chuyển sang Redis Pub/Sub để đồng bộ giữa các pod, latency < 15ms.",
      evidenceTag: "Work Note WN-104 (Sprint 24)",
    },
  },
  evidence_pr: {
    id: "evidence_pr",
    type: "evidence",
    stage: "Bằng chứng",
    title: "PR #88: feat(iam) redis-pubsub",
    actor: "GitHub CI System",
    badge: "Code Lineage",
    meta: "Merged • SHA: a3c9f2",
    highlightText: "Liên kết PR #88 và Báo cáo kiểm thử tải",
    detail: {
      heading: "Liên kết PR #88 và Báo cáo kiểm thử tải",
      description:
        "Logic gắn liền với Pull Request đã merge kèm kết quả đo tải thực tế làm căn cứ kiểm chứng.",
      evidenceTag: "PR #88: feat(iam) redis-pubsub",
    },
  },
  evidence_benchmark: {
    id: "evidence_benchmark",
    type: "evidence",
    stage: "Bằng chứng",
    title: "Benchmark_100k.pdf",
    actor: "Load Testing Suite",
    badge: "Thực nghiệm",
    meta: "12.4ms avg latency",
    highlightText: "Báo cáo kiểm thử tải 100k users",
    detail: {
      heading: "Báo cáo kiểm thử tải 100k người dùng",
      description:
        "Đo đạc 100k concurrent sessions trên cụm staging, CPU spike < 25%, chứng minh giải pháp tối ưu.",
      evidenceTag: "Benchmark_100k_users.pdf",
    },
  },
  verification: {
    id: "verification",
    type: "verification",
    stage: "Thẩm định",
    title: "Trần Thị B (Tech Lead / System Architect)",
    actor: "Trần Thị B (Tech Lead / System Architect)",
    badge: "Human Verification",
    meta: "Ký duyệt chuẩn dự án",
    highlightText: "Tech Lead đối chiếu hạ tầng & phê duyệt chính thức",
    detail: {
      heading: "Tech Lead đối chiếu hạ tầng & phê duyệt chính thức",
      description:
        "AI đề xuất, Tech Lead trực tiếp rà soát bằng chứng và ký duyệt trước khi đưa vào kho chuẩn.",
      evidenceTag: "Phê duyệt bởi: Trần Thị B",
    },
  },
  handover: {
    id: "handover",
    type: "handover",
    stage: "Tiếp nối",
    title: "Kỹ sư kế nhiệm Lê Minh B",
    actor: "Lê Minh B (Kỹ sư mới)",
    badge: "Tiếp quản ngữ cảnh",
    meta: "RAG Query có nguồn",
    highlightText: "Người kế nhiệm nắm trọn vẹn ngữ cảnh",
    detail: {
      heading: "Người kế nhiệm nắm trọn vẹn ngữ cảnh ngay ngày đầu tiên",
      description:
        "Khi tìm hiểu lý do không dùng RabbitMQ, người mới tra cứu được ngay Work Note WN-104 và PR #88.",
      evidenceTag: "Gói bàn giao IAM & Caching",
    },
  },
};

export default function KnowledgeEcosystemGraph({
  className = "",
}: {
  className?: string;
}) {
  const [activeNodeKey, setActiveNodeKey] = useState<string>("center");
  const activeNode = GRAPH_NODES[activeNodeKey] || GRAPH_NODES.center;

  return (
    <div
      className={`relative rounded-3xl border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/50 p-5 sm:p-6 shadow-xl shadow-blue-500/5 transition-all overflow-hidden ${className}`}
    >
      {/* Background Vector Space Grid Effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #2563EB 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      {/* Atmospheric Orbit Circles for Spatial Depth */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[340px] w-[340px] rounded-full border border-blue-200/50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[460px] w-[460px] rounded-full border border-indigo-200/30"
        aria-hidden="true"
      />

      {/* Top Bar: Trace Header & Status */}
      <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-blue-100 pb-3 mb-4 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 motion-safe:animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          <span className="font-extrabold tracking-wider text-slate-800 text-[11px] uppercase dark:text-slate-200">
            CONTINUUM KNOWLEDGE TRACE
          </span>
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 font-mono">
            Vector Space
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
            <CheckLineIcon className="h-3 w-3 text-blue-600" />
            Đã xác minh (Verified)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Sprint 24
          </span>
        </div>
      </div>

      {/* Core Question Headline */}
      <div className="relative z-10 rounded-2xl bg-white/90 backdrop-blur-md p-3 border border-blue-100 shadow-2xs mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            Đồ họa tri thức ngữ cảnh sống
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Chọn node để tương tác
          </span>
        </div>
        <h3 className="text-sm font-extrabold text-[#0F172A] mt-0.5">
          Tại sao nhóm quyết định chọn Redis Pub/Sub?
        </h3>
      </div>

      {/* 2D Knowledge Vector Graph Visual Area */}
      <div className="relative z-10 h-[280px] w-full rounded-2xl border border-blue-100/90 bg-white/80 backdrop-blur-md p-3 overflow-hidden shadow-inner">
        {/* SVG Dynamic Connectors */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Line 1: Center to Top-Left (PR #88) */}
          <line
            x1="50%"
            y1="50%"
            x2="22%"
            y2="24%"
            stroke="url(#edgeGradient)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="motion-safe:animate-pulse"
          />

          {/* Line 2: Center to Top-Right (Benchmark) */}
          <line
            x1="50%"
            y1="50%"
            x2="78%"
            y2="24%"
            stroke="url(#edgeGradient)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="motion-safe:animate-pulse"
          />

          {/* Line 3: Center to Bottom-Right (Tech Lead) */}
          <line
            x1="50%"
            y1="50%"
            x2="78%"
            y2="76%"
            stroke="url(#edgeGradient)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="motion-safe:animate-pulse"
          />

          {/* Line 4: Center to Bottom-Left (Successor) */}
          <line
            x1="50%"
            y1="50%"
            x2="22%"
            y2="76%"
            stroke="url(#edgeGradient)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="motion-safe:animate-pulse"
          />
        </svg>

        {/* Central Nucleus Node: Technical Decision (WN-104) */}
        <button
          type="button"
          onClick={() => setActiveNodeKey("center")}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all cursor-pointer ${
            activeNodeKey === "center"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105 ring-4 ring-blue-200"
              : "bg-white text-slate-800 border-2 border-blue-500/80 shadow-md hover:scale-102"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`h-2 w-2 rounded-full ${
                activeNodeKey === "center" ? "bg-white motion-safe:animate-ping" : "bg-blue-600"
              }`}
            />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Work Note WN-104
            </span>
          </div>
          <span className="text-xs font-extrabold max-w-[130px] leading-tight">
            Redis Pub/Sub
          </span>
          <span
            className={`mt-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${
              activeNodeKey === "center"
                ? "bg-white/20 text-blue-50"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            Nguyễn Văn A
          </span>
        </button>

        {/* Node 1: Top-Left Satellite — Code Evidence (PR #88) */}
        <button
          type="button"
          onClick={() => setActiveNodeKey("evidence_pr")}
          className={`absolute left-[6%] top-[10%] z-20 flex items-center gap-2 rounded-xl p-2 text-left transition-all cursor-pointer border ${
            activeNodeKey === "evidence_pr"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 scale-105 ring-2 ring-blue-300"
              : "bg-white text-slate-700 border-slate-200 shadow-2xs hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              activeNodeKey === "evidence_pr"
                ? "bg-white/20 text-white"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            <FileIcon className="h-4 w-4" />
          </div>
          <div className="pr-1">
            <span className="block text-[11px] font-extrabold leading-tight">
              PR #88
            </span>
            <span
              className={`block text-[9px] font-medium ${
                activeNodeKey === "evidence_pr" ? "text-blue-100" : "text-slate-400"
              }`}
            >
              Merged • feat(iam)
            </span>
          </div>
        </button>

        {/* Node 2: Top-Right Satellite — Benchmark Report */}
        <button
          type="button"
          onClick={() => setActiveNodeKey("evidence_benchmark")}
          className={`absolute right-[6%] top-[10%] z-20 flex items-center gap-2 rounded-xl p-2 text-left transition-all cursor-pointer border ${
            activeNodeKey === "evidence_benchmark"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 scale-105 ring-2 ring-blue-300"
              : "bg-white text-slate-700 border-slate-200 shadow-2xs hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              activeNodeKey === "evidence_benchmark"
                ? "bg-white/20 text-white"
                : "bg-indigo-50 text-indigo-600"
            }`}
          >
            <FileIcon className="h-4 w-4" />
          </div>
          <div className="pr-1">
            <span className="block text-[11px] font-extrabold leading-tight">
              Benchmark
            </span>
            <span
              className={`block text-[9px] font-medium ${
                activeNodeKey === "evidence_benchmark"
                  ? "text-blue-100"
                  : "text-slate-400"
              }`}
            >
              100k Users (12ms)
            </span>
          </div>
        </button>

        {/* Node 3: Bottom-Right Satellite — Lead Verification */}
        <button
          type="button"
          onClick={() => setActiveNodeKey("verification")}
          className={`absolute right-[6%] bottom-[10%] z-20 flex items-center gap-2 rounded-xl p-2 text-left transition-all cursor-pointer border ${
            activeNodeKey === "verification"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 scale-105 ring-2 ring-blue-300"
              : "bg-white text-slate-700 border-slate-200 shadow-2xs hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              activeNodeKey === "verification"
                ? "bg-white/20 text-white"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            <CheckCircleIcon className="h-4 w-4" />
          </div>
          <div className="pr-1">
            <span className="block text-[11px] font-extrabold leading-tight">
              Tech Lead
            </span>
            <span
              className={`block text-[9px] font-medium ${
                activeNodeKey === "verification" ? "text-blue-100" : "text-slate-400"
              }`}
            >
              Trần Thị B • Duyệt
            </span>
          </div>
        </button>

        {/* Node 4: Bottom-Left Satellite — Handover & Successor */}
        <button
          type="button"
          onClick={() => setActiveNodeKey("handover")}
          className={`absolute left-[6%] bottom-[10%] z-20 flex items-center gap-2 rounded-xl p-2 text-left transition-all cursor-pointer border ${
            activeNodeKey === "handover"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 scale-105 ring-2 ring-blue-300"
              : "bg-white text-slate-700 border-slate-200 shadow-2xs hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              activeNodeKey === "handover"
                ? "bg-white/20 text-white"
                : "bg-indigo-50 text-indigo-600"
            }`}
          >
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="pr-1">
            <span className="block text-[11px] font-extrabold leading-tight">
              Kế nhiệm
            </span>
            <span
              className={`block text-[9px] font-medium ${
                activeNodeKey === "handover" ? "text-blue-100" : "text-slate-400"
              }`}
            >
              Lê Minh B • RAG Q&A
            </span>
          </div>
        </button>
      </div>

      {/* Floating Detail Pill: Shows contextual metadata of clicked node */}
      <div className="relative z-10 mt-3.5 rounded-2xl border border-blue-200/90 bg-white/95 backdrop-blur-md p-3.5 shadow-sm transition-all">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-100 mb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold">
              {activeNode.stage}
            </span>
            <span className="font-extrabold text-[#0F172A] text-xs">
              {activeNode.title}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            Chủ thể: <strong className="text-slate-800">{activeNode.actor}</strong>
          </span>
        </div>

        <h4 className="text-xs sm:text-sm font-bold text-blue-900 leading-snug">
          {activeNode.detail.heading}
        </h4>
        <p className="mt-1 text-xs text-[#334155] leading-relaxed">
          {activeNode.detail.description}
        </p>

        {activeNode.detail.evidenceTag && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              <FileIcon className="h-3 w-3 text-blue-600" />
              {activeNode.detail.evidenceTag}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Liên kết ngữ cảnh thời gian thực
            </span>
          </div>
        )}
      </div>

      {/* Quick Stage Stepper Selector Buttons to satisfy test assertions */}
      <div className="relative z-10 mt-3 pt-2 border-t border-blue-100/80 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[10px] font-medium">
          Mạng tri thức: 4 thực thể kết nối
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveNodeKey("center")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeNodeKey === "center"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Ghi nhận
          </button>
          <button
            type="button"
            onClick={() => setActiveNodeKey("evidence_pr")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeNodeKey === "evidence_pr" || activeNodeKey === "evidence_benchmark"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Bằng chứng
          </button>
          <button
            type="button"
            onClick={() => setActiveNodeKey("verification")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeNodeKey === "verification"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Thẩm định
          </button>
          <button
            type="button"
            onClick={() => setActiveNodeKey("handover")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              activeNodeKey === "handover"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Tiếp nối
          </button>
        </div>
      </div>
    </div>
  );
}
