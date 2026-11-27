"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import LanguageTogglePill from "@/components/common/LanguageTogglePill";
import WorkspaceLink from "../rylo/WorkspaceLink";
import UserDropdown from "@/components/header/UserDropdown";
import { hasClientSessionHint } from "@/lib/api-client";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";
import styles from "./scotch.module.css";

const subscribeNoop = () => () => undefined;

export default function ScotchNavigation({
  hasSessionCookie = false,
}: {
  hasSessionCookie?: boolean;
} = {}) {
  const t = useTranslations("landingScotch");
  const common = useTranslations("landingRylo");
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const hasSessionHint = useSyncExternalStore(
    subscribeNoop,
    hasClientSessionHint,
    () => hasSessionCookie,
  );
  const shouldProbeSession = hasSessionCookie || hasSessionHint;
  const session = useSignInSessionQuery({ enabled: shouldProbeSession });
  const isCheckingSession =
    session.isLoading || (session.isPending && session.fetchStatus !== "idle");
  const isAuthenticated = Boolean(session.data);
  const links = [
    ["products", "giai-phap"],
    ["integrations", "workflow"],
    ["principles", "approach"],
    ["stories", "team-stories"],
    ["about", "continuum-footer"],
  ] as const;
  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className={styles.headerInner}>
        <Link href="/" aria-label={common("home")} className={styles.logo}>
          <BrandLogo variant="inverse" className="h-7" priority />
        </Link>
        <nav
          id="scotch-navigation"
          aria-label={common("nav")}
          className={`${styles.navigation} ${open ? styles.navigationOpen : ""}`}
        >
          {links.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
              {t(label)}
            </a>
          ))}
          <Link
            href="/docs"
            className={styles.docsGlassButton}
            data-testid="scotch-docs-glass-link"
            onClick={() => setOpen(false)}
          >
            <span className={styles.docsGlassLabel}>{t("docsLink")}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className={styles.docsGlassIcon}
            >
              <path
                d="M4.5 11.5L11.5 4.5M11.5 4.5H6.25M11.5 4.5V9.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className={styles.mobileActions}>
            {isCheckingSession ? (
              <div className={styles.authLoadingSkeleton} aria-busy="true">
                <span className={styles.authSkeletonButton} />
              </div>
            ) : isAuthenticated ? (
              <div className={styles.mobileAuthRow}>
                <span className={styles.primaryAction} onClick={() => setOpen(false)}>
                  <WorkspaceLink compact hideIcon hasSessionCookie={shouldProbeSession} />
                </span>
                <UserDropdown user={session.data} />
              </div>
            ) : (
              <div className={styles.mobileGuestRow}>
                <LanguageTogglePill variant="inverse" />
                <Link
                  href="/signin"
                  className={styles.mobileSignInLink}
                  onClick={() => setOpen(false)}
                >
                  {common("signin")}
                </Link>
                <span className={styles.primaryAction} onClick={() => setOpen(false)}>
                  <WorkspaceLink
                    compact
                    guestLabel={t("getStarted")}
                    hideIcon
                    hasSessionCookie={shouldProbeSession}
                  />
                </span>
              </div>
            )}
          </div>
        </nav>
        <div className={styles.headerActions}>
          {isCheckingSession ? (
            <div className={styles.authLoadingSkeleton} aria-busy="true">
              <span className={styles.authSkeletonLink} />
              <span className={styles.authSkeletonButton} />
            </div>
          ) : isAuthenticated ? (
            <>
              <span className={styles.primaryAction}>
                <WorkspaceLink compact hideIcon hasSessionCookie={shouldProbeSession} />
              </span>
              <UserDropdown user={session.data} />
            </>
          ) : (
            <>
              <LanguageTogglePill variant="inverse" />
              <Link href="/signin">{common("signin")}</Link>
              <span className={styles.primaryAction}>
                <WorkspaceLink
                  compact
                  guestLabel={t("getStarted")}
                  hideIcon
                  hasSessionCookie={shouldProbeSession}
                />
              </span>
            </>
          )}
        </div>
        <button
          ref={toggle}
          type="button"
          className={styles.menuButton}
          aria-label={common(open ? "closeMenu" : "menu")}
          aria-expanded={open}
          aria-controls="scotch-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
