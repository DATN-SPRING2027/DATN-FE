"use client";

import React from "react";
import { SectionHeading } from "./HeadingEmphasis";
import { CheckCircleIcon, CloseIcon, ArrowRightIcon } from "@/icons";

export default function LandingProblemSolution() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const traditionalPainPoints = [
    {
      title: "Quyết định nằm rải rác trong chat",
      desc: "Lý do lựa chọn kiến trúc bị trôi mất trong hàng ngàn tin nhắn Slack / Teams không có tổ chức.",
    },
    {
      title: "Tài liệu thiếu ngữ cảnh thực tế",
      desc: "Chỉ mô tả 'cái gì' mà không ghi lại 'tại sao', khiến người sau không dám sửa đổi vì sợ lỗi tiềm ẩn.",
    },
    {
      title: "Không rõ thông tin đã được xác minh chưa",
      desc: "Nhiều hướng dẫn cũ không còn chính xác, không ai biết tài liệu nào đã được kiểm duyệt hay lỗi thời.",
    },
    {
      title: "Người mới phải hỏi lại người cũ",
      desc: "Mất hàng tuần gián đoạn năng suất của cả người mới lẫn kỹ sư kỳ cựu để tìm hiểu lại hệ thống.",
    },
    {
      title: "Bàn giao phụ thuộc vào trí nhớ",
      desc: "Viết vội báo cáo trước ngày chuyển dự án, bỏ sót hầu hết các góc khuất kỹ thuật quan trọng.",
    },
  ];

  const continuumSolutions = [
    {
      title: "Ghi nhận quyết định trong công việc",
      desc: "Tạo Work Notes tự nhiên ngay khi phát sinh quyết định, không mất thêm thời gian biên soạn riêng.",
    },
    {
      title: "Liên kết lý do và bằng chứng",
      desc: "Gắn kết trực tiếp với commit, PR, issue tracker và tài liệu thiết kế làm căn cứ chứng minh.",
    },
    {
      title: "Phân biệt nội dung đã xác minh",
      desc: "Quy trình Human-in-the-loop: Tech Lead thẩm định bằng chứng trước khi công nhận tri thức chính thức.",
    },
    {
      title: "Truy xuất tri thức có nguồn",
      desc: "Trợ lý AI trả lời tức thì bằng ngôn ngữ tự nhiên kèm trích dẫn nguồn có thể đối chiếu minh bạch.",
    },
    {
      title: "Tiếp nối công việc có ngữ cảnh",
      desc: "Gói bàn giao thông minh bàn giao đầy đủ trách nhiệm, câu hỏi mở và lịch sử xử lý cho người kế nhiệm.",
    },
  ];

  return (
    <section
      id="giai-phap"
      className="py-16 md:py-24 border-t border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Heading with Gradient Emphasis */}
        <SectionHeading
          badge="Thách thức & Bước chuyển dịch"
          regularText="Khi nhân sự thay đổi,"
          emphasizedText="tri thức không được phép biến mất."
          emphasisVariant="gradient"
          description="So sánh thực trạng thất thoát tri thức phổ biến với mô hình tiếp nối có bằng chứng của Continuum AI."
          align="center"
        />

        {/* Transformation Comparison Layout */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-8 items-stretch">
          {/* Left Column: Traditional Knowledge Management (Before) */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-800/40">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6 dark:border-gray-700">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-slate-400" />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    Quản lý tri thức truyền thống
                  </h3>
                </div>
                <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                  Mảnh vụn & Rủi ro
                </span>
              </div>

              {/* List of Pain Points */}
              <div className="space-y-4">
                {traditionalPainPoints.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-3.5 transition-colors hover:border-slate-300 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-gray-700">
                      <CloseIcon className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed dark:text-gray-400">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500 dark:border-gray-700 dark:text-gray-400">
              Hệ quả: Mất trung bình 3–4 tuần cho mỗi đợt chuyển giao nhân sự dự án.
            </div>
          </div>

          {/* Right Column: Continuum AI (Transformation - After) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-blue-500/80 bg-white p-6 sm:p-8 shadow-xl shadow-blue-500/10 dark:border-blue-500/70 dark:bg-gray-800">
            {/* Subtle glow badge in corner */}
            <div className="pointer-events-none absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md shadow-blue-500/30">
              Giải pháp Continuum AI
            </div>

            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-blue-100 mb-6 dark:border-gray-700">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
                  <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">
                    Tiếp nối tri thức thông minh
                  </h3>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                  Có nguồn & Kiểm chứng
                </span>
              </div>

              {/* List of Solutions */}
              <div className="space-y-4">
                {continuumSolutions.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 transition-all hover:bg-blue-50/80 hover:border-blue-300 hover:shadow-xs dark:border-gray-700 dark:bg-gray-900/60 dark:hover:bg-gray-900"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Action Link */}
            <div className="mt-8 pt-4 border-t border-blue-100 flex items-center justify-between dark:border-gray-700">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                Tri thức được tích lũy theo thời gian thực
              </span>
              <button
                type="button"
                onClick={() => scrollTo("tinh-nang")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>Xem tính năng chi tiết</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
