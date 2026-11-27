import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PlatformConsoleRoute from "@/components/platform/PlatformConsoleRoute";
import { buildPlatformPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildPlatformPageMetadata(params, "platformOverview", { descriptionKey: "platformDescription" });
}

export default async function PlatformConsolePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlatformConsoleRoute />;
}
