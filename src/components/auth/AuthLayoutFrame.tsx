"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ArrowRightIcon, CheckCircleIcon } from "@/icons";
import LegacyAuthLayout from "./LegacyAuthLayout";
import styles from "./auth-experience.module.css";

const redesignedRoutes = new Set([
  "/signin",
  "/signup",
  "/reset-password",
  "/verify-email",
  "/select-organization",
  "/onboarding",
]);

export default function AuthLayoutFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("authExperience");
  if (!redesignedRoutes.has(pathname))
    return <LegacyAuthLayout>{children}</LegacyAuthLayout>;

  return (
    <div className={styles.page} data-auth-route={pathname}>
      <div
        className={`no-scrollbar ${styles.scrollPane}`}
        tabIndex={0}
        role="region"
        aria-label={t("contentRegion")}
      >
        <header className={styles.header}>
          <Link href="/" aria-label={t("homeLabel")} className={styles.brand}>
            <BrandLogo className="h-9" priority />
          </Link>
          <nav aria-label={t("contentRegion")}>
            <Link href="/">{t("home")}</Link>
            {pathname === "/signin" ? (
              <Link href="/signup">{t("join")}</Link>
            ) : pathname === "/signup" ||
              pathname === "/reset-password" ||
              pathname === "/verify-email" ? (
              <Link href="/signin">{t("signIn")}</Link>
            ) : (
              <span>{t("workspaceSetup")}</span>
            )}
          </nav>
        </header>
        <div key={pathname} className={styles.content}>
          {children}
        </div>
        <footer className={styles.footer}>
          <span>{t("copyright")}</span>
          <span>{t("footer")}</span>
        </footer>
      </div>
      <div className={styles.waveSurface} aria-hidden="true">
        <div key={pathname} className={styles.curveLine} aria-hidden="true" />
      </div>
      <aside className={styles.visual} aria-label={t("visualEyebrow")}>
        <div className={styles.visualInner}>
          <Image
            src="/images/auth/team-workspace.jpg"
            alt={t("photoAlt")}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 1px"
            className={styles.photo}
          />
          <div className={styles.photoOverlay} />
          <div className={styles.visualCopy}>
            <p className={styles.visualEyebrow}>
              <span />
              {t("visualEyebrow")}
            </p>
            <h2>{t("visualTitle")}</h2>
            <p className={styles.visualDescription}>{t("visualDescription")}</p>
            <div className={styles.visualTags}>
              <span>
                <CheckCircleIcon aria-hidden="true" />
                {t("capture")}
              </span>
              <span>
                <ArrowRightIcon aria-hidden="true" />
                {t("handover")}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className={styles.themeControl}>
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
