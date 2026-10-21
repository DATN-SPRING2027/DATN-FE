"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import Button from "@/components/ui/button/Button";
import styles from "./operator.module.css";

const primary = ["dashboard", "users", "projects", "services", "audit"];
const additional = [
  "memberships",
  "security",
  "jobs",
  "ai",
  "integrations",
  "incidents",
  "diagnostics",
  "account",
];
export default function PlatformHeader({
  activeSection,
  userName = "",
  userEmail,
  isSigningOut,
  onSignOut,
}: {
  activeSection: string;
  userName?: string;
  userEmail?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("platformConsole");
  const href = (id: string) =>
    id === "dashboard" ? "/platform" : `/platform/${id}`;
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <header className={styles.header}>
      <Link
        href="/"
        className={styles.brand}
        aria-label={t("operatorDesign.home")}
      >
        <BrandLogo variant="light" className="h-7 w-auto" priority />
      </Link>
      <nav className={styles.nav} aria-label={t("operatorDesign.navigation")}>
        {primary.map((id) => (
          <Link
            key={id}
            href={href(id) as never}
            aria-current={activeSection === id ? "page" : undefined}
          >
            {t(`navigation.${id}`)}
          </Link>
        ))}
        <details
          key={activeSection}
          className={styles.more}
          data-active={additional.includes(activeSection)}
          data-mobile-active={primary.slice(3).includes(activeSection)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>{t("operatorDesign.more")}</summary>
          <div className={styles.menu}>
            {primary.slice(3).map((id) => (
              <Link
                className={styles.mobileExtra}
                key={id}
                href={href(id) as never}
                aria-current={activeSection === id ? "page" : undefined}
              >
                {t(`navigation.${id}`)}
              </Link>
            ))}
            {additional.map((id) => (
              <Link
                key={id}
                href={href(id) as never}
                aria-current={activeSection === id ? "page" : undefined}
              >
                {t(`navigation.${id}`)}
              </Link>
            ))}
          </div>
        </details>
      </nav>
      <div className={styles.actions}>
        <details
          key={`account-${activeSection}`}
          className={styles.more}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className={styles.identity}
            aria-label={t("operatorDesign.account")}
          >
            <span className={styles.avatar}>{initials}</span>
            <span className="hidden font-medium md:inline">{userName}</span>
          </summary>
          <div className={styles.menu}>
            <div className={styles.menuIdentity}>
              <strong>{userName}</strong>
              <span>{userEmail}</span>
              <span>{t("operatorDesign.role")}</span>
            </div>
            <Link href="/platform/account">{t("navigation.account")}</Link>
            <Button
              variant="outline"
              size="sm"
              disabled={isSigningOut}
              onClick={onSignOut}
            >
              {t(isSigningOut ? "signOutPending" : "signOut")}
            </Button>
          </div>
        </details>
      </div>
    </header>
  );
}
