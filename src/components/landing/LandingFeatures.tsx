"use client";

import React, { useState } from "react";
import { SectionHeading } from "./HeadingEmphasis";
import {
  CheckCircleIcon,
  DocsIcon,
  FileIcon,
  ShootingStarIcon,
  TaskIcon,
} from "@/icons";

export default function LandingFeatures() {
  const [activeVerificationStep, setActiveVerificationStep] = useState<number>(2);

  const verificationSteps = [
    {
      id: "ai-proposed",
      badge: "Bước 1 • AI Đề xuất",
      title: "AI phân tích & trích lọc",
      desc: "Continuum AI quét qua PR đã merge và Work Notes, tự động soạn thảo bản thảo tri thức ban đầu.",
      status: "AI Proposed",
      statusColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      id: "pending-review",
      badge: "Bước 2 • Chờ thẩm định",
      title: "Gửi thông báo tới Tech Lead",
      desc: "Chuyển bản thảo tới người phụ trách kỹ thuật kèm danh sách bằng chứng và mã nguồn liên quan.",
      status: "Pending Lead Review",
      statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "verified",
      badge: "Bước 3 • Xác nhận chính thức",
      title: "Con người phê duyệt",
      desc: "Tech Lead kiểm tra tính chính xác và bấm xác nhận. Tri thức được bảo chứng và đưa vào kho chung.",
      status: "Human Verified",
      statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
  ];

  return (
    <section
      id="tinh-nang"
      className="py-16 md:py-24 bg-[#F8FAFC] dark:bg-gray-950"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Heading with Gradient Emphasis */}
        <SectionHeading
          badge="Hệ thống Tính năng Bento Grid"
          regularText="Không chỉ lưu trữ tri thức."
          emphasizedText="Giữ trọn ngữ cảnh phía sau."
          emphasisVariant="gradient"
          description="Khám phá 5 trụ cột công nghệ giúp bảo toàn lý do kỹ thuật, bằng chứng thực thi và chuyển giao trọn vẹn."
          align="center"
        />

        {/* Bento Grid Container */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-12 lg:gap-7">
          {/* Bento Card 1: Work Notes & Evidence (Large - 7 cols) */}
          <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 dark:bg-blue-950/70 dark:border-blue-900">
                  <DocsIcon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                  Ghi nhận tức thì
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white">
                Ghi nhận tri thức ngay khi công việc diễn ra
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                Thành viên lưu giữ quyết định kiến trúc, lý do lựa chọn và bằng chứng ngay trong luồng làm việc, không chờ tới khi chuyển giao mới nhớ lại.
              </p>

              {/* Realistic Work Note Preview */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4.5 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-extrabold">
                      WN-104
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-white">
                      Tối ưu hoá Compound Index cho Báo cáo Tri thức
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Sprint 24 • Đã lưu vết
                  </span>
                </div>

                <div className="space-y-2 text-[#334155] dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-700 dark:text-blue-400 shrink-0">
                      Quyết định:
                    </span>
                    <span>Tạo Compound Index {"{ orgId: 1, createdAt: -1 }"} trên collection WorkNotes.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-700 dark:text-blue-400 shrink-0">
                      Lý do:
                    </span>
                    <span>Thời gian query giảm từ 840ms xuống 28ms khi số lượng ghi chú vượt 100k bản ghi.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-700 dark:text-blue-400 shrink-0">
                      Bằng chứng:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-mono text-[11px] text-blue-600 dark:bg-gray-700 dark:border-gray-600">
                        <FileIcon className="h-3 w-3" /> PR #142 (Merged)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-mono text-[11px] text-blue-600 dark:bg-gray-700 dark:border-gray-600">
                        <FileIcon className="h-3 w-3" /> explain_plan_v2.json
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 dark:border-gray-800">
              <span>Đính kèm trực tiếp vào kho tri thức dự án</span>
              <span aria-hidden="true">&rarr;</span>
            </div>
          </div>

          {/* Bento Card 2: Human Verification (Large - 5 cols) */}
          <div className="md:col-span-12 lg:col-span-5 flex flex-col justify-between rounded-3xl border border-blue-200/90 bg-gradient-to-b from-white to-blue-50/40 p-6 sm:p-8 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:from-gray-900 dark:to-blue-950/20">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:border-indigo-900">
                  <CheckCircleIcon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-300">
                  Human-in-the-loop
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white">
                AI đề xuất. Con người xác minh.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                AI không tự động biến nội dung thành chân lý. Chỉ người có thẩm quyền mới được phê duyệt tri thức chính thức.
              </p>

              {/* Interactive Step Preview */}
              <div className="mt-6 space-y-2.5">
                {verificationSteps.map((step, idx) => {
                  const isSelected = activeVerificationStep === idx;
                  return (
                    <div
                      key={step.id}
                      onClick={() => setActiveVerificationStep(idx)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-blue-600 bg-white shadow-md ring-2 ring-blue-500/20 dark:bg-gray-800"
                          : "border-slate-200/80 bg-white/60 hover:bg-white dark:border-gray-700 dark:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-500">
                          {step.badge}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${step.statusColor}`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                        {step.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-[#334155] leading-relaxed dark:text-gray-300">
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Principle Callout */}
            <div className="mt-6 rounded-xl bg-blue-100/60 p-3 text-center text-xs font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-300">
              100% tri thức chính thức được bảo chứng bởi Tech Lead
            </div>
          </div>

          {/* Bento Card 3: Source-Based Retrieval (Medium - 6 cols) */}
          <div className="md:col-span-12 lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 dark:bg-sky-950/70">
                  <ShootingStarIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">
                  Trích dẫn minh bạch
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white">
                Câu trả lời có thể kiểm chứng nguồn
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                Đặt câu hỏi tự nhiên về quy trình kỹ thuật. Mọi câu trả lời của trợ lý AI đều liên kết với tài liệu gốc hoặc cảnh báo khi thiếu bằng chứng.
              </p>

              {/* Q&A Preview */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                <div className="font-bold text-[#0F172A] mb-1.5 dark:text-white flex items-center gap-1.5">
                  <span className="text-blue-600 font-extrabold">Q:</span>
                  <span>Thời gian hết hạn của Refresh Token được quy định như thế nào?</span>
                </div>
                <div className="text-[11px] text-[#334155] leading-relaxed dark:text-gray-300 bg-white p-2.5 rounded-xl border border-slate-200 dark:bg-gray-900 dark:border-gray-700">
                  <span className="font-bold text-blue-600">A:</span> Refresh token lưu trong HttpOnly Secure Cookie với TTL là 7 ngày. Khi người dùng đổi mật khẩu, token cũ bị thu hồi ngay lập tức.
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 font-bold border border-blue-200">
                    Nguồn [1]: SecSpec v1.4
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 font-bold border border-blue-200">
                    Nguồn [2]: Commit #8e391b
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-blue-600 dark:border-gray-800">
              <span>Không bịa đặt thông tin ngoài phạm vi tài liệu</span>
            </div>
          </div>

          {/* Bento Card 4: Seamless Handover (Medium - 6 cols) */}
          <div className="md:col-span-12 lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 text-amber-600 dark:bg-amber-950/70">
                  <TaskIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                  Không gián đoạn
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white">
                Bàn giao không mất ngữ cảnh
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                Chuẩn bị gói bàn giao hoàn chỉnh gồm trách nhiệm đang mở, các câu hỏi chưa giải quyết và các tri thức cần người kế nhiệm tiếp tục vận hành.
              </p>

              {/* Handover Packet Preview */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#0F172A] dark:text-white">
                    Gói bàn giao: Module IAM & SSO
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Sẵn sàng tiếp quản
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] text-[#334155] dark:text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    <span>5 Quyết định kiến trúc cốt lõi đã xác minh</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>1 Vấn đề đang mở: Tích hợp Azure SAML trong Sprint 25</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    <span>Bộ tài liệu kiểm chứng kèm contact người phụ trách trước</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-blue-600 dark:border-gray-800">
              <span>Người mới tiếp nhận công việc trong vài giờ thay vì vài tuần</span>
            </div>
          </div>

          {/* Bento Card 5: Connected Knowledge Diagram (Wide - 12 cols) */}
          <div className="md:col-span-12 rounded-3xl border border-slate-200/90 bg-gradient-to-r from-white via-[#F8FAFC] to-blue-50/50 p-6 sm:p-8 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/20">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-xl">
                <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 mb-2 dark:bg-blue-950 dark:text-blue-300">
                  Toàn cảnh Mạng lưới
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white">
                  Tri thức không còn là những mảnh rời rạc
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                  Từ một dòng Work Note nhỏ, hệ thống tự động kết nối với Pull Request, người thẩm định, tài liệu đặc tả và gói bàn giao tương ứng. Bức tranh kiến trúc dự án luôn sống động và liên tục.
                </p>
              </div>

              {/* Compact Visual Connection Flow */}
              <div className="w-full lg:w-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-bold text-[#0F172A] dark:text-white">
                <div className="rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 shadow-xs dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                  <DocsIcon className="h-4 w-4 text-blue-600" />
                  <span>Work Note</span>
                </div>
                <span className="text-blue-500 font-extrabold">&rarr;</span>
                <div className="rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 shadow-xs dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-indigo-600" />
                  <span>Git PR / Evidence</span>
                </div>
                <span className="text-blue-500 font-extrabold">&rarr;</span>
                <div className="rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 shadow-xs dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-cyan-600" />
                  <span>Tech Lead Verify</span>
                </div>
                <span className="text-blue-500 font-extrabold">&rarr;</span>
                <div className="rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 shadow-xs dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                  <TaskIcon className="h-4 w-4 text-amber-500" />
                  <span>Handover Package</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
