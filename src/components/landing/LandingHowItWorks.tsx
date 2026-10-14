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
      icon: <DocsIcon className="h-5 w-5 text-[#059669]" />,
      actionLabel: "Lưu vết tự nhiên",
    },
    {
      step: "02",
      name: "Đề xuất",
      subtitle: "Continuum AI Engine",
      desc: "AI hỗ trợ tìm kiếm, tổng hợp và tổ chức các đoạn tri thức quan trọng từ nguồn dữ liệu được cấp phép trong dự án.",
      icon: <ShootingStarIcon className="h-5 w-5 text-[#0D9488]" />,
      actionLabel: "Gợi ý tri thức",
    },
    {
      step: "03",
      name: "Kiểm chứng",
      subtitle: "Tech Lead / Người có thẩm quyền",
      desc: "Người có trách nhiệm kiểm tra tài liệu bằng chứng, tính chuẩn xác của nội dung trước khi bấm xác nhận chính thức.",
      icon: <CheckCircleIcon className="h-5 w-5 text-[#10B981]" />,
      actionLabel: "Bảo chứng chất lượng",
    },
    {
      step: "04",
      name: "Bàn giao",
      subtitle: "Người kế nhiệm / Thành viên mới",
      desc: "Người kế nhiệm tra cứu gói bàn giao hoàn chỉnh và đặt câu hỏi cho trợ lý AI để nhận câu trả lời có trích dẫn nguồn chuẩn.",
      icon: <TaskIcon className="h-5 w-5 text-[#D97706]" />,
      actionLabel: "Tiếp quản tức thì",
    },
  ];

  return (
    <section id="cach-hoat-dong" className="py-16 md:py-24 border-t border-[#E2ECE5] bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#ECFDF5] px-3.5 py-1 text-xs font-bold text-[#065F46] border border-[#A7F3D0] mb-3 dark:bg-emerald-950 dark:text-emerald-300">
            Quy trình làm việc
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white">
            Cách Continuum AI vận hành
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#334155] sm:text-lg dark:text-gray-300">
            Mô hình 4 bước khép kín đảm bảo tri thức luôn được thu thập đúng lúc, thẩm định đúng người và chuyển giao đúng đích.
          </p>
        </div>

        {/* 4 Steps Timeline / Stepper */}
        <div className="mt-14 relative">
          {/* Desktop Connecting Line with organic gradient */}
          <div
            className="hidden lg:block absolute top-1/2 left-8 right-8 -translate-y-8 h-1 bg-gradient-to-r from-[#D1FAE5] via-[#A7F3D0] to-[#D1FAE5] -z-0 rounded-full"
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
                          ? "border-[#10B981] bg-white shadow-xl ring-2 ring-[#10B981]/25 dark:bg-gray-800 dark:border-emerald-500"
                          : "border-[#E2ECE5] bg-[#F8FAF9] hover:border-[#10B981]/40 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div>
                        {/* Step Number + Icon Badge */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-sm font-extrabold text-[#059669] border border-[#D1FAE5] dark:bg-emerald-950/70">
                            {item.step}
                          </span>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#E2ECE5] shadow-2xs dark:bg-gray-700 dark:border-gray-600">
                            {item.icon}
                          </div>
                        </div>

                        {/* Title and Role */}
                        <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">
                          {item.name}
                        </h3>
                        <p className="text-xs font-semibold text-[#059669] mb-2 dark:text-emerald-400">
                          {item.subtitle}
                        </p>

                        {/* Description */}
                        <p className="text-xs leading-relaxed text-[#334155] dark:text-gray-300">
                          {item.desc}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#E2ECE5] text-[11px] font-medium text-[#64748B] flex items-center justify-between dark:border-gray-700 dark:text-gray-400">
                        <span>{item.actionLabel}</span>
                        <span className="text-[#10B981] font-bold">&bull;</span>
                      </div>
                    </div>
                  </Landing3DCard>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mandatory Explicit Note: AI proposes; humans verify */}
        <div className="mt-12 mx-auto max-w-2xl rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/80 p-4.5 sm:p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#059669] text-white">
              <InfoIcon className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <span className="font-bold text-[#065F46] dark:text-emerald-300">
                Nguyên tắc cốt lõi:{" "}
              </span>
              <span className="text-[#334155] dark:text-gray-300">
                AI đóng vai trò tổng hợp và đưa ra đề xuất; con người (Tech Lead / Maintainer) luôn là người trực tiếp xem xét bằng chứng và xác nhận tri thức trước khi lưu hành.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
