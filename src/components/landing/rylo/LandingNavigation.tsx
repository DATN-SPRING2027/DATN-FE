"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/common/BrandLogo";
import { Link } from "@/i18n/navigation";
import { CloseIcon, PlusIcon } from "@/icons";
import WorkspaceLink from "./WorkspaceLink";
import styles from "./landing.module.css";

export default function LandingNavigation() {
  const t = useTranslations("landingRylo");
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const links = [
    ["solution", "giai-phap"],
    ["journey", "cach-hoat-dong"],
    ["faq", "cau-hoi"],
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
      <Link href="/" aria-label={t("home")} className={styles.logo}>
        <BrandLogo variant="inverse" className="h-8" priority />
      </Link>
      <nav
        id="landing-navigation"
        aria-label={t("nav")}
        className={`${styles.navigation} ${open ? styles.navigationOpen : ""}`}
      >
        {links.map(([label, id]) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
            {t(label)}
          </a>
        ))}
      </nav>
      <div className={styles.headerActions}>
        <WorkspaceLink compact />
        <button
          ref={toggle}
          type="button"
          className={styles.menuButton}
          aria-label={t(open ? "closeMenu" : "menu")}
          aria-expanded={open}
          aria-controls="landing-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <CloseIcon aria-hidden="true" />
          ) : (
            <PlusIcon aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
