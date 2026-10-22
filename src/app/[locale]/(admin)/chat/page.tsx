import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { setRequestLocale } from "next-intl/server";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChatWorkspace />;
}
