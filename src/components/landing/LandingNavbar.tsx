"use client";

import React, { useState } from "react";
import BrandLogo from "@/components/common/BrandLogo";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/icons";

export default function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all dark:border-gray-800 dark:bg-gray-900/90">
      <div className="mx-auto flex h-18 max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
          <BrandLogo className="h-8 w-auto" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#giai-phap"
            onClick={(e) => scrollToSection(e, "giai-phap")}
            className="text-sm font-semibold text-[#334155] transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            Giải pháp
          </a>
          <a
            href="#tinh-nang"
            onClick={(e) => scrollToSection(e, "tinh-nang")}
            className="text-sm font-semibold text-[#334155] transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            Tính năng
          </a>
          <a
            href="#cach-hoat-dong"
            onClick={(e) => scrollToSection(e, "cach-hoat-dong")}
            className="text-sm font-semibold text-[#334155] transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            Cách hoạt động
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/signin"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#334155] transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            Đăng nhập
          </Link>
          <a
            href="#demo"
            onClick={(e) => scrollToSection(e, "demo")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
          >
            <span>Khám phá bản demo</span>
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-[#334155] hover:bg-slate-100 md:hidden dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <span className="sr-only">Mở menu điều hướng</span>
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 pt-3 pb-6 md:hidden dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col space-y-3">
            <a
              href="#giai-phap"
              onClick={(e) => scrollToSection(e, "giai-phap")}
              className="rounded-md px-3 py-2 text-base font-semibold text-[#334155] hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Giải pháp
            </a>
            <a
              href="#tinh-nang"
              onClick={(e) => scrollToSection(e, "tinh-nang")}
              className="rounded-md px-3 py-2 text-base font-semibold text-[#334155] hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Tính năng
            </a>
            <a
              href="#cach-hoat-dong"
              onClick={(e) => scrollToSection(e, "cach-hoat-dong")}
              className="rounded-md px-3 py-2 text-base font-semibold text-[#334155] hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cách hoạt động
            </a>
            <div className="pt-2 border-t border-slate-200 dark:border-gray-800 flex flex-col gap-2.5">
              <Link
                href="/signin"
                className="w-full text-center rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-[#334155] hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300"
              >
                Đăng nhập
              </Link>
              <a
                href="#demo"
                onClick={(e) => scrollToSection(e, "demo")}
                className="w-full text-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"
              >
                Khám phá bản demo
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
