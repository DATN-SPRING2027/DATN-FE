"use client";

import React, { useState } from "react";
import { SectionHeading } from "./HeadingEmphasis";
import {
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  TaskIcon,
  InfoIcon,
  UserIcon,
  FileIcon,
} from "@/icons";

export default function LandingHowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      step: "01",
      name: "Ghi nhận",
      subtitle: "In-flow Capture",
      actor: "Thành viên dự án / Developer",
      desc: "Thành viên thêm ghi chú công việc (Work Notes), quyết định kỹ thuật và đính kèm tài liệu liên quan ngay khi triển khai.",
      icon: DocsIcon,
      input: "Quyết định kỹ thuật, PR, commit, sự cố hàng ngày",
      output: "Work Note có bằng chứng chứng minh",
      mockup: {
        title: "Work Note: Xử lý Cache Invalidation cho User Profile",
        author: "Kỹ sư Backend",
        badge: "Đã lưu vết",
        details: [
          "Quyết định: Sử dụng Redis Pub/Sub để trigger xoá cache khi cập nhật profile.",
          "Bằng chứng: Đính kèm PR #88 & Benchmark Test Report.",
        ],
      },
    },
    {
      step: "02",
      name: "Đề xuất",
      subtitle: "AI Synthesis",
      actor: "Continuum AI Engine",
      desc: "AI phân tích các nguồn dữ liệu được cấp phép, gom cụm các quyết định liên quan và đề xuất tri thức ứng viên vào kho dự án.",
      icon: ShootingStarIcon,
      input: "Kho Work Notes, PR description và tài liệu thiết kế",
      output: "Bản thảo tri thức ứng viên (Candidate Knowledge)",
      mockup: {
        title: "Đề xuất: Quy chuẩn cấu hình Timeout cho Microservices",
        author: "Continuum AI Assistant",
        badge: "Chờ kiểm duyệt",
        details: [
          "AI phát hiện mẫu cấu hình lặp lại trong 4 service gần nhất.",
          "Đề xuất đưa vào quy chuẩn chung của dự án để tránh sự cố treo socket.",
        ],
      },
    },
    {
      step: "03",
      name: "Kiểm chứng",
      subtitle: "Human Verification",
      actor: "Tech Lead / Người có thẩm quyền",
      desc: "Người có trách nhiệm kiểm tra tài liệu bằng chứng, đối chiếu tính chuẩn xác của nội dung trước khi bấm xác nhận chính thức.",
      icon: CheckCircleIcon,
      input: "Bản thảo tri thức đề xuất kèm bằng chứng thực thi",
      output: "Tri thức chính thức được bảo chứng (Verified Knowledge)",
      mockup: {
        title: "Thẩm định: Quy chuẩn cấu hình Timeout cho Microservices",
        author: "Tech Lead / System Architect",
        badge: "Đã xác minh bởi con người",
        details: [
          "Xác nhận: Đã đối chiếu với hạ tầng Kubernetes và chấp thuận.",
          "Trạng thái: Đã đưa vào kho tri thức chính thức của tổ chức.",
        ],
      },
    },
    {
      step: "04",
      name: "Bàn giao",
      subtitle: "Seamless Handover",
      actor: "Người kế nhiệm / Thành viên mới",
      desc: "Người kế nhiệm tra cứu gói bàn giao hoàn chỉnh và đặt câu hỏi cho trợ lý AI để nhận câu trả lời có trích dẫn nguồn chuẩn.",
      icon: TaskIcon,
      input: "Gói bàn giao chuyên biệt và các câu hỏi ngôn ngữ tự nhiên",
      output: "Nắm vững toàn bộ dự án mà không cần làm phiền người cũ",
      mockup: {
        title: "Tiếp quản: Gói bàn giao Core Microservices & Caching",
        author: "Kỹ sư kế nhiệm",
        badge: "Tiếp nối liên tục",
        details: [
          "Đã xem 12 quyết định kiến trúc kèm bằng chứng xác thực.",
          "Tra cứu trợ lý AI: 100% câu trả lời có nguồn trích dẫn đối chiếu.",
        ],
      },
    },
  ];

  const currentStep = steps[activeStep];
  const StepIcon = currentStep.icon;

  return (
    <section
      id="cach-hoat-dong"
      className="py-16 md:py-24 border-t border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Heading with Gradient Emphasis */}
        <SectionHeading
          badge="Quy trình 4 Bước Khép kín"
          regularText="Ghi nhận. Kết nối. Xác minh."
          emphasizedText="Tiếp nối không gián đoạn."
          emphasisVariant="gradient"
          description="Khám phá hành trình từng mẩu kinh nghiệm thực tế trở thành tài sản tri thức trường tồn của tổ chức."
          align="center"
        />

        {/* Horizontal Process Stepper Bar (Desktop & Mobile) */}
        <div className="mt-14">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            {steps.map((item, idx) => {
              const isSelected = activeStep === idx;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`group flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all ${
                    isSelected
                      ? "border-blue-600 bg-white shadow-lg ring-2 ring-blue-500/20 dark:bg-gray-800 dark:border-blue-500"
                      : "border-slate-200 bg-[#F8FAFC] hover:border-blue-300 hover:bg-white dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                        : "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900"
                    }`}
                  >
                    {item.step}
                  </div>
                  <div className="overflow-hidden">
                    <span className="block text-xs font-semibold text-slate-500 dark:text-gray-400">
                      {item.subtitle}
                    </span>
                    <span className="block truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {item.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Stage Detail Card */}
          <div className="mt-8 rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-6 sm:p-8 shadow-sm dark:border-gray-800 dark:bg-gray-800/60">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Left Column: Stage Info & Inputs/Outputs */}
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md bg-blue-600 text-white px-2.5 py-1 text-xs font-extrabold">
                    Bước {currentStep.step}
                  </span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    {currentStep.subtitle}
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">
                  {currentStep.name}: {currentStep.desc.split(".")[0]}
                </h3>

                <p className="text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                  {currentStep.desc}
                </p>

                {/* Actor */}
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                  <UserIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    Chủ thể thực hiện:
                  </span>
                  <strong className="text-xs text-[#0F172A] dark:text-white">
                    {currentStep.actor}
                  </strong>
                </div>

                {/* Inputs & Outputs Badges */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <span className="block font-bold text-slate-500 mb-1 dark:text-gray-400">
                      Đầu vào (Input):
                    </span>
                    <span className="text-[#334155] dark:text-gray-300">
                      {currentStep.input}
                    </span>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/40">
                    <span className="block font-bold text-blue-700 mb-1 dark:text-blue-300">
                      Đầu ra (Output):
                    </span>
                    <span className="text-[#334155] dark:text-gray-300 font-semibold">
                      {currentStep.output}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Miniature Interactive Visual Preview */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950">
                        <StepIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-[#0F172A] dark:text-white">
                          Mô phỏng quy trình
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {currentStep.mockup.author}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                      {currentStep.mockup.badge}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#0F172A] mb-3 dark:text-white">
                    {currentStep.mockup.title}
                  </h4>

                  <div className="space-y-2 text-xs text-[#334155] dark:text-gray-300">
                    {currentStep.mockup.details.map((detail, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-start gap-2 rounded-lg bg-[#F8FAFC] p-2.5 dark:bg-gray-800"
                      >
                        <FileIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{detail}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 dark:border-gray-800">
                    <span>Giai đoạn {currentStep.step} / 04</span>
                    <span className="font-bold text-blue-600">Đã đồng bộ hóa</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Prominent Core Principle Callout */}
        <div className="mt-12 mx-auto max-w-3xl rounded-3xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 p-6 sm:p-7 shadow-lg shadow-blue-500/5 dark:border-blue-900/60 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-blue-950/60">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30">
              <InfoIcon className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide mb-1.5">
                Nguyên tắc bất biến
              </span>
              <h4 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white">
                AI hỗ trợ tổng hợp. Con người quyết định điều gì được xác nhận.
              </h4>
              <p className="mt-1.5 text-xs sm:text-sm text-[#334155] leading-relaxed dark:text-gray-300">
                Continuum AI không bao giờ tự động xuất bản tri thức mà không có sự thẩm định của người chịu trách nhiệm. Công nghệ phục vụ con người, bảo toàn sự chính xác và tin cậy tuyệt đối.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
