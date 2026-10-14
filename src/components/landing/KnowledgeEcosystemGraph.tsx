"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  FileIcon,
  ArrowRightIcon,
  CheckLineIcon,
} from "@/icons";

export interface TraceStep {
  id: string;
  step: string;
  stage: string;
  title: string;
  actor: string;
  tag: string;
  content: {
    heading: string;
    description: string;
    evidence?: { type: string; label: string; meta?: string }[];
    quote?: string;
  };
}

export const TRACE_STEPS: TraceStep[] = [
  {
    id: "work-note",
    step: "01",
    stage: "Ghi nhận",
    title: "Work Note WN-104",
    actor: "Nguyễn Văn A (Backend)",
    tag: "In-flow Capture",
    content: {
      heading: "Quyết định: Sử dụng Redis Pub/Sub cho Session Cache",
      description:
        "Tải 100k users gây nghẽn memory. Chuyển sang Redis Pub/Sub để đồng bộ giữa các pod, latency < 15ms.",
      evidence: [
        { type: "note", label: "Work Note WN-104", meta: "Sprint 24" },
        { type: "arch", label: "Architecture RFC v2.3", meta: "Approved" },
      ],
    },
  },
  {
    id: "evidence",
    step: "02",
    stage: "Bằng chứng",
    title: "Nguồn gốc & Mã nguồn",
    actor: "GitHub & CI System",
    tag: "Evidence Linked",
    content: {
      heading: "Liên kết PR #88 và Báo cáo kiểm thử tải",
      description:
        "Logic gắn liền với Pull Request đã merge kèm kết quả đo tải thực tế làm căn cứ kiểm chứng.",
      evidence: [
        { type: "pr", label: "PR #88: feat(iam) redis-pubsub", meta: "Merged" },
        { type: "report", label: "Benchmark_100k_users.pdf", meta: "12.4ms avg" },
      ],
    },
  },
  {
    id: "verify",
    step: "03",
    stage: "Thẩm định",
    title: "Xác thực bởi Tech Lead",
    actor: "Trần Thị B (Tech Lead / System Architect)",
    tag: "Human-in-the-loop",
    content: {
      heading: "Tech Lead đối chiếu hạ tầng & phê duyệt chính thức",
      description:
        "AI đề xuất, Tech Lead trực tiếp rà soát bằng chứng và ký duyệt trước khi đưa vào kho chuẩn.",
      quote:
        '"Đã kiểm tra cấu hình Cluster và failover. Chấp thuận đưa vào kho tri thức chuẩn."',
    },
  },
  {
    id: "handover",
    step: "04",
    stage: "Tiếp nối",
    title: "Bàn giao cho người mới",
    actor: "Lê Minh B (Kỹ sư mới)",
    tag: "Context Preserved",
    content: {
      heading: "Người kế nhiệm nắm trọn vẹn ngữ cảnh ngay ngày đầu tiên",
      description:
        "Khi tìm hiểu lý do không dùng RabbitMQ, người mới tra cứu được ngay Work Note WN-104 và PR #88.",
      evidence: [
        { type: "handover", label: "Gói bàn giao IAM & Caching", meta: "5 tri thức" },
        { type: "qa", label: "Tra cứu RAG có trích dẫn", meta: "Nguồn WN-104" },
      ],
    },
  },
];

export default function KnowledgeEcosystemGraph({
  className = "",
}: {
  className?: string;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const currentStep = TRACE_STEPS[activeStepIndex];

  return (
    <div
      className={`relative rounded-3xl border border-slate-700/80 bg-[#0B1120] text-slate-100 p-5 sm:p-6 shadow-2xl transition-all ${className}`}
    >
      {/* Top Bar: Trace Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3.5 mb-4 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
          <span className="font-extrabold tracking-wider text-slate-200 text-[11px] uppercase">
            CONTINUUM KNOWLEDGE TRACE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/30">
            <CheckLineIcon className="h-3 w-3 text-blue-400" />
            Đã xác minh (Verified)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Sprint 24
          </span>
        </div>
      </div>

      {/* Case Header: The Real Engineering Decision */}
      <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
          Truy vết quyết định kỹ thuật
        </span>
        <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
          Tại sao nhóm quyết định chọn Redis Pub/Sub?
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Theo dõi cách một quyết định được ghi nhận, kiểm chứng và chuyển giao.
        </p>
      </div>

      {/* 4 Interactive Trace Steps Indicator */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
        {TRACE_STEPS.map((step, idx) => {
          const isActive = activeStepIndex === idx;
          const isPassed = activeStepIndex > idx;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`flex flex-col items-start rounded-xl p-2 sm:p-2.5 text-left transition-all border ${
                isActive
                  ? "border-blue-500 bg-blue-950/60 shadow-sm ring-1 ring-blue-500/30 text-white"
                  : isPassed
                  ? "border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700"
                  : "border-slate-900 bg-slate-950/50 text-slate-500 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-0.5">
                <span
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded text-[10px] font-extrabold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isPassed
                      ? "bg-blue-900/60 text-blue-300"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {step.step}
                </span>
                {isPassed && (
                  <CheckCircleIcon className="h-3 w-3 text-blue-400 shrink-0" />
                )}
              </div>
              <span className="block text-[11px] font-bold truncate w-full">
                {step.stage}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Trace Detail Box (The Active Step Story) */}
      <div className="mt-3.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2.5 border-b border-slate-800/80 mb-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-blue-600 text-white px-1.5 py-0.5 text-[9px] font-black">
              {currentStep.step}
            </span>
            <span className="text-xs font-bold text-white">
              {currentStep.title}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Chủ thể: <strong className="text-slate-200">{currentStep.actor}</strong>
          </span>
        </div>

        {/* Heading & Short Description */}
        <h4 className="text-xs sm:text-sm font-bold text-slate-100">
          {currentStep.content.heading}
        </h4>

        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
          {currentStep.content.description}
        </p>

        {/* Evidence Badges */}
        {currentStep.content.evidence && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap gap-1.5">
            {currentStep.content.evidence.map((ev, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-blue-300"
              >
                <FileIcon className="h-3 w-3 text-blue-400 shrink-0" />
                <span>{ev.label}</span>
                {ev.meta && <span className="text-slate-500">({ev.meta})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Quote if present */}
        {currentStep.content.quote && (
          <div className="mt-2.5 rounded-lg border border-blue-900/50 bg-blue-950/30 p-2 text-xs italic text-blue-200">
            {currentStep.content.quote}
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="mt-3.5 flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
        <span className="text-slate-400 text-[10px]">
          Bước {currentStep.step} / 04: {currentStep.stage}
        </span>

        <button
          type="button"
          onClick={() =>
            setActiveStepIndex((prev) => (prev + 1) % TRACE_STEPS.length)
          }
          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>
            {activeStepIndex < TRACE_STEPS.length - 1
              ? `Xem bước tiếp theo (${TRACE_STEPS[activeStepIndex + 1].stage})`
              : "Xem lại từ đầu"}
          </span>
          <ArrowRightIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
