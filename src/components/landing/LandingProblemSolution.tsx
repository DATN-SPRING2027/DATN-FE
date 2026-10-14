"use client";

import React from "react";
import { CheckCircleIcon, CloseIcon, ArrowRightIcon, FileIcon } from "@/icons";

export default function LandingProblemSolution() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="giai-phap"
      className="py-16 md:py-24 border-t border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Editorial Heading (Left Aligned for Rhythm Variation) */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3.5 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
            <span>Thực trạng & Bước chuyển dịch</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Khi nhân sự thay đổi,{" "}
            <span className="text-blue-600 dark:text-blue-400">
              tri thức không được phép biến mất.
            </span>
          </h2>

          <p className="mt-3.5 text-base text-[#334155] leading-relaxed dark:text-gray-300">
            Xem sự khác biệt giữa việc thông tin bị thất thoát trong các kênh chat rời rạc và việc bảo toàn một chuỗi quyết định kỹ thuật có bằng chứng xác thực.
          </p>
        </div>

        {/* Visual Transformation Comparison Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-8 items-stretch">
          {/* Left Column: Traditional Knowledge Management (Visual Fragments) */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-300/80 bg-[#F8FAFC] p-6 sm:p-7 dark:border-gray-800 dark:bg-gray-850">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-5 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-slate-400" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Cách làm cũ: Rời rạc & Phụ thuộc trí nhớ
                  </h3>
                </div>
                <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                  Thất thoát thông tin
                </span>
              </div>

              {/* Visual Fragment 1: Lost Slack Conversation */}
              <div className="space-y-3.5">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tin nhắn Slack (#backend-dev) • 3 tuần trước
                    </span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <CloseIcon className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <strong className="text-slate-700 shrink-0 dark:text-slate-300">
                        Lê Minh B (Mới vào):
                      </strong>
                      <span className="text-slate-600 dark:text-gray-400">
                        &quot;Sao service IAM lại dùng Redis Pub/Sub vậy ạ? Em tìm trong docs không thấy nói lý do...&quot;
                      </span>
                    </div>
                    <div className="flex items-start gap-2 pl-2 border-l-2 border-slate-200">
                      <strong className="text-slate-500 shrink-0">Trần Thị B (Lead):</strong>
                      <span className="text-slate-500 italic">
                        &quot;Văn A làm phần này mà bạn ấy nghỉ từ tuần trước rồi em ơi, xem tạm commit log xem...&quot;
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Fragment 2: Outdated Wiki Documentation */}
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      Tài liệu Wiki cũ • Đã lỗi thời
                    </span>
                    <span className="text-[10px] text-slate-400">Sửa lần cuối: 2 năm trước</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kiến trúc IAM: &quot;Khởi tạo session trong local memory của Node.js&quot;
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Thực tế code đã thay đổi hoàn toàn nhưng tài liệu không ai cập nhật.
                  </p>
                </div>

                {/* Visual Fragment 3: Cryptic Commit */}
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-xs font-mono text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <span className="text-blue-600 font-bold">commit #a3c9f2:</span> &quot;fix cache bug and stuff&quot;
                  <span className="block text-[10px] font-sans text-slate-400 mt-0.5">
                    Không mô tả lý do kỹ thuật, không đính kèm benchmark.
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Insight */}
            <div className="mt-6 pt-3.5 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2 dark:border-gray-700 dark:text-gray-400">
              <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
              <span>Người mới phải hỏi lại người cũ hoặc tự viết lại từ đầu.</span>
            </div>
          </div>

          {/* Right Column: Continuum AI (The Connected Knowledge Stream) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-blue-500/80 bg-white p-6 sm:p-7 shadow-xl shadow-blue-500/10 dark:border-blue-500/70 dark:bg-gray-800">
            {/* Top Pill */}
            <div className="pointer-events-none absolute -top-3.5 right-6 rounded-full bg-blue-600 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md shadow-blue-500/30">
              Chuỗi tri thức Continuum AI
            </div>

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-blue-100 mb-5 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                    Tiếp nối có ngữ cảnh & bằng chứng
                  </h3>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                  Xác thực & Minh bạch
                </span>
              </div>

              {/* Connected Knowledge Stream Visual */}
              <div className="space-y-3 relative">
                {/* Visual Lineage Connector */}
                <div
                  className="pointer-events-none absolute left-3.5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-600 via-indigo-500 to-blue-400"
                  aria-hidden="true"
                />

                {/* Node 1: Work Note */}
                <div className="relative pl-8">
                  <div className="absolute left-2 top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-blue-700 dark:text-blue-400">
                        Work Note WN-104 (Nguyễn Văn A)
                      </span>
                      <span className="text-[10px] text-slate-500">Sprint 24</span>
                    </div>
                    <p className="text-[#334155] dark:text-gray-300">
                      &quot;Chọn Redis Pub/Sub vì cụm Redis Session đã có sẵn. Giảm latency xuống dưới 15ms khi đạt 100k người dùng đồng thời.&quot;
                    </p>
                  </div>
                </div>

                {/* Node 2: Evidence */}
                <div className="relative pl-8">
                  <div className="absolute left-2 top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-400 block mb-1">
                      Bằng chứng xác thực gắn kết:
                    </span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-semibold text-blue-700 dark:bg-gray-800 dark:border-gray-700">
                        <FileIcon className="h-3 w-3 text-blue-600" /> PR #88 (Merged)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-semibold text-blue-700 dark:bg-gray-800 dark:border-gray-700">
                        <FileIcon className="h-3 w-3 text-blue-600" /> Benchmark_100k.pdf
                      </span>
                    </div>
                  </div>
                </div>

                {/* Node 3: Tech Lead Verification */}
                <div className="relative pl-8">
                  <div className="absolute left-2 top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-200 bg-white p-3 text-xs shadow-2xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
                      <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>Thẩm định bởi Tech Lead Trần Thị B</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-gray-300">
                      Chữ ký xác thực số đã được phê duyệt. Tri thức trở thành tài sản chính thức của tổ chức.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="mt-6 pt-3.5 border-t border-blue-100 flex items-center justify-between text-xs dark:border-gray-700">
              <span className="font-bold text-blue-700 dark:text-blue-400">
                Người kế nhiệm tiếp quản ngay ngày đầu tiên
              </span>
              <button
                type="button"
                onClick={() => scrollTo("tinh-nang")}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>Khám phá tính năng</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
