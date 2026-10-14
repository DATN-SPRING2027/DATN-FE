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
      <section className="py-20 md:py-24 border-t border-[#E4E7EC] bg-white relative overflow-hidden dark:border-gray-800 dark:bg-gray-950">
        <div
          className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#ECF3FF] blur-3xl opacity-60 dark:bg-brand-950/20"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="rounded-3xl border border-[#DDE9FF] bg-gradient-to-b from-[#ECF3FF]/60 to-white p-8 sm:p-12 md:p-16 text-center shadow-lg dark:border-gray-800 dark:from-gray-900 dark:to-gray-900/90">
            <span className="inline-block rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-[#465FFF] shadow-2xs mb-4 border border-[#DDE9FF] dark:bg-gray-800 dark:border-gray-700 dark:text-brand-300">
              Chuyển giao không gián đoạn
            </span>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#101828] max-w-2xl mx-auto dark:text-white">
              Giúp người kế nhiệm bắt đầu với đầy đủ ngữ cảnh.
            </h2>

            <p className="mt-4 text-base sm:text-lg text-[#344054] max-w-xl mx-auto leading-relaxed dark:text-gray-300">
              Khám phá cách Continuum AI lưu giữ tri thức và hỗ trợ bàn giao trong dự án của bạn.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => scrollTo("demo")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#465FFF] px-7 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[#3641F5] hover:shadow-lg active:scale-[0.98]"
              >
                <span>Khám phá bản demo</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <Link
                href="/signin"
                className="inline-flex items-center justify-center rounded-xl border border-[#E4E7EC] bg-white px-6 py-3.5 text-base font-semibold text-[#344054] shadow-xs transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Đăng nhập hệ thống
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E4E7EC] bg-[#F9FAFB] py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#E4E7EC] dark:border-gray-800">
            <div className="space-y-2">
              <Link href="/" className="inline-block">
                <BrandLogo className="h-7 w-auto" />
              </Link>
              <p className="text-xs text-[#667085] max-w-sm leading-relaxed dark:text-gray-400">
                Nền tảng duy trì tri thức liên tục và chuyển giao năng lực cho các đội ngũ phát triển phần mềm nhiều nhóm.
              </p>
            </div>

            {/* Nav links in footer */}
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[#344054] dark:text-gray-300">
              <a
                href="#giai-phap"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("giai-phap");
                }}
                className="hover:text-[#465FFF] transition-colors"
              >
                Giải pháp
              </a>
              <a
                href="#tinh-nang"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("tinh-nang");
                }}
                className="hover:text-[#465FFF] transition-colors"
              >
                Tính năng
              </a>
              <a
                href="#cach-hoat-dong"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("cach-hoat-dong");
                }}
                className="hover:text-[#465FFF] transition-colors"
              >
                Cách hoạt động
              </a>
              <a
                href="#demo"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("demo");
                }}
                className="hover:text-[#465FFF] transition-colors"
              >
                Bản demo
              </a>
              <Link href="/signin" className="hover:text-[#465FFF] transition-colors">
                Đăng nhập
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#667085] gap-3 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} Continuum AI. Mọi quyền được bảo lưu.</p>
            <p>Thiết kế tinh gọn theo ngôn ngữ TailAdmin • Outfit Font System</p>
          </div>
        </div>
      </footer>
    </>
  );
}
