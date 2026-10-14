"use client";

import React from "react";
import Landing3DCard from "./Landing3DCard";
import { CheckCircleIcon, DocsIcon, TaskIcon } from "@/icons";

export default function LandingProblemSolution() {
  const benefits = [
    {
      title: "Ghi lại khi công việc đang diễn ra",
      description:
        "Giữ lại quyết định, cách làm, trở ngại và bước tiếp theo ngay trong quá trình thực hiện, không đợi đến khi bàn giao mới nhớ lại.",
      icon: <DocsIcon className="h-6 w-6 text-[#465FFF]" />,
      badge: "In-flow capture",
    },
    {
      title: "Biết điều gì đã được kiểm chứng",
      description:
        "Xem rõ ràng trạng thái xác nhận, người chịu trách nhiệm và tài liệu bằng chứng đính kèm trước khi áp dụng tri thức vào thực tế.",
      icon: <CheckCircleIcon className="h-6 w-6 text-[#12B76A]" />,
      badge: "Xác thực con người",
    },
    {
      title: "Bàn giao có trọng tâm",
      description:
        "Giúp người kế nhiệm nhanh chóng nắm bắt trách nhiệm đang phụ trách, các câu hỏi còn mở và danh mục nguồn tham khảo tin cậy.",
      icon: <TaskIcon className="h-6 w-6 text-[#465FFF]" />,
      badge: "Chuyển giao mượt mà",
    },
  ];

  return (
    <section id="giai-phap" className="py-16 md:py-24 border-t border-[#E4E7EC] bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#ECF3FF] px-3.5 py-1 text-xs font-semibold text-[#465FFF] mb-3 dark:bg-brand-950 dark:text-brand-300">
            Thách thức & Giải pháp
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl lg:text-4xl dark:text-white">
            Khi một người rời dự án, kiến thức không nên rời theo.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#344054] sm:text-lg dark:text-gray-300">
            Trong các dự án phần mềm, lý do của quyết định kỹ thuật thường bị quên lãng, cách xử lý lỗi chỉ nằm trong kinh nghiệm cá nhân, khiến người tiếp nhận mất hàng tuần tìm hiểu lại từ đầu.
          </p>
        </div>

        {/* 3 Benefits Cards with 3D depth */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {benefits.map((benefit, idx) => (
            <Landing3DCard key={idx} maxTilt={6} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-[#E4E7EC] bg-[#F9FAFB] p-6.5 transition-all hover:bg-white hover:shadow-xl dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-[#E4E7EC] dark:bg-gray-700 dark:border-gray-600">
                      {benefit.icon}
                    </div>
                    <span className="rounded-full bg-[#ECF3FF] px-2.5 py-1 text-[11px] font-medium text-[#465FFF] dark:bg-brand-950 dark:text-brand-300">
                      {benefit.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#101828] dark:text-white">
                    {benefit.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#344054] dark:text-gray-300">
                    {benefit.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E4E7EC] flex items-center gap-1.5 text-xs font-semibold text-[#465FFF] dark:border-gray-700">
                  <span>Khám phá cơ chế</span>
                  <span aria-hidden="true">&rarr;</span>
                </div>
              </div>
            </Landing3DCard>
          ))}
        </div>
      </div>
    </section>
  );
}
