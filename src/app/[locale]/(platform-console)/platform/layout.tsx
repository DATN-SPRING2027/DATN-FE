import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Console | Continuum AI",
  description: "Review the Platform administration, security, operations and audit capabilities available to your account.",
};

export default function PlatformConsoleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
