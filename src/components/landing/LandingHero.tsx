"use client";

import React from "react";
import KnowledgeEcosystemGraph from "./KnowledgeEcosystemGraph";
import { ArrowRightIcon, CheckCircleIcon } from "@/icons";

export default function LandingHero() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden pt-6 pb-14 md:pt-10 md:pb-20">
      {/* Royal Blue & Indigo Atmospheric Ambient Lighting */}
      <div
        className="pointer-events-none absolute -top-32 right-10 -z-10 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl opacity-80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-8 -z-10 h-[400px] w-[400px] rounded-full bg-indigo-500/8 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline, Value Proposition, Action CTAs */}
          <div className="lg:col-span-5 xl:col-span-5">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 mb-4 shadow-2xs dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
              <span>Tiếp nối tri thức & năng lực dự án</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12] dark:text-white">
              Nhân sự có thể rời dự án.{" "}
              <span className="block mt-1 sm:mt-1.5 text-blue-600 dark:text-blue-400">
                Tri thức phải ở lại.
              </span>
            </h1>

            {/* Concise Description (Cut down text!) */}
            <p className="mt-3.5 text-base text-[#334155] leading-relaxed dark:text-gray-300">
              Lưu vết quyết định kỹ thuật, liên kết bằng chứng và bàn giao trọn vẹn cho người kế nhiệm.
            </p>

            {/* CTAs on Single Row */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => scrollTo("demo")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5.5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] whitespace-nowrap"
              >
                <span>Trải nghiệm bản demo</span>
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("cach-hoat-dong")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5.5 py-3 text-sm font-semibold text-[#1E293B] shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 whitespace-nowrap"
              >
                <span>Khám phá cách hoạt động</span>
              </button>
            </div>

            {/* Concise Trust Badges */}
            <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-slate-600 dark:border-gray-800 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                Ghi nhận trong quá trình làm việc
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                Tri thức có nguồn và kiểm chứng
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                Con người giữ quyền xác nhận
              </span>
            </div>
          </div>

          {/* Right Column: Hero Knowledge Trace Experience */}
          <div className="lg:col-span-7 xl:col-span-7">
            <KnowledgeEcosystemGraph className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
