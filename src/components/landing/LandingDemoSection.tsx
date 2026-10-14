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
    title: "Kiến trúc Redis Pub/Sub cho Session Cache",
    category: "Caching",
    status: "verified",
    date: "14/10/2026",
    summary: "Đồng bộ session và token blacklist sang cụm Redis Pub/Sub, đáp ứng 100k users đồng thời.",
    source: "PR #88 • Benchmark_100k.pdf",
    reviewer: "Trần Thị B (Tech Lead)",
    details: "Tối ưu cụm Redis 3-node, failover tự động trong 3s. Latency p99 đạt 12.4ms ở tải 100k rps.",
  },
  {
    id: "k-2",
    code: "WN-105",
    title: "Cơ chế xoay vòng Refresh Token an toàn",
    category: "Bảo mật",
    status: "verified",
    date: "12/10/2026",
    summary: "Lưu token trong HttpOnly Cookie TTL 7 ngày, tự động thu hồi khi phát hiện truy cập bất thường.",
    source: "Auth Spec v1.4",
    reviewer: "Trần Thị B (Tech Lead)",
    details: "Bổ sung Fingerprinting chống token reuse. Thu hồi toàn bộ token tree khi phát hiện xâm phạm.",
  },
  {
    id: "k-3",
    code: "WN-106",
    title: "Đặc tả tích hợp Azure AD SAML 2.0",
    category: "SSO",
    status: "pending",
    date: "11/10/2026",
    summary: "Phương án mapping Azure AD claims sang role RBAC nội bộ của Continuum AI.",
    source: "Draft Spec v0.2",
    reviewer: "Chờ thẩm định",
    details: "Đang chờ Tech Lead duyệt sơ đồ IDP-initiated SAML flow trước khi code trong Sprint 25.",
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
      className="py-16 md:py-24 bg-[#F0F7FF]/50 border-t border-blue-100 dark:bg-gray-900/80 dark:border-gray-800"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3 border border-blue-200 dark:bg-gray-800 dark:border-gray-700 dark:text-blue-300">
            <span>Trải nghiệm Sản phẩm Thực tế</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Khám phá cách tri thức được tiếp nối
          </h2>

          <p className="mt-2 text-sm sm:text-base text-[#334155] leading-relaxed dark:text-gray-300">
            Trải nghiệm tra cứu, thẩm định và đối chiếu bằng chứng trong dự án Core IAM & Caching.
          </p>
        </div>

        {/* Interactive Mode Switcher Tabs */}
        <div className="flex justify-start sm:justify-center mb-5">
          <div
            role="tablist"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl bg-white p-1 shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "knowledge"}
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "knowledge"
                  ? "bg-blue-600 text-white shadow-sm"
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
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "verify"
                  ? "bg-blue-600 text-white shadow-sm"
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
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "chat"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[#334155] hover:text-blue-600 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <ShootingStarIcon className="h-4 w-4" />
              <span>3. Hỏi đáp có trích dẫn</span>
            </button>
          </div>
        </div>

        {/* Crisp Product Viewport */}
        <div id="demo-viewport">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            {/* Window Chrome Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 mb-5 gap-2 text-xs dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
                <span className="ml-1.5 font-bold text-[#0F172A] dark:text-white">
                  Continuum AI Studio
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500 font-medium text-[11px]">
                  Core IAM & Caching (Sprint 24)
                </span>
              </div>

              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                Bản xem trước tính năng tương tác
              </span>
            </div>

            {/* TAB 1: KNOWLEDGE REPOSITORY */}
            {activeTab === "knowledge" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <h3 className="font-bold text-[#0F172A] dark:text-white text-sm sm:text-base">
                      Danh sách tri thức đã lưu vết
                    </h3>
                    <p className="text-slate-500 text-[11px]">
                      Tổng hợp từ Work Notes và báo cáo kỹ thuật đã đối chiếu
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("all")}
                      className={`rounded-lg px-2.5 py-1 transition-colors ${
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
                      className={`rounded-lg px-2.5 py-1 transition-colors ${
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
                      className={`rounded-lg px-2.5 py-1 transition-colors ${
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20 dark:bg-gray-800 dark:border-blue-500"
                            : "border-slate-200 bg-[#F8FAFC] hover:border-blue-300 hover:bg-white dark:border-gray-800 dark:bg-gray-800/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
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
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.code}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[#0F172A] line-clamp-1 dark:text-white">
                          {item.title}
                        </h4>

                        <p className="mt-1 text-[11px] text-[#334155] line-clamp-2 dark:text-gray-300">
                          {item.summary}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-blue-600 font-bold dark:border-gray-700">
                          <span>{item.source}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Item Detail Inspector */}
                <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-2xs dark:border-gray-700 dark:bg-gray-850">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2 mb-2 text-xs dark:border-gray-700">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {selectedItem.code}: {selectedItem.title}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Người duyệt: <strong className="text-[#0F172A] dark:text-white">{selectedItem.reviewer}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                    {selectedItem.details}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-400 font-semibold">
                    <FileIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>Nguồn bằng chứng: {selectedItem.source}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REVIEW & VERIFICATION */}
            {activeTab === "verify" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm sm:text-base">
                    Khu vực thẩm định tri thức (Lead Verification Workflow)
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Bằng chứng được đối chiếu kỹ trước khi đưa vào kho tri thức chính thức
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-850">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Work Note WN-104
                      </span>
                      <span className="text-xs text-slate-500">Tác giả: Nguyễn Văn A</span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold border ${
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

                  <h4 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                    Kiến trúc Redis Pub/Sub & Token Revocation cho cụm IAM
                  </h4>

                  <p className="mt-1 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                    Chuyển session cache sang Redis Pub/Sub. Đã kiểm thử tải 100k users, latency p99 đạt 12.4ms.
                  </p>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">
                      Bằng chứng đối chiếu:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-blue-600 dark:bg-gray-800">
                        PR #88: feat(iam) redis-pubsub (Merged)
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-blue-600 dark:bg-gray-800">
                        Benchmark_100k_users.pdf (Latency 12.4ms)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 dark:border-gray-700">
                    <div className="text-xs text-slate-500">
                      Vai trò thẩm định: <strong className="text-[#0F172A] dark:text-white">Trần Thị B (Tech Lead)</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVerifyStatus("pending")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Đặt lại
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerifyStatus("approved")}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
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
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm sm:text-base">
                    Trợ lý Continuum AI — Hỏi đáp có trích dẫn nguồn
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Trích xuất câu trả lời chuẩn xác kèm tài liệu gốc đối chiếu
                  </p>
                </div>

                {/* Sample Prompt Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px]">Câu hỏi mẫu:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Tại sao nhóm quyết định dùng Redis Pub/Sub thay vì RabbitMQ cho cụm IAM?"
                      )
                    }
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300 text-[11px]"
                  >
                    1. Tại sao chọn Redis Pub/Sub?
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Chính sách thời hạn Refresh Token được quy định ở đâu?"
                      )
                    }
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300 text-[11px]"
                  >
                    2. Quy chuẩn Refresh Token
                  </button>
                </div>

                {/* Interactive Q&A Bubble */}
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 dark:border-gray-800 dark:bg-gray-850">
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                      Lê B
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] shadow-2xs border border-slate-200 dark:bg-gray-900 dark:border-gray-700 dark:text-white">
                      {chatQuery}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
                      <ShootingStarIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-xl bg-white p-3.5 text-xs leading-relaxed text-[#334155] shadow-2xs border border-slate-200 space-y-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                      <p>
                        Dựa trên kho tri thức đã được Tech Lead Trần Thị B xác nhận:
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
                        <li>
                          <strong>Lý do kỹ thuật: </strong>
                          Cụm Redis đã có sẵn cho Session Cache. Việc dùng Redis Pub/Sub giúp đáp ứng tải 100k users với latency dưới 15ms mà không cần dựng thêm cụm RabbitMQ{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("wn-104")}
                            className="inline-flex items-center rounded bg-blue-50 px-1 py-0.2 text-[10px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100"
                          >
                            [1] Work Note WN-104
                          </button>
                          .
                        </li>
                        <li>
                          <strong>Bằng chứng thực thi: </strong>
                          Đã merge trong{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("pr-88")}
                            className="inline-flex items-center rounded bg-blue-50 px-1 py-0.2 text-[10px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100"
                          >
                            [2] PR #88
                          </button>{" "}
                          với latency p99 đạt 12.4ms.
                        </li>
                      </ul>

                      {/* Citation Excerpt Drawer */}
                      {activeCitation && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-xs dark:border-blue-900 dark:bg-blue-950/40">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-blue-900 dark:text-blue-300 text-[11px]">
                              Trích dẫn ({activeCitation === "wn-104" ? "Work Note WN-104" : "PR #88"}):
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
                              ? '"Mục 2.1: Quyết định chọn Redis Pub/Sub vì tối ưu chi phí vận hành Kubernetes và tái sử dụng cụm Redis sẵn có."'
                              : '"PR #88: Triển khai Redis Pub/Sub token revocation channel, test case đạt yêu cầu tải."'}
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
