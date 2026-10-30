"use client";
import BrandLogo from "@/components/common/BrandLogo";
import LanguageTogglePill from "@/components/common/LanguageTogglePill";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import {
  SearchIcon,
  SettingsIcon,
  PlatformHelpIcon,
  PlatformBellIcon,
} from "@/icons";
import jira from "./jira.module.css";
import Button from "@/components/ui/button/Button";

const primary = [
  "dashboard",
  "organizations",
  "users",
  "projects",
  "services",
  "audit",
];
const additional = [
  "organizations",
  "memberships",
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
  const [search, setSearch] = useState("");
  const href = (id: string) =>
    id === "dashboard" ? "/platform" : `/platform/${id}`;
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <header className={jira.topbar}>
      <Link
        href="/"
        className={jira.brand}
        aria-label={t("operatorDesign.home")}
      >
        <BrandLogo className="h-8 w-auto" priority />
      </Link>
      <div
        className={jira.quickSearch}
        onKeyDown={(event) => {
          if (event.key === "Escape") setSearch("");
        }}
      >
        <label>
          <SearchIcon aria-hidden="true" />
          <span className="sr-only">{t("jira.searchPages")}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("jira.searchPages")}
            maxLength={80}
          />
        </label>
        {search.trim() && (
          <div className={jira.searchResults}>
            {[...new Set([...primary, ...additional])]
              .filter((id) =>
                t(`navigation.${id}`)
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              )
              .map((id) => (
                <Link
                  key={id}
                  href={href(id) as never}
                  onClick={() => setSearch("")}
                >
                  {t(`navigation.${id}`)}
                </Link>
              ))}
            {![...primary, ...additional].some((id) =>
              t(`navigation.${id}`)
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
            ) && <p>{t("jira.noPages")}</p>}
          </div>
        )}
      </div>
      <div className={jira.topActions}>
        <LanguageTogglePill variant="inline" />
        <details>
          <summary aria-label={t("jira.help")}>
            <PlatformHelpIcon aria-hidden="true" />
          </summary>
          <div className={jira.topMenu}>
            <strong>{t("jira.administrationTitle")}</strong>
            <p>{t("jira.helpBody")}</p>
          </div>
        </details>
        <Link
          href="/platform/account"
          aria-label={t("jira.settings")}
          className="grid min-h-11 min-w-11 place-items-center"
        >
          <SettingsIcon className="size-5" aria-hidden="true" />
        </Link>
        <details>
          <summary aria-label={t("jira.notifications")}>
            <PlatformBellIcon aria-hidden="true" />
          </summary>
          <div className={jira.topMenu}>
            <p>{t("jira.noNotifications")}</p>
          </div>
        </details>
        <details
          key={`account-${activeSection}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label={t("operatorDesign.account")}>
            <span className={jira.accountAvatar}>{initials}</span>
          </summary>
          <div className={jira.topMenu}>
            <div className="mb-3">
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
