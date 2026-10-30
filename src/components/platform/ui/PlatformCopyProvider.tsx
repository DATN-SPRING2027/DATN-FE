"use client";
import type { ReactNode } from "react";
import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import english from "@/messages/en.json";
import vietnamese from "@/messages/vi.json";

export default function PlatformCopyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const activeLocale = useLocale();
  const messages = useMessages();
  const isVietnamese = activeLocale === "vi";
  const catalog = isVietnamese ? vietnamese : english;
  return (
    <NextIntlClientProvider
      locale={isVietnamese ? "vi" : "en"}
      messages={{
        ...messages,
        platformConsole: catalog.platformConsole,
        platformUserDirectory: catalog.platformUserDirectory,
        platformUserActions: catalog.platformUserActions,
        platformProjectDirectory: catalog.platformProjectDirectory,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
