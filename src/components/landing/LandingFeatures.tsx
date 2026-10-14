"use client";

import React from "react";
import Landing3DCard from "./Landing3DCard";
import {
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  TaskIcon,
  FileIcon,
} from "@/icons";

export default function LandingFeatures() {

  const features = [
    {
      id: "work-notes",
      badge: "Ghi nhận tức thì",
      title: "Work Notes và tài liệu",
      description:
        "Thành viên ghi lại kết quả công việc, cách thực hiện, lý do, trở ngại, bước tiếp theo và nguồn bằng chứng ngay khi đang thực hiện.",
      icon: <DocsIcon className="h-6 w-6 text-[#465FFF]" />,
      mockup: {
        title: "Work Note: Tối ưu hoá truy vấn MongoDB Index",
        type: "Ghi chú công việc",
        status: "Đã lưu vết",
        bullets: [
          "Lý do: Query aggregate chậm > 800ms khi dữ liệu tăng.",
          "Cách làm: Bổ sung Compound Index { organizationId, createdAt }.",
          "Bằng chứng: PR #42 & Query Explain Report đính kèm.",
        ],
      },
    },
    {
      id: "verified-knowledge",
      badge: "Human-in-the-loop",
      title: "Tri thức có kiểm chứng",
      description:
        "AI có thể đề xuất nội dung từ nguồn được phép; người có thẩm quyền xem xét trước khi tri thức được xác nhận chính thức.",
      icon: <CheckCircleIcon className="h-6 w-6 text-[#12B76A]" />,
      mockup: {
        title: "Thẩm định: Quy tắc xử lý Dead Letter Queue",
        type: "Đề xuất bởi AI • Chờ phê duyệt",
        status: "Cần thẩm định",
        bullets: [
          "Nguồn tổng hợp: Git Commit history & SAG architecture doc.",
          "Người thẩm định chỉ định: Tech Lead / Module Owner.",
          "Cam kết: Không đưa tri thức chưa kiểm chứng vào kho chung.",
        ],
      },
    },
    {
      id: "cited-assistant",
      badge: "Trích dẫn nguồn gốc",
      title: "Trợ lý hỏi đáp có trích dẫn",
      description:
        "Người dùng hỏi về tri thức được phép truy cập. Câu trả lời hiển thị nguồn tham khảo; nếu thiếu bằng chứng, hệ thống cần thể hiện rõ điều đó.",
      icon: <ShootingStarIcon className="h-6 w-6 text-[#465FFF]" />,
      mockup: {
        title: "Hỏi đáp dự án: Cơ chế xác thực JWT",
        type: "Continuum RAG Assistant",
        status: "Có nguồn dẫn",
        bullets: [
          "Câu hỏi: Refresh token lưu ở đâu và expire trong bao lâu?",
          "Trả lời: Lưu trong HttpOnly Cookie, TTL 7 ngày [Auth Spec v1.1].",
          "Cảnh báo: Nếu câu hỏi nằm ngoài phạm vi tài liệu, AI sẽ thông báo chưa có dữ liệu.",
        ],
      },
    },
    {
      id: "handover-flow",
      badge: "Không đứt gãy",
      title: "Quy trình bàn giao",
      description:
        "Nhóm chuẩn bị nội dung bàn giao, trách nhiệm đang mở, câu hỏi chưa giải quyết và tri thức cần người kế nhiệm tiếp tục.",
      icon: <TaskIcon className="h-6 w-6 text-[#465FFF]" />,
      mockup: {
        title: "Gói bàn giao: Module IAM & Organization",
        type: "Gói chuyển giao bàn giao",
        status: "Sẵn sàng bàn giao",
        bullets: [
          "Trách nhiệm chuyển giao: 3 tính năng đang vận hành.",
          "Vấn đề còn mở: Tích hợp SAML SSO trong Sprint 12.",
          "Bộ tài liệu & Context dành riêng cho người kế nhiệm.",
        ],
      },
    },
  ];

  return (
    <section id="tinh-nang" className="py-16 md:py-24 bg-[#F9FAFB] dark:bg-gray-950">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#ECF3FF] px-3.5 py-1 text-xs font-semibold text-[#465FFF] mb-3 dark:bg-brand-950 dark:text-brand-300">
            Tính năng cốt lõi
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl lg:text-4xl dark:text-white">
            Công cụ duy trì mạch tri thức liên tục cho đội ngũ
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#344054] sm:text-lg dark:text-gray-300">
            Thiết kế bám sát thực tế phát triển phần mềm: không tạo thêm gánh nặng tài liệu hoá, kiểm soát chặt chẽ chất lượng thông tin trước khi chia sẻ.
          </p>
        </div>

        {/* 4 Feature Cards Grid with 3D Tilt */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {features.map((feature) => (
            <Landing3DCard key={feature.id} maxTilt={6} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-[#E4E7EC] bg-white p-6 sm:p-7 shadow-sm transition-all hover:border-[#465FFF]/40 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
                <div>
                  {/* Card Header: Icon + Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECF3FF] text-[#465FFF] dark:bg-brand-950/70">
                      {feature.icon}
                    </div>
                    <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-semibold text-[#344054] dark:bg-gray-800 dark:text-gray-300">
                      {feature.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-[#101828] dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#344054] dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>

                {/* Micro Product Preview inside each card with 3D elevation */}
                <div className="mt-6 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                  <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2 mb-2.5 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 font-semibold text-[#101828] dark:text-white truncate">
                      <FileIcon className="h-3.5 w-3.5 text-[#465FFF]" />
                      <span className="truncate">{feature.mockup.title}</span>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-[#667085] dark:text-gray-400">
                      {feature.mockup.status}
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-[11px] text-[#344054] dark:text-gray-300">
                    {feature.mockup.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[#465FFF] shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Landing3DCard>
          ))}
        </div>
      </div>
    </section>
  );
}
