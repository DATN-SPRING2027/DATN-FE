"use client";

import React, { useState } from "react";
import Landing3DCard from "./Landing3DCard";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  TimeIcon,
} from "@/icons";

export default function LandingDemoSection() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "verify" | "chat">("knowledge");

  const scrollToDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("demo-viewport");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="demo" className="py-20 md:py-28 bg-[#F0FDF4]/50 border-t border-[#DCFCE7] dark:bg-gray-900/80 dark:border-gray-800">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-white px-3.5 py-1 text-xs font-bold text-[#059669] shadow-2xs mb-3 border border-[#A7F3D0] dark:bg-gray-800 dark:border-gray-700 dark:text-emerald-300">
            Xem trước trải nghiệm thực tế
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white">
            Giao diện trực quan cho toàn bộ vòng đời tri thức
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#334155] sm:text-lg dark:text-gray-300">
            Khám phá cách các nhóm kỹ sư ghi lại công việc, phê duyệt tri thức và tra cứu thông tin nhanh chóng ngay trên Continuum AI.
          </p>

          {/* Interactive Mode Switcher Tabs */}
          <div className="mt-8 inline-flex items-center rounded-2xl bg-white p-1.5 shadow-sm border border-[#E2ECE5] dark:bg-gray-800 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "knowledge"
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-[#334155] hover:text-[#059669] dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <DocsIcon className="h-4 w-4" />
              <span>1. Kho tri thức dự án</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("verify")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "verify"
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-[#334155] hover:text-[#059669] dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>2. Thẩm định & Xác nhận</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "chat"
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-[#334155] hover:text-[#059669] dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <ShootingStarIcon className="h-4 w-4" />
              <span>3. Hỏi đáp có trích dẫn</span>
            </button>
          </div>
        </div>

        {/* 3D Demo Viewport */}
        <div id="demo-viewport" className="mt-10">
          <Landing3DCard maxTilt={5} className="w-full">
            <div className="rounded-3xl border border-[#E2ECE5] bg-white p-4 sm:p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
              {/* Browser chrome header */}
              <div className="flex items-center justify-between border-b border-[#E2ECE5] pb-3 mb-5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-2 text-xs font-bold text-[#0F172A] dark:text-white">
                    Continuum AI Studio
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-md bg-[#F8FAF9] px-3 py-1 text-xs text-[#64748B] border border-[#E2ECE5] dark:bg-gray-800 dark:border-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  <span>Dự án: Enterprise Knowledge Base • Sprint 24</span>
                </div>
                <div className="text-xs text-[#64748B] dark:text-gray-400 font-medium">
                  Chế độ khách xem thử
                </div>
              </div>

              {/* Dynamic Viewport Content based on Active Tab */}
              {activeTab === "knowledge" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                        Danh sách tri thức đã lưu vết
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-gray-400">
                        Tổng hợp từ các Work Notes và báo cáo giải quyết vấn đề
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#065F46] border border-[#D1FAE5]">
                      3 mục hiển thị
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[#E2ECE5] bg-[#F8FAF9] p-4 dark:border-gray-800 dark:bg-gray-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                          <CheckCircleIcon className="h-3 w-3" /> Đã xác minh
                        </span>
                        <span className="text-[10px] text-[#64748B]">14/10/2026</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                        Quyết định chọn Redis Cache cho User Session
                      </h4>
                      <p className="mt-1 text-[11px] text-[#334155] line-clamp-2 dark:text-gray-300">
                        Giảm tải cho cơ sở dữ liệu chính khi lượng người dùng đồng thời tăng đột biến.
                      </p>
                      <div className="mt-3 text-[10px] text-[#059669] font-semibold">
                        Nguồn: PR #89 • Kiến trúc hệ thống v3
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E2ECE5] bg-[#F8FAF9] p-4 dark:border-gray-800 dark:bg-gray-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                          <CheckCircleIcon className="h-3 w-3" /> Đã xác minh
                        </span>
                        <span className="text-[10px] text-[#64748B]">12/10/2026</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                        Cách xử lý Timeout khi gọi SAG Inference Engine
                      </h4>
                      <p className="mt-1 text-[11px] text-[#334155] line-clamp-2 dark:text-gray-300">
                        Điều chỉnh client timeout lên 45s và bật stream SSE để tránh đứt kết nối.
                      </p>
                      <div className="mt-3 text-[10px] text-[#059669] font-semibold">
                        Nguồn: Commit #a3c9f2 • Báo cáo sự cố Incident-04
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E2ECE5] bg-[#F8FAF9] p-4 dark:border-gray-800 dark:bg-gray-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#64748B] dark:bg-gray-700 dark:text-gray-300">
                          <TimeIcon className="h-3 w-3" /> Chờ kiểm chứng
                        </span>
                        <span className="text-[10px] text-[#64748B]">Hôm nay</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                        Đề xuất cấu hình Rate Limiting theo Organization
                      </h4>
                      <p className="mt-1 text-[11px] text-[#334155] line-clamp-2 dark:text-gray-300">
                        AI đề xuất từ draft PR của thành viên chuyển giao trước kỳ nghỉ phép.
                      </p>
                      <div className="mt-3 text-[10px] text-[#64748B] font-semibold">
                        Chờ Tech Lead duyệt bằng chứng
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "verify" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                        Khu vực thẩm định tri thức (Lead Verification Workflow)
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-gray-400">
                        Chỉ người có thẩm quyền mới có quyền xác nhận để bảo đảm độ tin cậy
                      </p>
                    </div>
                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#059669] border border-[#A7F3D0]">
                      Human-in-the-loop Active
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#E2ECE5] bg-[#F8FAF9] p-4.5 dark:border-gray-800 dark:bg-gray-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#059669]">
                          Tri thức đề xuất bởi AI từ PR #108
                        </span>
                        <h4 className="text-sm font-bold text-[#0F172A] dark:text-white mt-1">
                          Cơ chế đồng bộ 2 pha giữa Postgres và MongoDB trong module IAM
                        </h4>
                      </div>
                      <span className="rounded-md bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#D97706] border border-[#FDE68A]">
                        Chờ Lead xác nhận
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl bg-white p-3 border border-[#E2ECE5] text-xs space-y-2 dark:bg-gray-900 dark:border-gray-700">
                      <p className="text-[#334155] dark:text-gray-300">
                        <strong>Bằng chứng đính kèm:</strong> commit hash <code>8f2e91a</code>, tài liệu thiết kế <code>docs/architecture/iam-sync.md</code>, và kết quả kiểm thử tải 1000 users.
                      </p>
                      <p className="text-[#334155] dark:text-gray-300">
                        <strong>Đánh giá của hệ thống:</strong> Đủ tài liệu tham chiếu, không có xung đột mã nguồn.
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        className="rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#334155] hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Yêu cầu bổ sung bằng chứng
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#047857]"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        <span>Phê duyệt & Xác minh</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chat" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                        Trợ lý Continuum AI — Hỏi đáp có trích dẫn nguồn
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-gray-400">
                        Truy vấn gói bàn giao, giải thích nguyên nhân và chỉ rõ nguồn tài liệu
                      </p>
                    </div>
                    <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#059669]">
                      RAG Verified
                    </span>
                  </div>

                  {/* Chat Message 1: User */}
                  <div className="flex items-start gap-3 justify-end">
                    <div className="max-w-xl rounded-2xl bg-[#059669] px-4 py-3 text-xs text-white shadow-sm">
                      <p>
                        &ldquo;Tôi là người mới tiếp nhận module IAM. Tại sao chúng ta không lưu access token vào LocalStorage?&rdquo;
                      </p>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] text-xs font-bold border border-[#A7F3D0]">
                      Dev
                    </div>
                  </div>

                  {/* Chat Message 2: AI Assistant with citations */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#059669] text-white">
                      <ShootingStarIcon className="h-4 w-4" />
                    </div>
                    <div className="max-w-2xl rounded-2xl border border-[#E2ECE5] bg-[#F8FAF9] p-4 text-xs text-[#334155] shadow-sm space-y-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <p className="leading-relaxed">
                        Theo quyết định kỹ thuật của nhóm, <strong>Access token và Refresh token tuyệt đối không lưu trong LocalStorage</strong> để phòng ngừa tấn công XSS. Toàn bộ token được quản lý qua <strong>HttpOnly Cookie</strong> thông qua Backend-for-Frontend (BFF) proxy.
                      </p>
                      <div className="pt-2 border-t border-[#E2ECE5] dark:border-gray-700 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0F172A] text-[11px] dark:text-white">
                          Trích dẫn nguồn kiểm chứng:
                        </span>
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#059669] border border-[#A7F3D0] shadow-2xs">
                          [Quyết định kiến trúc ADR-08]
                        </span>
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#059669] border border-[#A7F3D0] shadow-2xs">
                          [BFF Auth Spec v1.4]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom interactive button */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between border-t border-[#E2ECE5] pt-4 gap-3 dark:border-gray-800">
                <span className="text-xs text-[#64748B] dark:text-gray-400">
                  Dữ liệu minh họa thực tế • Không tạo số liệu giả lập
                </span>
                <button
                  type="button"
                  onClick={scrollToDemo}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#047857] hover:to-[#059669]"
                >
                  <span>Trải nghiệm Continuum AI</span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Landing3DCard>
        </div>
      </div>
    </section>
  );
}
