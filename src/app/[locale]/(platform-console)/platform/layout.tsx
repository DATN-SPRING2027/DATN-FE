import PlatformConsole from "@/components/platform/PlatformConsole";
import type { Metadata } from "next";
import { platformFont } from "@/components/platform/ui/platformFont";
import PlatformCopyProvider from "@/components/platform/ui/PlatformCopyProvider";

export const metadata: Metadata = {
  title: "Platform Console | Continuum AI",
  description:
    "Review the Platform administration, security, operations and audit capabilities available to your account.",
};

export default function PlatformConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={platformFont.variable}>
      <PlatformCopyProvider>
        <PlatformConsole />
        {children}
      </PlatformCopyProvider>
    </div>
  );
}
