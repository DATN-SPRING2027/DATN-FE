"use client";
import type { ReactNode } from "react";
import { NextIntlClientProvider, useMessages } from "next-intl";
import english from "@/messages/en.json";
export default function PlatformCopyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const messages = useMessages();
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{
        ...messages,
        platformConsole: english.platformConsole,
        platformUserDirectory: english.platformUserDirectory,
        platformUserActions: english.platformUserActions,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
