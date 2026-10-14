"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  TimeIcon,
  FileIcon,
  CheckLineIcon,
} from "@/icons";

interface KnowledgeItem {
  id: string;
  code: string;
  title: string;
  category: string;
  status: "verified" | "pending";
  date: string;
  summary: string;
  source: string;
  reviewer: string;
  details: string;
}

const PROJECT_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "k-1",
    code: "WN-104",
    title: "Kiến trúc Redis Pub/Sub & Token Revocation",
    category: "Cấu trúc Caching",
    status: "verified",
    date: "14/10/2026",
    summary:
      "Chuyển trạng thái session và token blacklist từ in-memory sang cụm Redis Pub/Sub phân tán để chịu tải 100k users đồng thời.",
    source: "PR #88 • Benchmark_100k.pdf",
    reviewer: "Trần Thị B (Tech Lead)",
    details:
      "Tối ưu hoá cụm Redis Cluster 3-node, đảm bảo failover tự động trong 3 giây. Latency p99 đạt 12.4ms trong đợt tải 100k rps.",
  },
  {
    id: "k-2",
    code: "WN-105",
    title: "Cơ chế xoay vòng Refresh Token an toàn",
    category: "Bảo mật IAM",
    status: "verified",
    date: "12/10/2026",
    summary:
      "Refresh token được lưu trong HttpOnly Secure Cookie với thời hạn 7 ngày, tự động vô hiệu hoá khi phát hiện truy cập bất thường.",
    source: "Auth Spec v1.4 • RFC-7519",
    reviewer: "Trần Thị B (Tech Lead)",
    details:
      "Bổ sung cơ chế Fingerprinting để phát hiện token reuse. Nếu token cũ được sử dụng lại, toàn bộ token tree của user bị thu hồi ngay.",
  },
  {
    id: "k-3",
    code: "WN-106",
    title: "Đặc tả tích hợp Azure AD SAML 2.0 (Sprint 25)",
    category: "Mở rộng SSO",
    status: "pending",
    date: "11/10/2026",
    summary:
      "Đề xuất phương án mapping thuộc tính Azure AD claims sang role RBAC nội bộ của Continuum AI.",
    source: "Draft Spec v0.2 • Issue #204",
    reviewer: "Chờ thẩm định bởi Tech Lead",
    details:
      "Đang chờ phê duyệt sơ đồ luồng IDP-initiated SAML flow trước khi tiến hành code trong Sprint 25.",
  },
];

export default function LandingDemoSection() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "verify" | "chat">("knowledge");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "verified" | "pending">("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem>(PROJECT_KNOWLEDGE_ITEMS[0]);
  const [verifyStatus, setVerifyStatus] = useState<"pending" | "approved">("pending");
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState<string>(
    "Tại sao nhóm quyết định dùng Redis Pub/Sub thay vì RabbitMQ cho cụm IAM?"
  );

  const filteredItems = PROJECT_KNOWLEDGE_ITEMS.filter((item) => {
    if (selectedFilter === "verified") return item.status === "verified";
    if (selectedFilter === "pending") return item.status === "pending";
    return true;
  });

  return (
    <section
      id="demo"
      className="py-20 md:py-28 bg-[#F0F7FF]/50 border-t border-blue-100 dark:bg-gray-900/80 dark:border-gray-800"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3.5 border border-blue-200 dark:bg-gray-800 dark:border-gray-700 dark:text-blue-300">
            <span>Trải nghiệm Sản phẩm Thực tế</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Khám phá cách tri thức được tiếp nối
          </h2>

          <p className="mt-3.5 text-base text-[#334155] leading-relaxed dark:text-gray-300">
            Xem trước giao diện Continuum AI với các chức năng tra cứu, kiểm chứng và đối chiếu bằng chứng kỹ thuật trong dự án Core IAM & Caching.
          </p>
        </div>

        {/* Interactive Mode Switcher Tabs */}
        <div className="flex justify-start sm:justify-center mb-6">
          <div
            role="tablist"
            className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "knowledge"}
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "knowledge"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-[#334155] hover:text-blue-600 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <DocsIcon className="h-4 w-4" />
              <span>1. Kho tri thức dự án</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "verify"}
              onClick={() => setActiveTab("verify")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "verify"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-[#334155] hover:text-blue-600 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>2. Thẩm định & Xác nhận</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "chat"}
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "chat"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-[#334155] hover:text-blue-600 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <ShootingStarIcon className="h-4 w-4" />
              <span>3. Hỏi đáp có trích dẫn</span>
            </button>
          </div>
        </div>

        {/* Large Crisp Product Viewport */}
        <div id="demo-viewport">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            {/* Window Chrome Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-3 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
                <span className="ml-2 text-xs font-extrabold text-[#0F172A] dark:text-white">
                  Continuum AI Studio
                </span>
                <span className="text-slate-300 dark:text-gray-600">/</span>
                <span className="text-xs text-slate-500 font-medium">
                  Dự án: Core IAM & Caching (Sprint 24)
                </span>
              </div>

              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                Bản xem trước tính năng tương tác
              </span>
            </div>

            {/* TAB 1: KNOWLEDGE REPOSITORY */}
            {activeTab === "knowledge" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
                      Danh sách tri thức đã lưu vết
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Tổng hợp từ các Work Notes và báo cáo giải quyết vấn đề kỹ thuật
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("all")}
                      className={`rounded-lg px-3 py-1 transition-colors ${
                        selectedFilter === "all"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      Tất cả ({PROJECT_KNOWLEDGE_ITEMS.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("verified")}
                      className={`rounded-lg px-3 py-1 transition-colors ${
                        selectedFilter === "verified"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      Đã xác minh
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("pending")}
                      className={`rounded-lg px-3 py-1 transition-colors ${
                        selectedFilter === "pending"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      Chờ kiểm chứng
                    </button>
                  </div>
                </div>

                {/* Grid of Knowledge Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20 dark:bg-gray-800 dark:border-blue-500"
                            : "border-slate-200 bg-[#F8FAFC] hover:border-blue-300 hover:bg-white dark:border-gray-800 dark:bg-gray-800/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              item.status === "verified"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {item.status === "verified" ? (
                              <CheckCircleIcon className="h-3 w-3 text-blue-600" />
                            ) : (
                              <TimeIcon className="h-3 w-3 text-amber-500" />
                            )}
                            {item.status === "verified" ? "Đã xác minh" : "Chờ kiểm chứng"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.code}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] line-clamp-2 dark:text-white">
                          {item.title}
                        </h4>

                        <p className="mt-1.5 text-xs text-[#334155] line-clamp-2 dark:text-gray-300">
                          {item.summary}
                        </p>

                        <div className="mt-3.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-blue-600 font-bold dark:border-gray-700">
                          <span>{item.source}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Item Detail Inspector */}
                <div className="rounded-2xl border border-blue-200 bg-white p-5 sm:p-6 shadow-xs dark:border-gray-700 dark:bg-gray-850">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-gray-700">
                    <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Chi tiết tri thức: {selectedItem.code}
                    </span>
                    <span className="text-xs text-slate-500">
                      Người thẩm định:{" "}
                      <strong className="text-[#0F172A] dark:text-white">
                        {selectedItem.reviewer}
                      </strong>
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                    {selectedItem.title}
                  </h4>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                    {selectedItem.details}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 font-semibold">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <span>Nguồn bằng chứng đối chiếu: {selectedItem.source}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REVIEW & VERIFICATION */}
            {activeTab === "verify" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
                    Khu vực thẩm định tri thức (Lead Verification Workflow)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Bằng chứng xác thực phải được xem xét kỹ lưỡng trước khi đưa vào kho tri thức chính thức
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-7 dark:border-gray-800 dark:bg-gray-850">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Đề xuất từ Work Note WN-104
                      </span>
                      <span className="text-xs text-slate-500">Tác giả: Nguyễn Văn A</span>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-extrabold border ${
                        verifyStatus === "approved"
                          ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950"
                          : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950"
                      }`}
                    >
                      {verifyStatus === "approved"
                        ? "Đã xác minh bởi Tech Lead"
                        : "Chờ phê duyệt từ Tech Lead"}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                    Kiến trúc Redis Pub/Sub & Token Revocation cho cụm IAM
                  </h4>

                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                    Chuyển session cache và blacklist tokens sang Redis Pub/Sub. Đã kiểm thử tải 100k người dùng đồng thời, latency trung bình giảm từ 840ms xuống 12.4ms.
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Bằng chứng đối chiếu đính kèm:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-blue-600 dark:bg-gray-800">
                        PR #88: feat(iam) redis-pubsub (Merged)
                      </span>
                      <span className="rounded bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-blue-600 dark:bg-gray-800">
                        Benchmark_100k_users.pdf (Latency 12.4ms)
                      </span>
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:border-gray-700">
                    <div className="text-xs text-slate-500">
                      Vai trò thẩm định:{" "}
                      <strong className="text-[#0F172A] dark:text-white">
                        Trần Thị B (Tech Lead)
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVerifyStatus("pending")}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Đặt lại
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerifyStatus("approved")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                      >
                        <CheckLineIcon className="h-3.5 w-3.5" />
                        <span>Phê duyệt tri thức</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SOURCE-BASED Q&A */}
            {activeTab === "chat" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
                    Trợ lý Continuum AI — Hỏi đáp có trích dẫn nguồn
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Nhập câu hỏi hoặc chọn các câu hỏi mẫu để xem cách AI trích xuất câu trả lời kèm nguồn dẫn đối chiếu
                  </p>
                </div>

                {/* Sample Prompt Pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Câu hỏi mẫu:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Tại sao nhóm quyết định dùng Redis Pub/Sub thay vì RabbitMQ cho cụm IAM?"
                      )
                    }
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300"
                  >
                    1. Tại sao chọn Redis Pub/Sub?
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Chính sách thời hạn Refresh Token và Fingerprinting được quy định ở đâu?"
                      )
                    }
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300"
                  >
                    2. Quy chuẩn Refresh Token
                  </button>
                </div>

                {/* Interactive Q&A Bubble */}
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 dark:border-gray-800 dark:bg-gray-850">
                  {/* User Question */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                      Lê Minh B
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#0F172A] shadow-xs border border-slate-200 dark:bg-gray-900 dark:border-gray-700 dark:text-white">
                      {chatQuery}
                    </div>
                  </div>

                  {/* AI Response with Citations */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                      <ShootingStarIcon className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl bg-white p-4 sm:p-5 text-xs sm:text-sm leading-relaxed text-[#334155] shadow-xs border border-slate-200 space-y-3 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                      <p>
                        Dựa trên kho tri thức đã được Tech Lead Trần Thị B xác nhận của dự án:
                      </p>
                      <ul className="list-disc pl-4 space-y-2 text-xs">
                        <li>
                          <strong>Lý do kỹ thuật:</strong> Cụm Redis đã được triển khai sẵn cho Session Cache. Việc tái sử dụng Redis Pub/Sub giúp đáp ứng lưu lượng 100k users với latency dưới 15ms mà không cần duy trì thêm cụm hạ tầng RabbitMQ riêng biệt{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("wn-104")}
                            className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                          >
                            [1] Work Note WN-104
                          </button>
                          .
                        </li>
                        <li>
                          <strong>Bằng chứng thực thi:</strong> Logic đã được merge trong{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("pr-88")}
                            className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                          >
                            [2] PR #88
                          </button>{" "}
                          kèm báo cáo đo tải p99 đạt 12.4ms.
                        </li>
                      </ul>

                      {/* Clickable Citation Preview Drawer/Box */}
                      {activeCitation && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs dark:border-blue-900 dark:bg-blue-950/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-blue-900 dark:text-blue-300">
                              Trích dẫn nguồn gốc ({activeCitation === "wn-104" ? "Work Note WN-104" : "PR #88"}):
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveCitation(null)}
                              className="text-[10px] font-bold text-blue-700 hover:underline"
                            >
                              Đóng
                            </button>
                          </div>
                          <p className="text-[11px] text-[#334155] dark:text-gray-300 italic">
                            {activeCitation === "wn-104"
                              ? '"Mục 2.1: Nhóm đã cân nhắc RabbitMQ nhưng quyết định chọn Redis Pub/Sub vì tối ưu chi phí vận hành hạ tầng Kubernetes và đã có sẵn Redis Cluster."'
                              : '"PR #88: Merge commit a3c9f2: Triển khai Redis Pub/Sub token revocation channel và test case kiểm thử tải đạt yêu cầu."'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
