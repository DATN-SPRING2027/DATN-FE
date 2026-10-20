"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import WorkspaceLink from "../rylo/WorkspaceLink";
import styles from "./scotch.module.css";

export default function ScotchNavigation() {
  const t = useTranslations("landingScotch");
  const common = useTranslations("landingRylo");
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
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
        </nav>
        <div className={styles.headerActions}>
          <Link href="/signin">{common("signin")}</Link>
          <span className={styles.primaryAction}>
            <WorkspaceLink compact guestLabel={t("getStarted")} hideIcon />
          </span>
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
