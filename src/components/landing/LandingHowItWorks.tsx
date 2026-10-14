"use client";

import React, { useState } from "react";
import Landing3DCard from "./Landing3DCard";
import {
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  TaskIcon,
  InfoIcon,
} from "@/icons";

export default function LandingHowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      step: "01",
      name: "Ghi nhận",
      subtitle: "Thành viên dự án",
      desc: "Thành viên thêm ghi chú công việc (Work Notes), quyết định kỹ thuật và đính kèm nguồn liên quan (PR, commit, tài liệu thiết kế).",
      icon: <DocsIcon className="h-5 w-5 text-[#465FFF]" />,
      actionLabel: "Lưu vết tự nhiên",
    },
    {
      step: "02",
      name: "Đề xuất",
      subtitle: "Continuum AI Engine",
      desc: "AI hỗ trợ tìm kiếm, tổng hợp và tổ chức các đoạn tri thức quan trọng từ nguồn dữ liệu được cấp phép trong dự án.",
      icon: <ShootingStarIcon className="h-5 w-5 text-[#465FFF]" />,
      actionLabel: "Gợi ý tri thức",
    },
    {
      step: "03",
      name: "Kiểm chứng",
      subtitle: "Tech Lead / Người có thẩm quyền",
      desc: "Người có trách nhiệm kiểm tra tài liệu bằng chứng, tính chuẩn xác của nội dung trước khi bấm xác nhận chính thức.",
      icon: <CheckCircleIcon className="h-5 w-5 text-[#12B76A]" />,
      actionLabel: "Bảo chứng chất lượng",
    },
    {
      step: "04",
      name: "Bàn giao",
      subtitle: "Người kế nhiệm / Thành viên mới",
      desc: "Người kế nhiệm tra cứu gói bàn giao hoàn chỉnh và đặt câu hỏi cho trợ lý AI để nhận câu trả lời có trích dẫn nguồn chuẩn.",
      icon: <TaskIcon className="h-5 w-5 text-[#465FFF]" />,
      actionLabel: "Tiếp quản tức thì",
    },
  ];

  return (
    <section id="cach-hoat-dong" className="py-16 md:py-24 border-t border-[#E4E7EC] bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#ECF3FF] px-3.5 py-1 text-xs font-semibold text-[#465FFF] mb-3 dark:bg-brand-950 dark:text-brand-300">
            Quy trình làm việc
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl lg:text-4xl dark:text-white">
            Cách Continuum AI vận hành
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#344054] sm:text-lg dark:text-gray-300">
            Mô hình 4 bước khép kín đảm bảo tri thức luôn được thu thập đúng lúc, thẩm định đúng người và chuyển giao đúng đích.
          </p>
        </div>

        {/* 4 Steps Timeline / Stepper */}
        <div className="mt-14 relative">
          {/* Desktop Connecting Line */}
          <div
            className="hidden lg:block absolute top-1/2 left-8 right-8 -translate-y-8 h-1 bg-gradient-to-r from-[#ECF3FF] via-[#DDE9FF] to-[#ECF3FF] -z-0 rounded-full"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 relative z-10">
            {steps.map((item, idx) => {
              const isSelected = activeStep === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className="cursor-pointer group"
                >
                  <Landing3DCard maxTilt={8} className="h-full">
                    <div
                      className={`flex h-full flex-col justify-between rounded-2xl border p-6 transition-all ${
                        isSelected
                          ? "border-[#465FFF] bg-white shadow-xl ring-2 ring-[#465FFF]/20 dark:bg-gray-800 dark:border-brand-500"
                          : "border-[#E4E7EC] bg-[#F9FAFB] hover:border-gray-300 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div>
                        {/* Step Number + Icon Badge */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECF3FF] text-sm font-extrabold text-[#465FFF] dark:bg-brand-950/70">
                            {item.step}
                          </span>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#E4E7EC] shadow-2xs dark:bg-gray-700 dark:border-gray-600">
                            {item.icon}
                          </div>
                        </div>

                        {/* Title and Role */}
                        <h3 className="text-lg font-bold text-[#101828] dark:text-white">
                          {item.name}
                        </h3>
                        <p className="text-xs font-semibold text-[#465FFF] mb-2 dark:text-brand-400">
                          {item.subtitle}
                        </p>

                        {/* Description */}
                        <p className="text-xs leading-relaxed text-[#344054] dark:text-gray-300">
                          {item.desc}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#E4E7EC] text-[11px] font-medium text-[#667085] flex items-center justify-between dark:border-gray-700 dark:text-gray-400">
                        <span>{item.actionLabel}</span>
                        <span className="text-[#465FFF] font-bold">&bull;</span>
                      </div>
                    </div>
                  </Landing3DCard>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mandatory Explicit Note: AI proposes; humans verify */}
        <div className="mt-12 mx-auto max-w-2xl rounded-2xl border border-[#DDE9FF] bg-[#ECF3FF]/80 p-4.5 sm:p-5 shadow-sm dark:border-brand-900/50 dark:bg-brand-950/40">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#465FFF] text-white">
              <InfoIcon className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <span className="font-bold text-[#101828] dark:text-white">
                Nguyên tắc cốt lõi:{" "}
              </span>
              <span className="text-[#344054] dark:text-gray-300">
                AI đóng vai trò tổng hợp và đưa ra đề xuất; con người (Tech Lead / Maintainer) luôn là người trực tiếp xem xét bằng chứng và xác nhận tri thức trước khi lưu hành.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
