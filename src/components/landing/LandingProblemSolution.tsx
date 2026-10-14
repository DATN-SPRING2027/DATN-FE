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
      className="py-14 md:py-20 border-t border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Editorial Heading */}
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
            <span>Thực trạng & Bước chuyển dịch</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Khi nhân sự thay đổi,{" "}
            <span className="text-blue-600 dark:text-blue-400">
              tri thức không được phép biến mất.
            </span>
          </h2>

          <p className="mt-2.5 text-sm sm:text-base text-[#334155] leading-relaxed dark:text-gray-300">
            So sánh giữa việc thông tin bị thất thoát trong chat và chuỗi tri thức có bằng chứng của Continuum AI.
          </p>
        </div>

        {/* Visual Transformation Comparison Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-6 items-stretch">
          {/* Left Column: Traditional (Visual Fragments) */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-300/80 bg-[#F8FAFC] p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-850">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 dark:border-gray-700">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider dark:text-slate-300">
                  Cách làm cũ: Rời rạc & Thất thoát
                </span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                  Phụ thuộc trí nhớ
                </span>
              </div>

              {/* Compact Visual Fragments */}
              <div className="space-y-3">
                {/* Fragment 1: Slack chat */}
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                    <span>Slack #backend • 3 tuần trước</span>
                    <CloseIcon className="h-3 w-3 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    <strong>Lê Minh B:</strong> &quot;Sao service IAM lại chọn Redis Pub/Sub vậy ạ?&quot;
                  </p>
                  <p className="text-xs text-slate-500 italic mt-1">
                    <strong>Trần Thị B:</strong> &quot;Văn A làm phần đó mà bạn ấy nghỉ tuần trước rồi em ơi...&quot;
                  </p>
                </div>

                {/* Fragment 2: Outdated Wiki */}
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between text-[10px] text-amber-600 font-bold uppercase mb-1">
                    <span>Wiki IAM v1.0 • Lỗi thời</span>
                    <span className="text-slate-400">Sửa 2 năm trước</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-300">
                    Mô tả session local trong Node.js, trong khi thực tế code đã đổi sang Redis Cluster.
                  </p>
                </div>

                {/* Fragment 3: Commit without context */}
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <span className="text-blue-600 font-bold">commit #a3c9f2:</span> &quot;fix cache bug&quot;
                  <span className="block text-[10px] font-sans text-slate-400 mt-0.5">
                    Không giải thích lý do kỹ thuật, không đính kèm benchmark.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-1.5 dark:border-gray-700 dark:text-gray-400">
              <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
              <span>Người mới phải hỏi lại người cũ hoặc tự viết lại từ đầu.</span>
            </div>
          </div>

          {/* Right Column: Continuum AI (Connected Knowledge Stream) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-blue-500/80 bg-white p-5 sm:p-6 shadow-xl shadow-blue-500/10 dark:border-blue-500/70 dark:bg-gray-800">
            <div className="pointer-events-none absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-md shadow-blue-500/30">
              Chuỗi tri thức Continuum AI
            </div>

            <div>
              <div className="flex items-center justify-between pb-3 border-b border-blue-100 mb-4 dark:border-gray-700">
                <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider dark:text-blue-400">
                  Tiếp nối có bằng chứng & kiểm chứng
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                  Xác thực minh bạch
                </span>
              </div>

              {/* Connected Knowledge Stream Visual */}
              <div className="space-y-2.5 relative">
                {/* Visual Lineage Connector */}
                <div
                  className="pointer-events-none absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-blue-600 via-indigo-500 to-blue-400"
                  aria-hidden="true"
                />

                {/* Node 1: Work Note */}
                <div className="relative pl-7">
                  <div className="absolute left-1.5 top-2.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-extrabold text-blue-700 dark:text-blue-400 block mb-0.5">
                      Work Note WN-104 (Nguyễn Văn A)
                    </span>
                    <p className="text-slate-700 dark:text-gray-300 text-[11px]">
                      &quot;Chọn Redis Pub/Sub vì cụm Session đã có sẵn. Giảm latency xuống dưới 15ms khi đạt 100k users.&quot;
                    </p>
                  </div>
                </div>

                {/* Node 2: Evidence */}
                <div className="relative pl-7">
                  <div className="absolute left-1.5 top-2.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-400 block mb-1 text-[11px]">
                      Bằng chứng xác thực gắn kết:
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
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
                <div className="relative pl-7">
                  <div className="absolute left-1.5 top-2.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-2xs dark:border-gray-800" />
                  <div className="rounded-xl border border-blue-200 bg-white p-2.5 text-xs shadow-2xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300 text-[11px]">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Thẩm định bởi Tech Lead Trần Thị B</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-600 dark:text-gray-300">
                      Chữ ký số xác nhận: Đã đối chiếu hạ tầng Kubernetes và chấp thuận làm chuẩn dự án.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="mt-5 pt-3 border-t border-blue-100 flex items-center justify-between text-xs dark:border-gray-700">
              <span className="font-bold text-blue-700 dark:text-blue-400 text-[11px]">
                Người kế nhiệm tiếp quản ngay ngày đầu tiên
              </span>
              <button
                type="button"
                onClick={() => scrollTo("tinh-nang")}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>Xem tính năng</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
