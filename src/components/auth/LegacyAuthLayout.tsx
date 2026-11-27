import BrandLogo from "@/components/common/BrandLogo";
import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";

import { ThemeProvider } from "@/context/ThemeContext";
import { Link } from "@/i18n/navigation";
import { BoltIcon, ShieldCheckIcon } from "@/icons";
import React from "react";

export default function LegacyAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col  dark:bg-gray-900 sm:p-0">
          {children}
          <div className="lg:w-1/2 w-full h-full bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
            <div className="relative items-center justify-center flex flex-col z-1 px-8 py-12">
              {/* <!-- ===== Common Grid Shape Start ===== --> */}
              <GridShape />
              <div className="flex flex-col items-center max-w-sm text-center">
                <Link href="/" className="block mb-4">
                  <BrandLogo variant="inverse" className="h-12" priority />
                </Link>
                <p className="text-center text-sm font-medium text-gray-300 dark:text-white/80">
                  Enterprise Knowledge Capture &amp; Automated Verification
                </p>

                <div className="mt-8 flex flex-col gap-3 w-full text-start">
                  <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400">
                      <ShieldCheckIcon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Cryptographic Security</p>
                      <p className="text-[11px] text-gray-400">Zero-trust credential hashing &amp; token protection</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400">
                      <BoltIcon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Continuous Verification</p>
                      <p className="text-[11px] text-gray-400">Real-time auditability across team workspaces</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 end-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
