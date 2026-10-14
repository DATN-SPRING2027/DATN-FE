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
      icon: <DocsIcon className="h-6 w-6 text-[#059669]" />,
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
      icon: <CheckCircleIcon className="h-6 w-6 text-[#10B981]" />,
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
      icon: <ShootingStarIcon className="h-6 w-6 text-[#0D9488]" />,
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
      icon: <TaskIcon className="h-6 w-6 text-[#D97706]" />,
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
    <section id="tinh-nang" className="py-16 md:py-24 bg-[#F8FAF9] dark:bg-gray-950">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-[#ECFDF5] px-3.5 py-1 text-xs font-bold text-[#065F46] border border-[#A7F3D0] mb-3 dark:bg-emerald-950 dark:text-emerald-300">
            Tính năng cốt lõi
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white">
            Công cụ duy trì mạch tri thức liên tục cho đội ngũ
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#334155] sm:text-lg dark:text-gray-300">
            Thiết kế bám sát thực tế phát triển phần mềm: không tạo thêm gánh nặng tài liệu hoá, kiểm soát chặt chẽ chất lượng thông tin trước khi chia sẻ.
          </p>
        </div>

        {/* 4 Feature Cards Grid with 3D Tilt */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {features.map((feature) => (
            <Landing3DCard key={feature.id} maxTilt={6} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-[#E2ECE5] bg-white p-6 sm:p-7 shadow-sm transition-all hover:border-[#10B981]/50 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
                <div>
                  {/* Card Header: Icon + Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5] dark:bg-emerald-950/70">
                      {feature.icon}
                    </div>
                    <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#334155] dark:bg-gray-800 dark:text-gray-300">
                      {feature.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-[#0F172A] dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>

                {/* Micro Product Preview inside each card with organic feel */}
                <div className="mt-6 rounded-xl border border-[#E2ECE5] bg-[#F8FAF9] p-4 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                  <div className="flex items-center justify-between border-b border-[#E2ECE5] pb-2 mb-2.5 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 font-semibold text-[#0F172A] dark:text-white truncate">
                      <FileIcon className="h-3.5 w-3.5 text-[#059669]" />
                      <span className="truncate">{feature.mockup.title}</span>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-[#64748B] dark:text-gray-400">
                      {feature.mockup.status}
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-[11px] text-[#334155] dark:text-gray-300">
                    {feature.mockup.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-1.5">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[#10B981] shrink-0" />
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
