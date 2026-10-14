"use client";

import React from "react";
import {
  CheckCircleIcon,
  DocsIcon,
  FileIcon,
  ShootingStarIcon,
  TaskIcon,
} from "@/icons";

export default function LandingFeatures() {
  return (
    <section
      id="tinh-nang"
      className="py-14 md:py-20 bg-[#F8FAFC] dark:bg-gray-950"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
            <span>Năng lực cốt lõi</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl dark:text-white leading-tight">
            Không chỉ lưu trữ tri thức.{" "}
            <span className="text-blue-600 dark:text-blue-400">
              Giữ trọn ngữ cảnh phía sau.
            </span>
          </h2>

          <p className="mt-2.5 text-sm sm:text-base text-[#334155] leading-relaxed dark:text-gray-300">
            5 trụ cột bảo toàn lý do kỹ thuật, bằng chứng thực thi và chuyển giao năng lực dự án.
          </p>
        </div>

        {/* Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 lg:gap-5">
          {/* Bento Card 1: Dominant Heroic Card (8 cols) - Work Notes & Evidence */}
          <div className="md:col-span-12 lg:col-span-8 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600 dark:bg-blue-950 dark:border-blue-900">
                  <DocsIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                  Ghi nhận tức thì
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white">
                Ghi nhận tri thức ngay khi công việc diễn ra
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-[#334155] leading-relaxed dark:text-gray-300">
                Lưu quyết định kiến trúc và bằng chứng trực tiếp trong công việc, không chờ đến ngày bàn giao.
              </p>

              {/* Realistic Work Note Preview */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-xs dark:border-gray-800 dark:bg-gray-850">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 pb-2.5 mb-2.5 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-blue-600 text-white px-1.5 py-0.5 text-[10px] font-black">
                      WN-104
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-white">
                      Kiến trúc Redis Pub/Sub & Token Revocation
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Sprint 24 • Đã lưu vết
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#334155] dark:text-gray-300">
                  <div>
                    <strong className="text-blue-700 dark:text-blue-400">Quyết định: </strong>
                    Chuyển session cache sang Redis Pub/Sub phân tán.
                  </div>
                  <div>
                    <strong className="text-blue-700 dark:text-blue-400">Lý do: </strong>
                    Chịu tải 100k users đồng thời, latency dưới 15ms.
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <strong className="text-blue-700 dark:text-blue-400">Bằng chứng: </strong>
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-mono text-[10px] text-blue-600 dark:bg-gray-800 dark:border-gray-700">
                      <FileIcon className="h-3 w-3" /> PR #88 (Merged)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-slate-200 font-mono text-[10px] text-blue-600 dark:bg-gray-800 dark:border-gray-700">
                      <FileIcon className="h-3 w-3" /> Benchmark_100k.pdf
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 dark:border-gray-800">
              <span>Được tích hợp trực tiếp vào kho tri thức dự án</span>
              <span aria-hidden="true">&rarr;</span>
            </div>
          </div>

          {/* Bento Card 2: Vertical Focus (4 cols) - Human Verification */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-blue-200/90 bg-gradient-to-b from-white to-blue-50/30 p-5 sm:p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:from-gray-900 dark:to-blue-950/20">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-900">
                  <CheckCircleIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-300">
                  Human-in-the-loop
                </span>
              </div>

              <h3 className="text-lg font-extrabold text-[#0F172A] dark:text-white">
                AI đề xuất. Con người xác minh.
              </h3>
              <p className="mt-1.5 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                AI phát hiện và đề xuất. Tech Lead trực tiếp rà soát và phê duyệt.
              </p>

              {/* Verification Stamp Visual */}
              <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Trạng thái thẩm định
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                    Đã kiểm chứng
                  </span>
                </div>
                <div className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Thẩm định: Work Note WN-104
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Người duyệt: <strong>Trần Thị B (Tech Lead)</strong>
                </p>
                <div className="mt-2 text-[10px] text-blue-700 bg-blue-50/70 p-2 rounded-lg dark:bg-blue-950/40 dark:text-blue-300">
                  &quot;Đã đối chiếu với hạ tầng Kubernetes và chấp thuận làm chuẩn dự án.&quot;
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs font-bold text-blue-700 dark:border-gray-800 dark:text-blue-400">
              Ngăn ngừa tri thức giả và thông tin chưa kiểm duyệt
            </div>
          </div>

          {/* Bento Card 3: Source-Based Retrieval (4 cols) */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950">
                  <ShootingStarIcon className="h-4.5 w-4.5" />
                </div>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">
                  Trích dẫn minh bạch
                </span>
              </div>

              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Câu trả lời có thể kiểm chứng nguồn
              </h3>
              <p className="mt-1 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                Mọi phản hồi đều trỏ trực tiếp tới đặc tả và PR đã duyệt.
              </p>

              <div className="mt-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-2.5 text-xs dark:border-gray-800 dark:bg-gray-800/80">
                <div className="font-bold text-[#0F172A] dark:text-white mb-0.5 text-[11px]">
                  Q: Refresh Token expire sau bao lâu?
                </div>
                <div className="text-[11px] text-[#334155] dark:text-gray-300">
                  A: TTL 7 ngày trong HttpOnly Cookie <span className="font-bold text-blue-600">[Spec v1.4]</span>.
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] font-bold text-blue-600 dark:border-gray-800">
              Minh bạch tuyệt đối nguồn tham chiếu
            </div>
          </div>

          {/* Bento Card 4: Seamless Handover (4 cols) */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950">
                  <TaskIcon className="h-4.5 w-4.5" />
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                  Không gián đoạn
                </span>
              </div>

              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Bàn giao không mất ngữ cảnh
              </h3>
              <p className="mt-1 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                Người mới kế thừa quyết định cốt lõi và vấn đề đang mở.
              </p>

              <div className="mt-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-2.5 text-xs space-y-1 dark:border-gray-800 dark:bg-gray-800/80">
                <div className="flex items-center gap-1.5 text-[10px] text-[#334155] dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>5 Quyết định kiến trúc đã thẩm định</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#334155] dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>1 Việc mở: Tích hợp SAML SSO Sprint 25</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] font-bold text-blue-600 dark:border-gray-800">
              Tiếp nối nhiệm vụ trơn tru ngay ngày đầu
            </div>
          </div>

          {/* Bento Card 5: Connected Knowledge Diagram (4 cols) */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                  <CheckCircleIcon className="h-4.5 w-4.5" />
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                  Mạng lưới tri thức
                </span>
              </div>

              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Tri thức không còn là những mảnh rời rạc
              </h3>
              <p className="mt-1 text-xs text-[#334155] leading-relaxed dark:text-gray-300">
                Mọi mẩu kinh nghiệm đều liên kết với mã nguồn và người thẩm định.
              </p>

              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold text-slate-700 dark:text-gray-300">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 border border-blue-200">
                  Work Note
                </span>
                <span>&rarr;</span>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-200">
                  PR #88
                </span>
                <span>&rarr;</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 border border-blue-200">
                  Lead Verify
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] font-bold text-blue-600 dark:border-gray-800">
              Bức tranh kỹ thuật luôn sống động và liên tục
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
