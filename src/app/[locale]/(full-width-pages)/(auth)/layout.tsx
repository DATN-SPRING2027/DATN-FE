import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import AuthLayoutFrame from "@/components/auth/AuthLayoutFrame";
import { AUTH_NAMESPACES, pickMessages } from "@/i18n/messages-scope";

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(
        messages as Record<string, unknown>,
        AUTH_NAMESPACES,
      )}
    >
      <AuthLayoutFrame>{children}</AuthLayoutFrame>
    </NextIntlClientProvider>
  );
}
