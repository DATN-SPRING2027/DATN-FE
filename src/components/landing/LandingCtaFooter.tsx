"use client";

import React from "react";
import BrandLogo from "@/components/common/BrandLogo";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/icons";

export default function LandingCtaFooter() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* CTA Bottom Section */}
      <section className="py-20 md:py-24 border-t border-slate-200/80 bg-white relative overflow-hidden dark:border-gray-800 dark:bg-gray-950">
        <div
          className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl opacity-75 dark:bg-blue-950/20"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-8 sm:p-12 md:p-16 text-center shadow-xl dark:border-gray-800 dark:from-gray-900 dark:to-gray-900/90">
            <span className="inline-block rounded-full bg-white px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-4 border border-blue-200 dark:bg-gray-800 dark:border-gray-700 dark:text-blue-300">
              Chuyển giao không gián đoạn
            </span>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0F172A] max-w-2xl mx-auto dark:text-white">
              Giúp người kế nhiệm bắt đầu với đầy đủ ngữ cảnh.
            </h2>

            <p className="mt-4 text-base sm:text-lg text-[#334155] max-w-xl mx-auto leading-relaxed dark:text-gray-300">
              Khám phá cách Continuum AI lưu giữ tri thức và hỗ trợ bàn giao trong dự án của bạn.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => scrollTo("demo")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                <span>Khám phá bản demo</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <Link
                href="/signin"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-[#1E293B] shadow-xs transition-all hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Đăng nhập hệ thống
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-[#F8FAFC] py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-200 dark:border-gray-800">
            <div className="space-y-2">
              <Link href="/" className="inline-block">
                <BrandLogo className="h-7 w-auto" />
              </Link>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed dark:text-gray-400">
                Nền tảng duy trì tri thức liên tục và chuyển giao năng lực cho các đội ngũ phát triển phần mềm nhiều nhóm.
              </p>
            </div>

            {/* Nav links in footer */}
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[#334155] dark:text-gray-300">
              <a
                href="#giai-phap"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("giai-phap");
                }}
                className="hover:text-blue-600 transition-colors"
              >
                Giải pháp
              </a>
              <a
                href="#tinh-nang"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("tinh-nang");
                }}
                className="hover:text-blue-600 transition-colors"
              >
                Tính năng
              </a>
              <a
                href="#cach-hoat-dong"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("cach-hoat-dong");
                }}
                className="hover:text-blue-600 transition-colors"
              >
                Cách hoạt động
              </a>
              <a
                href="#demo"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("demo");
                }}
                className="hover:text-blue-600 transition-colors"
              >
                Bản demo
              </a>
              <Link href="/signin" className="hover:text-blue-600 transition-colors">
                Đăng nhập
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} Continuum AI. Mọi quyền được bảo lưu.</p>
            <p>Hệ sinh thái tri thức sống • Chuẩn Be Vietnam Pro</p>
          </div>
        </div>
      </footer>
    </>
  );
}
