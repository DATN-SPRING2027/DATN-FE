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
    actor: "Nguyễn Văn A (Senior Backend)",
    tag: "In-flow Capture",
    content: {
      heading: "Quyết định: Sử dụng Redis Pub/Sub cho Session & Token Revocation",
      description:
        "Khi lượng người dùng đồng thời vượt 100,000, in-memory session gây nghẽn memory. Chuyển sang Redis Pub/Sub để đồng bộ hoá trạng thái giữa các pod và giảm latency xuống dưới 15ms.",
      evidence: [
        { type: "note", label: "Work Note WN-104", meta: "Sprint 24" },
        { type: "arch", label: "Architecture RFC v2.3", meta: "Đã phê duyệt" },
      ],
    },
  },
  {
    id: "evidence",
    step: "02",
    stage: "Bằng chứng",
    title: "Nguồn gốc & Mã nguồn",
    actor: "GitHub & Benchmark System",
    tag: "Evidence Linked",
    content: {
      heading: "Liên kết PR #88 và Báo cáo kiểm thử tải",
      description:
        "Quyết định không phải lời nói suông. Toàn bộ logic được liên kết trực tiếp tới Pull Request đã merge kèm kết quả đo tải thực tế làm căn cứ kiểm chứng.",
      evidence: [
        { type: "pr", label: "PR #88: feat(iam) redis-pubsub", meta: "Merged • 14 file diff" },
        { type: "report", label: "Benchmark_100k_users.pdf", meta: "Latency 12.4ms avg" },
        { type: "commit", label: "Commit #a3c9f2", meta: "Connection pool retry" },
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
        "AI hỗ trợ phát hiện và tổng hợp các điểm mấu chốt. Tech Lead trực tiếp rà soát báo cáo tải, kiểm tra tính tương thích hạ tầng Kubernetes trước khi lưu vào kho tri thức chung.",
      quote:
        '"Đã kiểm tra cấu hình Cluster và cơ chế Failover. Giải pháp an toàn, chấp thuận đưa vào kho tri thức chuẩn của tổ chức."',
    },
  },
  {
    id: "handover",
    step: "04",
    stage: "Tiếp nối",
    title: "Bàn giao cho người mới",
    actor: "Lê Minh B (Kỹ sư mới tiếp nhận)",
    tag: "Context Preserved",
    content: {
      heading: "Người kế nhiệm nắm trọn vẹn ngữ cảnh ngay ngày đầu tiên",
      description:
        "Khi được hỏi: 'Tại sao không dùng RabbitMQ?', người mới lập tức tra cứu được lý do: Redis đã sẵn sàng cho Session Cache, việc tái sử dụng giúp tối ưu chi phí vận hành mà vẫn đáp ứng SLA.",
      evidence: [
        { type: "handover", label: "Gói bàn giao IAM & Caching", meta: "5 tri thức đã xác minh" },
        { type: "qa", label: "Tra cứu RAG có trích dẫn", meta: "Nguồn WN-104 & PR #88" },
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
      className={`relative rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-blue-500/5 transition-all dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Top Bar: Trace Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 pb-4 mb-4 gap-2 text-xs dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          <span className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 text-[11px]">
            CONTINUUM KNOWLEDGE TRACE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
            <CheckLineIcon className="h-3 w-3 text-blue-600" />
            Đã xác minh (Verified)
          </span>
          <span className="hidden sm:inline-block text-[11px] text-slate-400">
            Sprint 24
          </span>
        </div>
      </div>

      {/* Case Header: The Real Engineering Decision */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 border border-blue-100/80 dark:bg-gray-800/80 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Truy vết một quyết định kỹ thuật thực tế
        </span>
        <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] mt-0.5 dark:text-white">
          Tại sao nhóm quyết định chọn Redis Pub/Sub?
        </h3>
        <p className="text-xs text-slate-600 mt-1 dark:text-gray-300">
          Theo dõi hành trình tri thức: từ lúc kỹ sư ghi nhận lý do, đính kèm bằng chứng, được Tech Lead duyệt cho đến khi chuyển giao trọn vẹn cho người mới.
        </p>
      </div>

      {/* 4 Interactive Trace Steps Indicator */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {TRACE_STEPS.map((step, idx) => {
          const isActive = activeStepIndex === idx;
          const isPassed = activeStepIndex > idx;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`group flex flex-col items-start rounded-xl p-2.5 sm:p-3 text-left transition-all border ${
                isActive
                  ? "border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500/20 dark:bg-blue-950/40 dark:border-blue-500"
                  : isPassed
                  ? "border-blue-200 bg-white hover:border-blue-300 dark:border-gray-800 dark:bg-gray-800"
                  : "border-slate-200 bg-[#F8FAFC] opacity-75 hover:opacity-100 dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isPassed
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {step.step}
                </span>
                {isPassed && (
                  <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                )}
              </div>
              <span className="block text-[11px] font-extrabold text-[#0F172A] truncate w-full dark:text-white">
                {step.stage}
              </span>
              <span className="hidden sm:block text-[10px] text-slate-500 truncate w-full dark:text-gray-400">
                {step.title.split(":")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Trace Detail Box (The Active Step Story) */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-5 transition-all dark:border-gray-800 dark:bg-gray-800/70">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 mb-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black">
              Bước {currentStep.step}
            </span>
            <span className="text-xs font-bold text-[#0F172A] dark:text-white">
              {currentStep.title}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-gray-400">
            Chủ thể: <strong className="text-slate-800 dark:text-slate-200">{currentStep.actor}</strong>
          </span>
        </div>

        {/* Heading & Detailed Context */}
        <h4 className="text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-white leading-snug">
          {currentStep.content.heading}
        </h4>

        <p className="mt-2 text-xs leading-relaxed text-[#334155] dark:text-gray-300">
          {currentStep.content.description}
        </p>

        {/* Evidence Badges if present */}
        {currentStep.content.evidence && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/70 dark:border-gray-700/80">
            <span className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider dark:text-gray-400">
              Bằng chứng đính kèm (Evidence Context):
            </span>
            <div className="flex flex-wrap gap-2">
              {currentStep.content.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <FileIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {ev.label}
                  </span>
                  {ev.meta && (
                    <span className="text-[10px] text-slate-400">({ev.meta})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quote if review step */}
        {currentStep.content.quote && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs italic text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            {currentStep.content.quote}
          </div>
        )}
      </div>

      {/* Trace Navigation Footer */}
      <div className="mt-4 flex items-center justify-between text-xs pt-1">
        <span className="text-slate-500 text-[11px]">
          Chuyển bước để xem luồng tiếp nối của quyết định
        </span>

        <button
          type="button"
          onClick={() =>
            setActiveStepIndex((prev) => (prev + 1) % TRACE_STEPS.length)
          }
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>
            {activeStepIndex < TRACE_STEPS.length - 1
              ? `Xem bước tiếp theo (${TRACE_STEPS[activeStepIndex + 1].stage})`
              : "Xem lại từ đầu"}
          </span>
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
