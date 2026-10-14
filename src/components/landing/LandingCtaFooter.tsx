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
      {/* Premium Dark Navy CTA Section */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] relative overflow-hidden dark:bg-gray-950">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="relative rounded-3xl border border-blue-500/20 bg-gradient-to-br from-[#0B1120] via-[#10172D] to-[#1E1B4B] p-8 sm:p-14 md:p-20 text-center shadow-2xl overflow-hidden">
            {/* Ambient Lighting Gradients */}
            <div
              className="pointer-events-none absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full bg-blue-600/20 blur-3xl opacity-75"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-indigo-600/20 blur-3xl opacity-75"
              aria-hidden="true"
            />

            {/* Subtle Grid overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(#60A5FA 1px, transparent 1px), radial-gradient(#60A5FA 1px, #0B1120 1px)",
                backgroundSize: "28px 28px",
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-300 border border-blue-400/20 mb-5 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Bảo toàn giá trị tri thức doanh nghiệp</span>
              </span>

              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Tri thức hôm nay.{" "}
                <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
                  Sức mạnh cho người kế nhiệm ngày mai.
                </span>
              </h2>

              <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
                Khám phá cách Continuum AI giúp đội ngũ ghi nhận, kiểm chứng và tiếp nối tri thức qua từng dự án.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => scrollTo("demo")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98]"
                >
                  <span>Trải nghiệm bản demo</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <Link
                  href="/signin"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-7 py-4 text-base font-bold text-white transition-all hover:bg-slate-700 hover:border-slate-600 active:scale-[0.98]"
                >
                  Đăng nhập hệ thống
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Professional Footer */}
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

            {/* Navigation links in footer */}
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
            <p className="flex items-center gap-1.5 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <span>Nhân sự có thể rời dự án. Tri thức phải ở lại.</span>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
