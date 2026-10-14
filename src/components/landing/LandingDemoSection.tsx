"use client";

import React, { useState } from "react";
import { SectionHeading } from "./HeadingEmphasis";
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
  title: string;
  category: string;
  status: "verified" | "pending";
  date: string;
  summary: string;
  source: string;
  reviewer: string;
}

const INITIAL_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "k-1",
    title: "Quyết định chọn Redis Cache cho User Session và Pub/Sub",
    category: "Kiến trúc hệ thống",
    status: "verified",
    date: "14/10/2026",
    summary:
      "Giảm tải cho cơ sở dữ liệu chính khi lượng người dùng đồng thời tăng đột biến. Bổ sung TTL 7 ngày cho refresh tokens.",
    source: "PR #89 • Kiến trúc hệ thống v3",
    reviewer: "Tech Lead Nguyễn Văn A",
  },
  {
    id: "k-2",
    title: "Cách xử lý Timeout khi gọi SAG Inference Engine",
    category: "AI Service",
    status: "verified",
    date: "12/10/2026",
    summary:
      "Điều chỉnh client timeout lên 45s và bật stream SSE để tránh ngắt kết nối socket khi model sinh response dài.",
    source: "Commit #a3c9f2 • Báo cáo sự cố Incident-04",
    reviewer: "Backend Lead Trần Thị B",
  },
  {
    id: "k-3",
    title: "Quy chuẩn mã hoá dữ liệu định danh khách hàng (PII)",
    category: "Bảo mật",
    status: "pending",
    date: "11/10/2026",
    summary:
      "Đề xuất áp dụng mã hoá AES-256-GCM ở tầng Application trước khi lưu vào MongoDB collection Users.",
    source: "PR #108 • Báo cáo bảo mật",
    reviewer: "Chờ thẩm định bởi Security Lead",
  },
];

export default function LandingDemoSection() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "verify" | "chat">("knowledge");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "verified" | "pending">("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem>(INITIAL_KNOWLEDGE_ITEMS[0]);
  const [verifyStatus, setVerifyStatus] = useState<"pending" | "approved">("pending");
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState<string>(
    "Chính sách gia hạn Refresh Token và xử lý timeout SSE được quy định ở đâu?"
  );

  const filteredItems = INITIAL_KNOWLEDGE_ITEMS.filter((item) => {
    if (selectedFilter === "verified") return item.status === "verified";
    if (selectedFilter === "pending") return item.status === "pending";
    return true;
  });

  return (
    <section
      id="demo"
      className="py-20 md:py-28 bg-[#F0F7FF]/60 border-t border-blue-100 dark:bg-gray-900/80 dark:border-gray-800"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Heading with Gradient Emphasis */}
        <SectionHeading
          badge="Xem trước Trải nghiệm Thực tế"
          regularText="Đừng chỉ đọc về Continuum AI."
          emphasizedText="Hãy trải nghiệm cách tri thức được tiếp nối."
          emphasisVariant="gradient"
          description="Giao diện mô phỏng tương tác trực quan cho toàn bộ vòng đời tri thức: từ lưu trữ, thẩm định đến hỏi đáp trích dẫn nguồn."
          align="center"
        />

        {/* Interactive Mode Switcher Tabs */}
        <div className="mt-10 flex justify-center">
          <div
            role="tablist"
            className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "knowledge"}
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "knowledge"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
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
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
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
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "text-[#334155] hover:text-blue-600 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <ShootingStarIcon className="h-4 w-4" />
              <span>3. Hỏi đáp có trích dẫn</span>
            </button>
          </div>
        </div>

        {/* Demo Browser Viewport */}
        <div id="demo-viewport" className="mt-8">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            {/* Browser Window Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
                <span className="ml-2 text-xs font-bold text-[#0F172A] dark:text-white">
                  Continuum AI Studio
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-1 text-xs text-slate-500 border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span>Dự án: Enterprise Knowledge Base • Sprint 24</span>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                Mô phỏng tương tác
              </span>
            </div>

            {/* TAB 1: KNOWLEDGE REPOSITORY */}
            {activeTab === "knowledge" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
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
                      className={`rounded-lg px-2.5 py-1 transition-colors ${
                        selectedFilter === "all"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      Tất cả ({INITIAL_KNOWLEDGE_ITEMS.length})
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItem.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-500/20 dark:bg-gray-800 dark:border-blue-500"
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
                            {item.date}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[#0F172A] line-clamp-2 dark:text-white">
                          {item.title}
                        </h4>

                        <p className="mt-1.5 text-[11px] text-[#334155] line-clamp-2 dark:text-gray-300">
                          {item.summary}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-blue-600 font-bold dark:border-gray-700">
                          <span>{item.source}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Item Detail Inspector */}
                <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 dark:border-gray-700">
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Chi tiết tri thức: {selectedItem.id.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      Người thẩm định:{" "}
                      <strong className="text-[#0F172A] dark:text-white">
                        {selectedItem.reviewer}
                      </strong>
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                    {selectedItem.title}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#334155] dark:text-gray-300">
                    {selectedItem.summary}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 font-semibold">
                    <FileIcon className="h-4 w-4" />
                    <span>Nguồn bằng chứng đối chiếu: {selectedItem.source}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REVIEW & VERIFICATION */}
            {activeTab === "verify" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                    Khu vực thẩm định tri thức (Lead Verification Workflow)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Bằng chứng xác thực phải được xem xét kỹ lưỡng trước khi đưa vào kho tri thức chính thức
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Đề xuất bởi AI Engine
                      </span>
                      <span className="text-xs text-slate-500">Mã đề xuất: #CAND-204</span>
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
                    Quy chuẩn cấu hình Retry Policy với Exponential Backoff khi gọi SAG Engine
                  </h4>

                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-gray-300">
                    Để giải quyết hiện tượng nghẽn mạng do gọi lại liên tục khi tải cao, các service bắt buộc cấu hình retry tối đa 3 lần với hệ số giãn nở cấp số nhân và bổ sung Jitter ngẫu nhiên.
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bằng chứng đối chiếu (Evidence attached):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-blue-600 dark:bg-gray-800">
                        Git Commit #c891f2: Add Jitter to Retry
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-blue-600 dark:bg-gray-800">
                        Benchmark Report: LoadTest_100k_users.pdf
                      </span>
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:border-gray-700">
                    <div className="text-xs text-slate-500">
                      Người chịu trách nhiệm:{" "}
                      <strong className="text-[#0F172A] dark:text-white">
                        Tech Lead (Bạn đang ở chế độ xem thử)
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
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                    Trợ lý Continuum AI — Hỏi đáp có trích dẫn nguồn
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Nhập câu hỏi hoặc chọn các câu hỏi mẫu để xem cách AI trích xuất câu trả lời kèm nguồn dẫn đối chiếu
                  </p>
                </div>

                {/* Sample Prompt Pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Câu hỏi gợi ý:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Chính sách gia hạn Refresh Token và xử lý timeout SSE được quy định ở đâu?"
                      )
                    }
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300"
                  >
                    1. Refresh Token & SSE timeout
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChatQuery(
                        "Giải pháp tối ưu chỉ mục MongoDB Index đã được thực hiện trong PR nào?"
                      )
                    }
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 font-semibold hover:bg-blue-100 transition-colors border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300"
                  >
                    2. Tối ưu MongoDB Index
                  </button>
                </div>

                {/* Interactive Q&A Bubble */}
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 dark:border-gray-800 dark:bg-gray-800/80">
                  {/* User Question */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                      Bạn
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
                    <div className="rounded-2xl bg-white p-4 text-xs sm:text-sm leading-relaxed text-[#334155] shadow-xs border border-slate-200 space-y-3 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                      <p>
                        Dựa trên kho tri thức đã được Tech Lead xác minh của dự án:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-xs">
                        <li>
                          <strong>Refresh Token:</strong> Được lưu trữ an toàn trong HttpOnly Cookie với thời hạn TTL là 7 ngày{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("auth-spec")}
                            className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                          >
                            [1] Auth Spec v1.4
                          </button>
                          .
                        </li>
                        <li>
                          <strong>SSE Timeout:</strong> Client timeout được nâng lên 45s và hỗ trợ reconnect tự động{" "}
                          <button
                            type="button"
                            onClick={() => setActiveCitation("incident-04")}
                            className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                          >
                            [2] Báo cáo Incident-04
                          </button>
                          .
                        </li>
                      </ul>

                      {/* Clickable Citation Preview Drawer/Box */}
                      {activeCitation && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-blue-900 dark:text-blue-300">
                              Trích dẫn gốc ({activeCitation === "auth-spec" ? "Auth Spec v1.4" : "Báo cáo Incident-04"}):
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
                            {activeCitation === "auth-spec"
                              ? '"Mục 4.2: Refresh token phải luôn đặt Flag HttpOnly, SameSite=Lax và có TTL tối đa 7 ngày để giảm thiểu tấn công XSS."'
                              : '"Mục 2.1: Khi SAG Inference Engine trả về chunk dài, socket HTTP thường bị drop ở giây thứ 30. Cần nâng timeout lên 45s và bật SSE keep-alive."'}
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
