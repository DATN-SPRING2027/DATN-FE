"use client";

import React from "react";
import Landing3DCard from "./Landing3DCard";
import { ArrowRightIcon, CheckCircleIcon, DocsIcon, ShootingStarIcon, TimeIcon } from "@/icons";

export default function LandingHero() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Subtle Hero ambient glow (Nhẹ nhàng, không phủ màu toàn trang) */}
      <div
        className="pointer-events-none absolute -top-24 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-[#ECF3FF] blur-3xl opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/4 -z-10 h-[400px] w-[400px] rounded-full bg-[#ECF3FF]/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Heading, Value Prop, CTAs */}
          <div className="lg:col-span-6 xl:col-span-5">
            {/* Small Badge Label */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE9FF] bg-[#ECF3FF] px-3.5 py-1.5 text-xs font-semibold text-[#465FFF] mb-6">
              <span className="flex h-2 w-2 rounded-full bg-[#465FFF] animate-pulse" />
              <span>Nền tảng duy trì tri thức cho đội ngũ phần mềm</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#101828] sm:text-4xl lg:text-5xl lg:leading-[1.15] dark:text-white">
              Đừng để tri thức dự án rời đi cùng một thành viên.
            </h1>

            {/* Description */}
            <p className="mt-5 text-base leading-relaxed text-[#344054] sm:text-lg dark:text-gray-300">
              Continuum AI giúp nhóm của bạn ghi nhận kinh nghiệm trong lúc làm việc, kiểm chứng bằng chứng và bàn giao rõ ràng cho người kế nhiệm.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => scrollTo("demo")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#465FFF] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[#3641F5] hover:shadow-lg active:scale-[0.98]"
              >
                <span>Khám phá bản demo</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("cach-hoat-dong")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-6 py-3.5 text-base font-semibold text-[#344054] shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span>Tìm hiểu cách hoạt động</span>
              </button>
            </div>

            {/* Micro credibility notice */}
            <div className="mt-6 flex items-center gap-2 text-xs text-[#667085] dark:text-gray-400">
              <CheckCircleIcon className="h-4 w-4 text-[#12B76A]" />
              <span>Dành cho thành viên, trưởng nhóm và người tiếp nhận dự án</span>
            </div>
          </div>

          {/* Right Column: 3D Interactive Product Mockup */}
          <div className="lg:col-span-6 xl:col-span-7">
            <Landing3DCard maxTilt={10} className="w-full">
              {/* Outer Browser Frame */}
              <div className="relative rounded-2xl border border-[#E4E7EC] bg-white p-3 shadow-2xl backdrop-blur-xl transition-shadow dark:border-gray-800 dark:bg-gray-900/95">
                {/* Browser Top Bar */}
                <div className="mb-3 flex items-center justify-between border-b border-[#E4E7EC] pb-2.5 px-2 dark:border-gray-800">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#FF5F56]/80" />
                    <span className="h-3 w-3 rounded-full bg-[#FFBD2E]/80" />
                    <span className="h-3 w-3 rounded-full bg-[#27C93F]/80" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-[#F9FAFB] px-4 py-1 text-xs text-[#667085] border border-[#E4E7EC] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#12B76A]" />
                    <span>continuum-ai.internal/workspace/knowledge-base</span>
                  </div>
                  <div className="w-10" />
                </div>

                {/* Main App Workspace Content */}
                <div className="space-y-3 p-1">
                  {/* Top Bar inside app mockup */}
                  <div className="flex items-center justify-between rounded-lg bg-[#F9FAFB] p-3 border border-[#E4E7EC] dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF3FF] text-[#465FFF] font-bold text-xs">
                        SAG
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[#101828] dark:text-white">
                          Dự án: Core Integration Engine
                        </h4>
                        <p className="text-[11px] text-[#667085] dark:text-gray-400">
                          Kho tri thức & Nhật ký bàn giao
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#ECF3FF] px-2.5 py-0.5 text-[11px] font-medium text-[#465FFF]">
                      14 tri thức đã lưu
                    </span>
                  </div>

                  {/* List of Knowledge items */}
                  <div className="space-y-2.5">
                    {/* Item 1: Verified Note */}
                    <div className="rounded-xl border border-[#E4E7EC] bg-white p-3.5 transition-all dark:border-gray-700 dark:bg-gray-800/80">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#101828] dark:text-white">
                              Quyết định kiến trúc: Chuyển sang Event-driven Cache Sync
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#12B76A]">
                              <CheckCircleIcon className="h-3 w-3" />
                              Đã xác minh
                            </span>
                          </div>
                          <p className="text-xs text-[#344054] dark:text-gray-300">
                            Xử lý bottleneck đồng bộ dữ liệu giữa Postgres & MongoDB. Đã test tải 10k req/s.
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-[#F2F4F7] pt-2 text-[11px] text-[#667085] dark:border-gray-700 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <DocsIcon className="h-3 w-3" /> Bằng chứng: PR #108, Benchmark doc v2.1
                        </span>
                        <span>Kiểm chứng bởi: Tech Lead</span>
                      </div>
                    </div>

                    {/* Item 2: Pending Verification Note */}
                    <div className="rounded-xl border border-[#E4E7EC] bg-white p-3.5 dark:border-gray-700 dark:bg-gray-800/80">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#101828] dark:text-white">
                              Work Note: Khắc phục lỗi rò rỉ bộ nhớ khi crawl tài liệu lớn
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-medium text-[#667085] dark:bg-gray-700 dark:text-gray-300">
                              <TimeIcon className="h-3 w-3" />
                              Chờ kiểm chứng
                            </span>
                          </div>
                          <p className="text-xs text-[#344054] dark:text-gray-300">
                            Áp dụng streaming chunks thay vì load toàn bộ file vào RAM.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3D FLOATING LAYER 1: AI Assistant Cited Q&A (Physical Z-Depth) */}
                <div
                  style={{
                    transform: "translateZ(45px)",
                  }}
                  className="mt-3 rounded-xl border border-[#465FFF]/30 bg-gradient-to-r from-[#F2F7FF] to-white p-3.5 shadow-xl transition-transform dark:from-gray-800 dark:to-gray-800/90 dark:border-brand-500/40"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#465FFF] text-white">
                      <ShootingStarIcon className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-bold text-[#465FFF]">
                      Trợ lý Continuum AI — Trả lời có trích dẫn
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#101828] dark:text-white mb-1.5">
                    &ldquo;Q: Cơ chế tái thử lại (retry) của pipeline đồng bộ hoạt động như thế nào?&rdquo;
                  </p>
                  <p className="text-xs text-[#344054] leading-relaxed dark:text-gray-300">
                    Hệ thống áp dụng Exponential Backoff với tối đa 3 lần thử lại và gửi cảnh báo vào Dead Letter Queue nếu thất bại.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[#667085] dark:text-gray-400">Nguồn trích dẫn:</span>
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#465FFF] border border-[#DDE9FF] shadow-2xs">
                      [SAG Task Checkpoint C]
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#465FFF] border border-[#DDE9FF] shadow-2xs">
                      [Architecture Doc #4.2]
                    </span>
                  </div>
                </div>

                {/* 3D FLOATING LAYER 2: Floating Handover Badge in Top Right */}
                <div
                  style={{
                    transform: "translateZ(60px)",
                  }}
                  className="hidden sm:flex absolute -top-4 -right-4 items-center gap-2 rounded-xl border border-[#12B76A]/40 bg-white px-3.5 py-2 shadow-xl dark:bg-gray-800 dark:border-success-500/50"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-[#12B76A]">
                    <CheckCircleIcon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-medium text-[#667085] dark:text-gray-400">Gói bàn giao</p>
                    <p className="text-xs font-bold text-[#101828] dark:text-white">100% Có bằng chứng</p>
                  </div>
                </div>
              </div>
            </Landing3DCard>
          </div>
        </div>
      </div>
    </section>
  );
}
