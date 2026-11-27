import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ADMIN_NAMESPACES, pickMessages } from "@/i18n/messages-scope";
import AdminLayoutShell from "./AdminLayoutShell";

export default async function AdminLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages as Record<string, unknown>, ADMIN_NAMESPACES)}
    >
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </NextIntlClientProvider>
  );
}
