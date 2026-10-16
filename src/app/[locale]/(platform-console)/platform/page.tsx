import PlatformConsole from "@/components/platform/PlatformConsole";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Console | Continuum AI",
  description: "Manage permitted platform Organization and Membership operations.",
};

export default function PlatformConsolePage() {
  return <PlatformConsole />;
}
