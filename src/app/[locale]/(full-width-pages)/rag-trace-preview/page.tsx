import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TraceDeskSpecPage from "@/components/platform/diagnostics/TraceDeskSpecPage";
import PlatformCopyProvider from "@/components/platform/ui/PlatformCopyProvider";
import { buildPlatformPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildPlatformPageMetadata(params, "platformDiagnostics");
}

export default function PlatformDiagnosticsSpecRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PlatformCopyProvider>
      <TraceDeskSpecPage />
    </PlatformCopyProvider>
  );
}
