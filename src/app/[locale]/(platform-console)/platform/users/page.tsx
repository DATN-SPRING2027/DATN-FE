import type { Metadata } from "next";
import PlatformConsoleRoute from "@/components/platform/PlatformConsoleRoute";
import { buildPlatformPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildPlatformPageMetadata(params, "platformUsers");
}

export default function UsersPage() {
  return <PlatformConsoleRoute />;
}
