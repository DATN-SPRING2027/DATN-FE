"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/common/BrandLogo";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { Link } from "@/i18n/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  DownloadIcon,
  EnvelopeIcon,
  InfoIcon,
  LockIcon,
  SearchIcon,
} from "@/icons";
import enLegalRaw from "@/messages/legal/en.json";
import viLegalRaw from "@/messages/legal/vi.json";
import type {
  LegalArticle,
  LegalCorpus,
  LegalDocLanguage,
  LegalTabId,
} from "./legal-types";

const LEGAL_CORPUS: Record<LegalDocLanguage, LegalCorpus> = {
  vi: viLegalRaw as LegalCorpus,
  en: enLegalRaw as LegalCorpus,
};

const OFFICIAL_CONTACT_EMAIL = "kimthang.work@gmail.com";

function articleMatchesQuery(article: LegalArticle, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystacks: string[] = [
    article.number,
    article.shortTitle,
    article.title,
    ...(article.paragraphs ?? []),
    ...(article.bullets ?? []),
  ];

  if (article.callout) {
    haystacks.push(article.callout.title, article.callout.body);
  }

  for (const sub of article.subSections ?? []) {
    haystacks.push(sub.heading, ...(sub.paragraphs ?? []), ...(sub.bullets ?? []));
  }

  if (article.table) {
    if (article.table.caption) haystacks.push(article.table.caption);
    haystacks.push(...article.table.headers);
    for (const row of article.table.rows) {
      haystacks.push(...row);
    }
  }

  return haystacks.some((text) => text.toLowerCase().includes(normalizedQuery));
}

export interface LegalCenterViewProps {
  initialTab: LegalTabId;
}

export default function LegalCenterView({ initialTab }: LegalCenterViewProps) {
  const t = useTranslations("legalCenter");
  const defaultDocLang: LegalDocLanguage =
    t("defaultDocLang") === "vi" ? "vi" : "en";

  const [docLang, setDocLang] = useState<LegalDocLanguage>(defaultDocLang);

  useEffect(() => {
    setDocLang(defaultDocLang);
  }, [defaultDocLang]);

  function handleDocLangSwitch(nextLang: LegalDocLanguage) {
    setDocLang(nextLang);
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }
  const [activeTab, setActiveTab] = useState<LegalTabId>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const corpus = LEGAL_CORPUS[docLang];
  const ui = corpus.ui;
  const currentDoc = activeTab === "terms" ? corpus.terms : corpus.privacy;
  const companionTab: LegalTabId = activeTab === "terms" ? "privacy" : "terms";
  const companionHref = companionTab === "terms" ? "/terms" : "/privacy";

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredArticles = useMemo(
    () =>
      currentDoc.articles.filter((article) =>
        articleMatchesQuery(article, normalizedQuery),
      ),
    [currentDoc.articles, normalizedQuery],
  );

  const effectiveActiveSectionId =
    activeSectionId && filteredArticles.some((item) => item.id === activeSectionId)
      ? activeSectionId
      : (filteredArticles[0]?.id ?? "");

  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      if (pathname.endsWith("/privacy")) {
        setActiveTab("privacy");
      } else if (pathname.endsWith("/terms")) {
        setActiveTab("terms");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = filteredArticles
      .map((article) => document.getElementById(article.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-112px 0px -68% 0px",
        threshold: [0, 0.25, 0.6],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filteredArticles]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function handleTabSwitch(
    event: React.MouseEvent<HTMLAnchorElement>,
    nextTab: LegalTabId,
  ) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    setMobileTocOpen(false);
    setActiveSectionId("");
    const targetPath = nextTab === "terms" ? "/terms" : "/privacy";
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", targetPath);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleJumpToSection(sectionId: string) {
    setActiveSectionId(sectionId);
    setMobileTocOpen(false);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${sectionId}`);
    }
  }

  async function handleCopySectionLink(sectionId: string) {
    if (typeof window === "undefined") return;
    const basePath = activeTab === "terms" ? "/terms" : "/privacy";
    const url = `${window.location.origin}${basePath}#${sectionId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(sectionId);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API can be unavailable in restricted contexts; fail gracefully.
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200">
      {/* Top Sticky Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200/90 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label={t("brandHomeAria")}
              className="inline-flex shrink-0 items-center focus:outline-none"
            >
              <BrandLogo className="h-7" priority />
            </Link>
            <span
              aria-hidden="true"
              className="hidden h-5 w-px bg-gray-200 sm:inline-block dark:bg-gray-800"
            />
            <span className="hidden truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 sm:inline-flex dark:bg-gray-900 dark:text-gray-300">
              {ui.headerBadge}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Document Language Switcher */}
            <div
              role="group"
              aria-label={ui.langGroupAria}
              className="inline-flex items-center rounded-xl border border-gray-200/90 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-900"
            >
              <button
                type="button"
                onClick={() => handleDocLangSwitch("vi")}
                aria-pressed={docLang === "vi"}
                className={`min-h-8 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  docLang === "vi"
                    ? "bg-white text-brand-700 shadow-theme-xs ring-1 ring-gray-200/80 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {ui.langViLabel}
              </button>
              <button
                type="button"
                onClick={() => handleDocLangSwitch("en")}
                aria-pressed={docLang === "en"}
                className={`min-h-8 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  docLang === "en"
                    ? "bg-white text-brand-700 shadow-theme-xs ring-1 ring-gray-200/80 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {ui.langEnLabel}
              </button>
            </div>

            <div className="hidden sm:block">
              <ThemeToggleButton />
            </div>

            <Link
              href="/signin"
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {ui.signInCta}
            </Link>
            <Link
              href="/signup"
              className="hidden min-h-9 items-center justify-center rounded-xl bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 md:inline-flex dark:bg-brand-500 dark:hover:bg-brand-400"
            >
              {ui.signUpCta}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Governance Header */}
      <section className="border-b border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900/70">
        <div className="mx-auto max-w-7xl px-4 pt-7 pb-0 sm:px-6 sm:pt-9 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1 text-[11px] font-semibold tracking-wider text-brand-700 uppercase ring-1 ring-brand-600/15 ring-inset sm:rounded-full sm:text-xs dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
                <LockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{ui.heroEyebrow}</span>
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                {currentDoc.title}
              </h1>
              <p className="text-sm leading-6 text-gray-600 sm:text-base dark:text-gray-300">
                {currentDoc.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-gray-200/90 bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{ui.printCta}</span>
              </button>
            </div>
          </div>

          {/* Metadata Strip */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 py-3.5 text-xs text-gray-600 dark:border-gray-800/80 dark:text-gray-400">
            <div className="inline-flex items-center gap-1.5 tabular-nums">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {currentDoc.versionLabel}:
              </span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                v{currentDoc.versionValue}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 tabular-nums">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {currentDoc.effectiveLabel}:
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {currentDoc.effectiveValue}
              </span>
            </div>
            <div className="inline-flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400">
                {currentDoc.operatorLabel}:
              </span>
              <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                {currentDoc.operatorValue}
              </span>
            </div>
            <a
              href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
            >
              <EnvelopeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{OFFICIAL_CONTACT_EMAIL}</span>
            </a>
          </div>

          {/* Document Tabs + Instant Clause Filter */}
          <div className="mt-2 flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between lg:pb-0 print:hidden">
            <nav
              aria-label={t("tabsAriaLabel")}
              className="-mb-px flex w-full border-b border-gray-200/80 lg:w-auto lg:border-b-0 dark:border-gray-800"
            >
              <Link
                href="/terms"
                onClick={(event) => handleTabSwitch(event, "terms")}
                aria-current={activeTab === "terms" ? "page" : undefined}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors sm:flex-initial sm:justify-start sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === "terms"
                    ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-300"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <DocsIcon
                  className="hidden h-4 w-4 shrink-0 sm:inline-block"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{corpus.terms.tabLabel}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] sm:px-2 sm:text-xs tabular-nums ${
                    activeTab === "terms"
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {corpus.terms.articles.length}
                </span>
              </Link>

              <Link
                href="/privacy"
                onClick={(event) => handleTabSwitch(event, "privacy")}
                aria-current={activeTab === "privacy" ? "page" : undefined}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors sm:flex-initial sm:justify-start sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === "privacy"
                    ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-300"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <LockIcon
                  className="hidden h-4 w-4 shrink-0 sm:inline-block"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{corpus.privacy.tabLabel}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] sm:px-2 sm:text-xs tabular-nums ${
                    activeTab === "privacy"
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {corpus.privacy.articles.length}
                </span>
              </Link>
            </nav>

            <div className="relative w-full lg:mb-2 lg:max-w-xs xl:max-w-sm">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={ui.searchPlaceholder}
                aria-label={ui.searchAriaLabel}
                className="h-9 w-full rounded-xl border border-gray-200/90 bg-gray-50 ps-9 pe-8 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label={ui.clearSearchAria}
                  className="absolute end-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <CloseLineIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Governing Language Strip */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gray-200/90 bg-white px-4 py-3 text-xs leading-5 text-gray-600 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          <InfoIcon
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
          />
          <p>{ui.governingLanguageNotice}</p>
        </div>

        {/* Mobile Quick Jump TOC */}
        <div className="mb-6 lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setMobileTocOpen((prev) => !prev)}
            aria-expanded={mobileTocOpen}
            aria-controls="legal-mobile-toc"
            className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200/90 bg-white px-4 py-2.5 text-start text-xs font-semibold text-gray-800 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
          >
            <span className="tabular-nums">
              {ui.tocMobileToggle.replace(
                "{count}",
                String(filteredArticles.length),
              )}
            </span>
            {mobileTocOpen ? (
              <ChevronUpIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>

          {mobileTocOpen && filteredArticles.length > 0 ? (
            <nav
              id="legal-mobile-toc"
              aria-label={ui.tocHeading}
              className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200/90 bg-white p-2 shadow-theme-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <ul className="space-y-0.5">
                {filteredArticles.map((article) => {
                  const isActive = effectiveActiveSectionId === article.id;
                  return (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => handleJumpToSection(article.id)}
                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs transition-colors ${
                          isActive
                            ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-200"
                        }`}
                      >
                        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums opacity-75">
                          {article.number}
                        </span>
                        <span className="truncate">{article.shortTitle}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Desktop Sticky Sidebar TOC & SLA Contact Card */}
          <aside className="hidden lg:col-span-4 lg:block xl:col-span-3 print:hidden">
            <div className="sticky top-20 space-y-5">
              <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-2 px-2">
                  <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    {ui.tocHeading}
                  </h2>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                    {filteredArticles.length}/{currentDoc.articles.length}
                  </span>
                </div>

                {filteredArticles.length > 0 ? (
                  <nav aria-label={ui.tocHeading}>
                    <ul className="max-h-[calc(100vh-22rem)] space-y-0.5 overflow-y-auto pe-1">
                      {filteredArticles.map((article) => {
                        const isActive = effectiveActiveSectionId === article.id;
                        return (
                          <li key={article.id}>
                            <button
                              type="button"
                              onClick={() => handleJumpToSection(article.id)}
                              className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs transition-colors ${
                                isActive
                                  ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-600/15 ring-inset dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
                              }`}
                            >
                              <span
                                className={`inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                                  isActive
                                    ? "bg-brand-100/80 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"
                                    : "bg-gray-100 text-gray-500 group-hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {article.number}
                              </span>
                              <span className="min-w-0 truncate">
                                {article.shortTitle}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                ) : null}
              </div>

              {/* SLA & Data Protection Contact Card */}
              <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
                  {ui.contactCardTitle}
                </h2>
                <p className="mt-1.5 text-xs leading-5 text-gray-600 dark:text-gray-400">
                  {ui.contactCardDescription}
                </p>

                <dl className="mt-3.5 space-y-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {ui.slaAckLabel}
                    </dt>
                    <dd className="rounded-md bg-success-50 px-2 py-0.5 font-semibold text-success-700 tabular-nums dark:bg-success-500/15 dark:text-success-300">
                      {ui.slaAckValue}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {ui.slaDeleteLabel}
                    </dt>
                    <dd className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 tabular-nums dark:bg-brand-500/15 dark:text-brand-300">
                      {ui.slaDeleteValue}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {ui.slaAuditLabel}
                    </dt>
                    <dd className="font-semibold text-gray-800 tabular-nums dark:text-gray-200">
                      {ui.slaAuditValue}
                    </dd>
                  </div>
                </dl>

                <a
                  href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
                  className="mt-4 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <EnvelopeIcon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span className="truncate">{OFFICIAL_CONTACT_EMAIL}</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Primary Document Surface */}
          <div className="space-y-6 lg:col-span-8 xl:col-span-9">
            {/* Search Filter Status Pill */}
            {normalizedQuery ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200/80 bg-brand-50/60 px-4 py-2.5 text-xs dark:border-brand-500/30 dark:bg-brand-500/10">
                <span className="font-medium text-brand-800 tabular-nums dark:text-brand-200">
                  {ui.searchResultsCount
                    .replace("{count}", String(filteredArticles.length))
                    .replace("{total}", String(currentDoc.articles.length))}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="cursor-pointer font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  {ui.emptySearchResetCta}
                </button>
              </div>
            ) : (
              /* 60-Second Executive Summary (TL;DR) */
              <section
                aria-labelledby="legal-tldr-heading"
                className="rounded-2xl border border-brand-200/80 bg-brand-50/45 p-5 sm:p-6 dark:border-brand-500/25 dark:bg-brand-500/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="legal-tldr-heading"
                    className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                  >
                    {currentDoc.tldrTitle}
                  </h2>
                  <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/15 ring-inset tabular-nums dark:bg-gray-900 dark:text-brand-300 dark:ring-brand-400/25">
                    {currentDoc.badgeLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {currentDoc.tldrSubtitle}
                </p>

                <ul className="mt-4 space-y-2.5">
                  {currentDoc.tldrItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm leading-6 text-gray-800 dark:text-gray-200"
                    >
                      <CheckCircleIcon
                        aria-hidden="true"
                        className="mt-1 h-4 w-4 shrink-0 text-success-600 dark:text-success-400"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 border-t border-brand-200/60 pt-3 text-xs text-gray-600 dark:border-brand-500/20 dark:text-gray-400">
                  {currentDoc.tldrDisclaimer}
                </p>
              </section>
            )}

            {/* Articles Surface or Empty Filtered State */}
            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <SearchIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                  {ui.emptySearchTitle}
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {ui.emptySearchDescription}
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
                >
                  {ui.emptySearchResetCta}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/90 rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                {filteredArticles.map((article) => {
                  const isCopied = copiedId === article.id;
                  return (
                    <article
                      key={article.id}
                      id={article.id}
                      className="scroll-mt-24 p-5 sm:p-7"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-600/15 ring-inset tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20">
                            {article.number}
                          </span>
                          <h2 className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg dark:text-white">
                            {article.title}
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopySectionLink(article.id)}
                          aria-label={ui.copyLinkAria}
                          title={isCopied ? ui.copiedLinkLabel : ui.copyLinkAria}
                          className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 print:hidden"
                        >
                          {isCopied ? (
                            <>
                              <CheckLineIcon
                                className="h-3.5 w-3.5 text-success-600 dark:text-success-400"
                                aria-hidden="true"
                              />
                              <span className="text-success-700 dark:text-success-300">
                                {ui.copiedLinkLabel}
                              </span>
                            </>
                          ) : (
                            <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      <div className="mt-4 space-y-3.5 sm:ps-11">
                        {article.paragraphs?.map((paragraph, pIdx) => (
                          <p
                            key={pIdx}
                            className="text-sm leading-6.5 text-gray-700 dark:text-gray-300"
                          >
                            {paragraph}
                          </p>
                        ))}

                        {article.bullets && article.bullets.length > 0 ? (
                          <ul className="space-y-2 rounded-xl bg-gray-50/80 p-4 dark:bg-gray-950/60">
                            {article.bullets.map((bullet, bIdx) => (
                              <li
                                key={bIdx}
                                className="flex items-start gap-2.5 text-sm leading-6 text-gray-700 dark:text-gray-300"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
                                />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {article.table ? (
                          <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-gray-800">
                            <table className="w-full min-w-[640px] divide-y divide-gray-200 text-start text-xs sm:text-sm dark:divide-gray-800">
                              {article.table.caption ? (
                                <caption className="sr-only">
                                  {article.table.caption}
                                </caption>
                              ) : null}
                              <thead className="bg-gray-50/90 dark:bg-gray-950/80">
                                <tr>
                                  {article.table.headers.map((header, hIdx) => (
                                    <th
                                      key={hIdx}
                                      scope="col"
                                      className="px-3.5 py-2.5 text-start text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-300"
                                    >
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200/80 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                {article.table.rows.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="align-top transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
                                  >
                                    {row.map((cell, cIdx) => {
                                      const isNumericCol =
                                        article.table?.numericColumnIndices?.includes(
                                          cIdx,
                                        ) ?? false;
                                      return (
                                        <td
                                          key={cIdx}
                                          className={`px-3.5 py-3 leading-5.5 ${
                                            cIdx === 0
                                              ? "min-w-[150px] font-semibold text-gray-900 dark:text-gray-100"
                                              : "text-gray-700 dark:text-gray-300"
                                          } ${isNumericCol ? "whitespace-nowrap tabular-nums" : ""}`}
                                        >
                                          {cell}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}

                        {article.subSections?.map((sub, sIdx) => (
                          <div key={sIdx} className="space-y-2 pt-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {sub.heading}
                            </h3>
                            {sub.paragraphs?.map((sp, spIdx) => (
                              <p
                                key={spIdx}
                                className="text-sm leading-6.5 text-gray-700 dark:text-gray-300"
                              >
                                {sp}
                              </p>
                            ))}
                            {sub.bullets && sub.bullets.length > 0 ? (
                              <ul className="space-y-1.5 ps-4">
                                {sub.bullets.map((sb, sbIdx) => (
                                  <li
                                    key={sbIdx}
                                    className="list-disc text-sm leading-6 text-gray-700 dark:text-gray-300"
                                  >
                                    {sb}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}

                        {article.callout ? (
                          <div
                            className={`rounded-xl border p-4 ${
                              article.callout.variant === "warning"
                                ? "border-warning-200 bg-warning-50/70 text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
                                : "border-brand-200/80 bg-brand-50/50 text-gray-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-gray-200"
                            }`}
                          >
                            <p className="text-xs font-semibold tracking-wide text-gray-900 uppercase dark:text-white">
                              {article.callout.title}
                            </p>
                            <p className="mt-1 text-sm leading-6">
                              {article.callout.body}
                            </p>
                            {article.callout.externalLinkHref &&
                            article.callout.externalLinkLabel ? (
                              <a
                                href={article.callout.externalLinkHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
                              >
                                <span>{article.callout.externalLinkLabel}</span>
                                <ArrowRightIcon
                                  className="h-3.5 w-3.5 rtl:rotate-180"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Companion Policy Cross-Navigation Card */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:flex-row sm:items-center sm:p-6 dark:border-gray-800 dark:bg-gray-900 print:hidden">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
                  {currentDoc.crossNavEyebrow}
                </p>
                <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                  {currentDoc.crossNavTitle}
                </h2>
                <p className="max-w-xl text-xs leading-5 text-gray-600 sm:text-sm dark:text-gray-400">
                  {currentDoc.crossNavDescription}
                </p>
              </div>
              <Link
                href={companionHref}
                onClick={(event) => handleTabSwitch(event, companionTab)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
              >
                <span>{currentDoc.crossNavCta}</span>
                <ArrowRightIcon
                  className="h-4 w-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Clean Legal Footer */}
      <footer className="mt-10 border-t border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:text-gray-400">
          <div className="space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {ui.footerCopyright}
            </p>
            <p>{ui.footerJurisdiction}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-medium print:hidden">
            <Link
              href="/"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {ui.homeCta}
            </Link>
            <Link
              href="/terms"
              onClick={(event) => handleTabSwitch(event, "terms")}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {corpus.terms.tabLabel}
            </Link>
            <Link
              href="/privacy"
              onClick={(event) => handleTabSwitch(event, "privacy")}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {corpus.privacy.tabLabel}
            </Link>
            <a
              href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {OFFICIAL_CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
