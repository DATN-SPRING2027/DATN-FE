import AiChatWorkspace from "@/components/ai-chat/AiChatWorkspace";
import { setRequestLocale } from "next-intl/server";

import type { Metadata } from "next";
import { buildAiChatPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAiChatPageMetadata(params, "aiChat");
}

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiChatWorkspace />;
}
