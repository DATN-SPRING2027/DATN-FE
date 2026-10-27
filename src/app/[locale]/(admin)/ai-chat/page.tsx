import AiChatWorkspace from "@/components/ai-chat/AiChatWorkspace";
import { setRequestLocale } from "next-intl/server";

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiChatWorkspace />;
}
