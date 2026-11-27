import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { isRtl } from "@/i18n/languages";
import { type Locale, routing } from "@/i18n/routing";
import { AppProviders } from "@/lib/providers/AppProviders";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { pickMessages, ROOT_BASE_NAMESPACES } from "@/i18n/messages-scope";
import { BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT } from "@/lib/browser-extension-hydration-guard";
import { Be_Vietnam_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { BRAND_SHORT } from "@/lib/page-titles";
import { resolveMetadataLocale } from "@/lib/page-titles.server";
import "../globals.css";

const THEME_INIT_SCRIPT =
  '(function(){try{if(localStorage.getItem("theme")==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveMetadataLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "pageTitles",
  });
  return {
    title: {
      default: t("defaultApp"),
      template: `%s · ${BRAND_SHORT}`,
    },
    description: t("defaultDescription"),
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const rootMessages = pickMessages(
    messages as Record<string, unknown>,
    ROOT_BASE_NAMESPACES,
  );

  return (
    <html lang={locale} dir={isRtl(locale as Locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            __html: BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT,
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${beVietnamPro.className} ${beVietnamPro.variable} font-sans dark:bg-gray-900`}>
        <NextIntlClientProvider locale={locale} messages={rootMessages}>
          <AppProviders>
            <ThemeProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </ThemeProvider>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
