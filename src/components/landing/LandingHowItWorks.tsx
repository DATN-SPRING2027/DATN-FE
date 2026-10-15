"use client";

import React, { useState } from "react";
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
      actor: "Nguyễn Văn A (Backend)",
      desc: "Kỹ sư lưu Work Note WN-104 kèm PR #88 và benchmark đo tải ngay khi code xong.",
      icon: DocsIcon,
      input: "Quyết định kỹ thuật, PR #88, kết quả đo tải",
      output: "Work Note WN-104 có bằng chứng đính kèm",
      mockup: {
        title: "Work Note: Kiến trúc Redis Pub/Sub",
        author: "Nguyễn Văn A",
        badge: "Đã lưu vết",
        details: [
          "Quyết định: Sử dụng Redis Pub/Sub đồng bộ session giữa các pod.",
          "Bằng chứng: PR #88 & Benchmark report (12.4ms latency).",
        ],
      },
    },
    {
      step: "02",
      name: "Đề xuất",
      subtitle: "AI Synthesis",
      actor: "Continuum AI Engine",
      desc: "AI phân tích ngữ cảnh và đề xuất đưa vào kho tri thức chuẩn của tổ chức.",
      icon: ShootingStarIcon,
      input: "Work Note WN-104 & file đặc tả",
      output: "Bản thảo tri thức ứng viên",
      mockup: {
        title: "Đề xuất: Chuẩn Session Caching cho Microservices",
        author: "Continuum AI",
        badge: "Chờ kiểm duyệt",
        details: [
          "AI nhận diện mẫu cấu hình lặp lại trong 3 module liên quan.",
          "Đề xuất tạo chuẩn kiến trúc cho toàn bộ các module kế thừa.",
        ],
      },
    },
    {
      step: "03",
      name: "Kiểm chứng",
      subtitle: "Human Verification",
      actor: "Trần Thị B (Tech Lead)",
      desc: "Tech Lead đối chiếu hạ tầng Kubernetes và bấm phê duyệt tri thức chính thức.",
      icon: CheckCircleIcon,
      input: "Bản thảo đề xuất & kết quả đo tải",
      output: "Tri thức chính thức được bảo chứng",
      mockup: {
        title: "Thẩm định: Chuẩn Session Caching",
        author: "Tech Lead Trần Thị B",
        badge: "Đã thẩm định",
        details: [
          "Xác nhận: Đã đối chiếu hạ tầng Kubernetes và chấp thuận.",
          "Trạng thái: Đã lưu vào kho tri thức chính thức của dự án.",
        ],
      },
    },
    {
      step: "04",
      name: "Bàn giao",
      subtitle: "Seamless Handover",
      actor: "Lê Minh B (Kỹ sư mới)",
      desc: "Người mới tiếp nhận gói bàn giao, tra cứu lý do kỹ thuật và tiếp tục công việc tức thì.",
      icon: TaskIcon,
      input: "Gói bàn giao & câu hỏi tra cứu",
      output: "Tiếp tục phát triển không gián đoạn",
      mockup: {
        title: "Gói bàn giao: Module IAM & Caching",
        author: "Kỹ sư Lê Minh B",
        badge: "Tiếp nối liên tục",
        details: [
          "5 Quyết định kiến trúc cốt lõi kèm bằng chứng.",
          "Tra cứu trợ lý AI: Câu trả lời kèm trích dẫn đối chiếu.",
        ],
      },
    },
  ];

  const currentStep = steps[activeStep];
  const StepIcon = currentStep.icon;

  return (
    <section
      id="cach-hoat-dong"
      className="py-14 md:py-20 border-t border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
            <span>Quy trình 4 giai đoạn</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Ghi nhận. Kết nối. Xác minh.{" "}
            <span className="text-blue-600 dark:text-blue-400">
              Tiếp nối không gián đoạn.
            </span>
          </h2>

          <p className="mt-2.5 text-sm sm:text-base text-[#334155] leading-relaxed dark:text-gray-300">
            Hành trình từng quyết định kỹ thuật trở thành tài sản được kiểm chứng vững chắc cho người tiếp nối.
          </p>
        </div>

        {/* Stepper Buttons */}
        <div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3.5">
            {steps.map((item, idx) => {
              const isSelected = activeStep === idx;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-600 bg-white shadow-md ring-2 ring-blue-500/20 dark:bg-gray-800 dark:border-blue-500"
                      : "border-slate-200 bg-[#F8FAFC] hover:border-blue-300 hover:bg-white dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-black text-xs transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900"
                    }`}
                  >
                    {item.step}
                  </div>
                  <div className="overflow-hidden">
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400">
                      {item.subtitle}
                    </span>
                    <span className="block truncate text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {item.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Stage Detail Card */}
          <div className="mt-5 rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-7 shadow-sm dark:border-gray-800 dark:bg-gray-800/60">
            <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-7">
              {/* Left Column: Stage Info */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold">
                    Giai đoạn {currentStep.step}
                  </span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    {currentStep.subtitle}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white">
                  {currentStep.name}: {currentStep.desc.split(".")[0]}
                </h3>

                <p className="text-xs sm:text-sm text-[#334155] leading-relaxed dark:text-gray-300">
                  {currentStep.desc}
                </p>

                {/* Responsible Actor */}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800">
                  <UserIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-slate-500 dark:text-gray-400">Chủ thể:</span>
                  <strong className="text-[#0F172A] dark:text-white">{currentStep.actor}</strong>
                </div>

                {/* Inputs & Outputs */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
                    <span className="block font-bold text-slate-500 text-[10px] dark:text-gray-400">
                      Đầu vào (Input):
                    </span>
                    <span className="text-[#334155] dark:text-gray-300 text-[11px]">{currentStep.input}</span>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/40">
                    <span className="block font-bold text-blue-700 text-[10px] dark:text-blue-300">
                      Đầu ra (Output):
                    </span>
                    <span className="text-[#334155] dark:text-gray-300 text-[11px] font-semibold">{currentStep.output}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Miniature Mockup */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950">
                        <StepIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-[#0F172A] dark:text-white">
                          Minh họa quy trình
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {currentStep.mockup.author}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                      {currentStep.mockup.badge}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] mb-2 dark:text-white">
                    {currentStep.mockup.title}
                  </h4>

                  <div className="space-y-1.5 text-xs text-[#334155] dark:text-gray-300">
                    {currentStep.mockup.details.map((detail, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-start gap-1.5 rounded-lg bg-[#F8FAFC] p-2 dark:bg-gray-800 text-[11px]"
                      >
                        <FileIcon className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 dark:border-gray-800">
                    <span>Giai đoạn {currentStep.step} / 04</span>
                    <span className="font-bold text-blue-600">Đã đồng bộ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Principle Callout */}
        <div className="mt-8 mx-auto max-w-xl rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-center sm:text-left dark:border-blue-900/50 dark:bg-blue-950/40">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs">
            <InfoIcon className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-bold text-blue-900 dark:text-blue-300">
              Nguyên tắc:{" "}
            </span>
            <span className="text-[#334155] dark:text-gray-300">
              AI hỗ trợ tổng hợp và đề xuất; Tech Lead trực tiếp rà soát bằng chứng và xác nhận trước khi lưu kho.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
