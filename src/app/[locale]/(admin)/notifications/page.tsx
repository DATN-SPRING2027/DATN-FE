import NotificationsWorkspace from "@/components/notifications/NotificationsWorkspace";
import { setRequestLocale } from "next-intl/server";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationsWorkspace />;
}
