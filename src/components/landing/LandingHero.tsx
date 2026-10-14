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
    <section className="relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28">
      {/* Royal Blue & Indigo Atmospheric Glow */}
      <div
        className="pointer-events-none absolute -top-32 right-10 -z-10 h-[650px] w-[650px] rounded-full bg-blue-500/10 blur-3xl opacity-80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-8 -z-10 h-[500px] w-[500px] rounded-full bg-indigo-500/8 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Heading, Value Prop, CTAs */}
          <div className="lg:col-span-5 xl:col-span-5">
            {/* Small Badge Label in Royal Blue */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1.5 text-xs font-bold text-blue-700 mb-6 shadow-2xs">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
              <span>Hệ sinh thái tri thức sống cho đội ngũ phần mềm</span>
            </div>

            {/* Main Headline with Native Vietnamese Glyphs */}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl lg:leading-[1.15] dark:text-white">
              Đừng để tri thức dự án rời đi cùng một thành viên.
            </h1>

            {/* Description */}
            <p className="mt-5 text-base leading-relaxed text-[#334155] sm:text-lg dark:text-gray-300">
              Continuum AI giúp nhóm của bạn lưu giữ và phát triển kinh nghiệm làm việc tự nhiên như một hệ sinh thái—từ hạt mầm ghi nhận ban đầu đến mạng rễ tri thức có kiểm chứng vững chắc cho người kế nhiệm.
            </p>

            {/* CTA Buttons in Royal Blue / Indigo */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => scrollTo("demo")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                <span>Khám phá bản demo</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("cach-hoat-dong")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-[#1E293B] shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span>Tìm hiểu cách hoạt động</span>
              </button>
            </div>

            {/* Micro Trust Indicators with Blue Checkmarks */}
            <div className="mt-7 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs font-semibold text-slate-600 dark:border-gray-800 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-blue-600" />
                1 Hạt tâm • 5 Nhánh sinh trưởng
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-blue-600" />
                100% Con người thẩm định
              </span>
            </div>
          </div>

          {/* Right Column: 3D Active AI Knowledge Ecosystem Graph */}
          <div className="lg:col-span-7 xl:col-span-7">
            <KnowledgeEcosystemGraph className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
