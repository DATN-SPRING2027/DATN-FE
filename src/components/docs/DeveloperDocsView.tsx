"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/common/BrandLogo";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";
import type { McpKeyScopeMode } from "@/lib/queries/mcp-keys/mcp-keys.types";
import {
  MCP_IDE_CLIENT_SPECS,
  MCP_PLACEHOLDER_TOKEN,
  resolvePublicMcpEndpoints,
  type McpEndpointMode,
  type McpIdeClientId,
} from "@/lib/mcp-client-configs";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseLineIcon,
  CopyIcon,
  LockIcon,
  PlugInIcon,
  SearchIcon,
} from "@/icons";
import { cn } from "@/utils";
import { writeClipboardText } from "@/utils/clipboard";
import { DOCS_CORPUS } from "./docs-corpus";
import styles from "./docs-notebook.module.css";
import { CONTINUUM_MCP_TOOLS, MCP_TOOL_DOMAIN_ORDER } from "./docs-tools-data";
import type {
  DocsLanguage,
  McpToolDoc,
  McpToolDomainId,
} from "./docs-types";

function ScopeIndicator({ scope }: { scope: McpKeyScopeMode }) {
  const markColor =
    scope === "READ_ONLY"
      ? "bg-success-600 dark:bg-success-400"
      : scope === "READ_WRITE"
        ? "bg-blue-light-600 dark:bg-blue-light-400"
        : "bg-brand-600 dark:bg-brand-400";

  const textColor =
    scope === "READ_ONLY"
      ? "text-success-700 dark:text-success-300"
      : scope === "READ_WRITE"
        ? "text-blue-light-700 dark:text-blue-light-300"
        : "text-brand-700 dark:text-brand-300";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-none font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap",
        textColor,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-none", markColor)}
      />
      <span>{scope}</span>
    </span>
  );
}

function buildToolJsonRpcPayload(tool: McpToolDoc): string {
  return JSON.stringify(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: tool.name,
        arguments: tool.exampleArgs,
      },
    },
    null,
    2,
  );
}

function renderSyntaxTintedSnippet(
  snippet: string,
  language: "json" | "bash",
): ReactNode {
  if (language === "json") {
    const lines = snippet.split("\n");
    return lines.map((line, lineIdx) => {
      const nl = lineIdx < lines.length - 1 ? "\n" : "";
      const keyValueMatch = /^(\s*)("(?:\\.|[^"\\])*")(\s*:\s*)(.*)$/.exec(
        line,
      );
      if (keyValueMatch) {
        const [, indent, keyToken, colon, rest] = keyValueMatch;
        const strValMatch = /^("(?:\\.|[^"\\])*")(,?)$/.exec(rest);
        if (strValMatch) {
          return (
            <span key={lineIdx}>
              {indent}
              <span className="text-slate-300">{keyToken}</span>
              <span className="text-slate-500">{colon}</span>
              <span className="text-emerald-300">{strValMatch[1]}</span>
              <span className="text-slate-400">{strValMatch[2]}</span>
              {nl}
            </span>
          );
        }
        const primValMatch = /^(true|false|null|-?\d+(?:\.\d+)?)(,?)$/.exec(
          rest,
        );
        if (primValMatch) {
          return (
            <span key={lineIdx}>
              {indent}
              <span className="text-slate-300">{keyToken}</span>
              <span className="text-slate-500">{colon}</span>
              <span className="text-sky-300">{primValMatch[1]}</span>
              <span className="text-slate-400">{primValMatch[2]}</span>
              {nl}
            </span>
          );
        }
        return (
          <span key={lineIdx}>
            {indent}
            <span className="text-slate-300">{keyToken}</span>
            <span className="text-slate-500">{colon}</span>
            <span className="text-slate-200">{rest}</span>
            {nl}
          </span>
        );
      }

      const arrayStringMatch = /^(\s*)("(?:\\.|[^"\\])*")(,?)$/.exec(line);
      if (arrayStringMatch) {
        return (
          <span key={lineIdx}>
            {arrayStringMatch[1]}
            <span className="text-emerald-300">{arrayStringMatch[2]}</span>
            <span className="text-slate-400">{arrayStringMatch[3]}</span>
            {nl}
          </span>
        );
      }

      return (
        <span key={lineIdx} className="text-slate-400">
          {line}
          {nl}
        </span>
      );
    });
  }

  // Bash / CLI single-line tokenizer preserving exact whitespace and quotes
  const tokens = snippet.match(/"(?:\\.|[^"\\])*"|\s+|\S+/g) ?? [snippet];
  return tokens.map((token, idx) => {
    if (/^\s+$/.test(token)) {
      return <span key={idx}>{token}</span>;
    }
    if (idx === 0) {
      return (
        <span key={idx} className="font-semibold text-sky-300">
          {token}
        </span>
      );
    }
    if (token.startsWith("-")) {
      return (
        <span key={idx} className="text-sky-300">
          {token}
        </span>
      );
    }
    if (token.startsWith('"')) {
      return (
        <span key={idx} className="text-emerald-300">
          {token}
        </span>
      );
    }
    return (
      <span key={idx} className="text-slate-200">
        {token}
      </span>
    );
  });
}

export default function DeveloperDocsView() {
  const t = useTranslations("developerDocs");
  const router = useRouter();
  const pathname = usePathname();

  const defaultDocLang: DocsLanguage =
    t("defaultDocLang") === "vi" ? "vi" : "en";

  const [docLang, setDocLang] = useState<DocsLanguage>(defaultDocLang);
  useEffect(() => {
    setDocLang(defaultDocLang);
  }, [defaultDocLang]);

  const corpus = DOCS_CORPUS[docLang];
  const ui = corpus.ui;
  useDocumentTitle(corpus.metaTitle);

  const session = useSignInSessionQuery();
  const hasOrgSession = Boolean(
    session.data &&
      session.data.context !== "ACCOUNT" &&
      session.data.context !== "PLATFORM",
  );
  const keysDestinationHref = hasOrgSession
    ? "/organization/integrations"
    : "/signin";

  // SSR-safe origin resolution: initialize to "" so SSR & initial client render match 100%
  const [browserOrigin, setBrowserOrigin] = useState<string>("");
  const userToggledEndpointRef = useRef(false);
  const [endpointMode, setEndpointMode] = useState<McpEndpointMode>(
    () => resolvePublicMcpEndpoints("", "/api/v1/mcp").recommendedMode,
  );

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setBrowserOrigin(currentOrigin);
    if (!userToggledEndpointRef.current) {
      const resolved = resolvePublicMcpEndpoints(currentOrigin, "/api/v1/mcp");
      setEndpointMode(resolved.recommendedMode);
    }
  }, []);

  const { directEndpointUrl, bffEndpointUrl } = useMemo(
    () => resolvePublicMcpEndpoints(browserOrigin, "/api/v1/mcp"),
    [browserOrigin],
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileTocToggleRef = useRef<HTMLButtonElement>(null);
  const ideTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const playbookTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("overview");
  const [selectedStageId, setSelectedStageId] = useState<string>("stage-host");

  const [activeIdeClient, setActiveIdeClient] =
    useState<McpIdeClientId>("antigravity");
  const [activePlaybookId, setActivePlaybookId] =
    useState<string>("playbook-bugfix");

  const [selectedDomain, setSelectedDomain] = useState<
    McpToolDomainId | "ALL"
  >("ALL");
  const [selectedScope, setSelectedScope] = useState<McpKeyScopeMode | "ALL">(
    "ALL",
  );
  // 0 tools expanded on initial load keeps mobile 375px compact & eliminates 84 chip clutter
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {},
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyStatusText, setCopyStatusText] = useState<string>("");
  const [copyFailed, setCopyFailed] = useState<boolean>(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // '/' shortcut to focus the docs & tool search input
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const active = document.activeElement;
        const isEditable =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (!isEditable) {
          event.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close mobile TOC on Escape (unless already handled by search input)
  useEffect(() => {
    if (!mobileTocOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setMobileTocOpen(false);
        mobileTocToggleRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileTocOpen]);

  // Scroll-spy for sticky TOC
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sectionEls = corpus.sections
      .map((sec) => document.getElementById(sec.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]?.target?.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-112px 0px -65% 0px",
        threshold: [0, 0.25, 0.6],
      },
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [corpus.sections]);

  const handleLangSwitch = (nextLang: DocsLanguage) => {
    setDocLang(nextLang);
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
    }
    router.replace(pathname, { locale: nextLang });
  };

  const handleCopy = async (id: string, text: string) => {
    const ok = await writeClipboardText(text);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    if (ok) {
      setCopyFailed(false);
      setCopiedId(id);
      setCopyStatusText(ui.copiedCta);
      copyTimerRef.current = setTimeout(() => {
        setCopiedId(null);
        setCopyStatusText("");
      }, 2000);
    } else {
      setCopiedId(null);
      setCopyFailed(true);
      setCopyStatusText(
        docLang === "vi"
          ? "Trình duyệt chặn sao chép tự động. Hãy bôi đen văn bản và nhấn Ctrl+C (hoặc Cmd+C)."
          : "Automatic copy was blocked by your browser. Select the text and press Ctrl+C (or Cmd+C).",
      );
      copyTimerRef.current = setTimeout(() => {
        setCopyFailed(false);
        setCopyStatusText("");
      }, 4000);
    }
  };

  const scrollToElementAfterLayout = (elementId: string, hashId?: string) => {
    const performScroll = () => {
      const target = document.getElementById(elementId);
      if (!target) return;
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${hashId ?? elementId}`);
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(performScroll);
      });
    } else {
      performScroll();
    }
  };

  const handleJumpToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setMobileTocOpen(false);
    scrollToElementAfterLayout(sectionId, sectionId);
  };

  const handleJumpToSubsystemTools = (domainId: McpToolDomainId) => {
    setSelectedDomain(domainId);
    setSelectedScope("ALL");
    setSearchQuery("");
    setActiveSectionId("tools");
    setMobileTocOpen(false);
    scrollToElementAfterLayout("tools", "tools");
  };

  const handleJumpToPlaybookTool = (toolName: string) => {
    setSelectedDomain("ALL");
    setSelectedScope("ALL");
    setSearchQuery("");
    setExpandedTools((prev) => ({ ...prev, [toolName]: true }));
    setActiveSectionId("tools");
    scrollToElementAfterLayout(`mcp-tool-anchor-${toolName}`, "tools");
  };

  const handleIdeTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const total = MCP_IDE_CLIENT_SPECS.length;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % total;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + total) % total;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = total - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetSpec = MCP_IDE_CLIENT_SPECS[nextIndex];
      setActiveIdeClient(targetSpec.id);
      ideTabRefs.current[targetSpec.id]?.focus();
    }
  };

  const handlePlaybookTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const playbooks = corpus.resourcesAndPrompts.playbooks;
    const total = playbooks.length;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % total;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + total) % total;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = total - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetPb = playbooks[nextIndex];
      setActivePlaybookId(targetPb.id);
      playbookTabRefs.current[targetPb.id]?.focus();
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const domainCounts = useMemo(() => {
    const counts: Record<McpToolDomainId, number> = {
      "iam-projects": 0,
      "tasks-sprints": 0,
      capture: 0,
      handover: 0,
      "sag-knowledge": 0,
      "chat-notifications": 0,
    };
    for (const tool of CONTINUUM_MCP_TOOLS) {
      counts[tool.domain] += 1;
    }
    return counts;
  }, []);

  const scopeCounts = useMemo(() => {
    const counts: Record<McpKeyScopeMode, number> = {
      READ_ONLY: 0,
      READ_WRITE: 0,
      FULL_OPERATIONS: 0,
    };
    for (const tool of CONTINUUM_MCP_TOOLS) {
      counts[tool.minScope] += 1;
    }
    return counts;
  }, []);

  const filteredTools = useMemo(() => {
    return CONTINUUM_MCP_TOOLS.filter((tool) => {
      if (selectedDomain !== "ALL" && tool.domain !== selectedDomain) {
        return false;
      }
      if (selectedScope !== "ALL" && tool.minScope !== selectedScope) {
        return false;
      }
      if (!normalizedQuery) return true;

      const haystacks = [
        tool.name,
        tool.domain,
        tool.minScope,
        tool.summary[docLang],
        tool.escalationNote?.[docLang] ?? "",
        ...tool.params.flatMap((p) => [
          p.name,
          p.type,
          p.description[docLang],
        ]),
      ];
      return haystacks.some((entry) =>
        entry.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [docLang, normalizedQuery, selectedDomain, selectedScope]);

  const activeStage =
    corpus.overview.stages.find((stage) => stage.id === selectedStageId) ??
    corpus.overview.stages[0];

  const activeIdeSpec =
    MCP_IDE_CLIENT_SPECS.find((spec) => spec.id === activeIdeClient) ??
    MCP_IDE_CLIENT_SPECS[0];
  const selectedEndpointUrl =
    endpointMode === "direct" ? directEndpointUrl : bffEndpointUrl;
  const quickstartSnippet = activeIdeSpec.buildSnippet({
    endpointUrl: selectedEndpointUrl,
    bearerToken: MCP_PLACEHOLDER_TOKEN,
  });

  const activePlaybook =
    corpus.resourcesAndPrompts.playbooks.find(
      (pb) => pb.id === activePlaybookId,
    ) ?? corpus.resourcesAndPrompts.playbooks[0];

  const allFilteredExpanded =
    filteredTools.length > 0 &&
    filteredTools.every((tool) => Boolean(expandedTools[tool.name]));

  const toggleAllFilteredTools = () => {
    if (allFilteredExpanded) {
      setExpandedTools({});
    } else {
      const next: Record<string, boolean> = {};
      for (const tool of filteredTools) {
        next[tool.name] = true;
      }
      setExpandedTools(next);
    }
  };

  return (
    <div
      lang={docLang}
      className={cn(
        styles.notebookCanvas,
        "min-h-screen text-gray-800 dark:text-gray-200",
      )}
    >
      {/* Screen-reader & copy fallback status announcement */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={
          copyFailed
            ? "mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-8"
            : "sr-only"
        }
      >
        {copyStatusText ? (
          <p
            className={
              copyFailed
                ? "rounded-none border-s-2 border-warning-500 bg-warning-50/90 px-4 py-2 text-xs font-medium text-warning-800 dark:border-warning-400 dark:bg-warning-500/10 dark:text-warning-200"
                : undefined
            }
          >
            {copyStatusText}
          </p>
        ) : null}
      </div>

      {/* 1. Sticky Frosted Top Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200/90 bg-white/88 backdrop-blur-md dark:border-gray-800/90 dark:bg-gray-950/88 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              aria-label={t("brandHomeAria")}
              className="inline-flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
            >
              <BrandLogo className="h-6 sm:h-7" priority />
            </Link>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-gray-200 sm:inline-block dark:bg-gray-800"
            />
            <span className="hidden items-center gap-1.5 font-mono text-xs font-semibold text-gray-600 sm:inline-flex dark:text-gray-300">
              <PlugInIcon
                className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                aria-hidden="true"
              />
              <span>{ui.headerBadge}</span>
            </span>
          </div>

          {/* Architectural Bottom-Hairline Search Input ('/' shortcut + Escape clear/blur) */}
          <div className="order-3 flex w-full min-w-0 items-center gap-2.5 md:order-2 md:max-w-xs lg:max-w-md">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute start-1 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (searchQuery) {
                      setSearchQuery("");
                    }
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder={ui.searchPlaceholder}
                aria-label={ui.searchAriaLabel}
                className="h-9 w-full rounded-none border-0 border-b border-gray-300 bg-transparent ps-7 pe-8 text-xs text-gray-900 placeholder:text-gray-400 [--field-border:var(--color-gray-300)] focus:[--field-border:var(--color-brand-600)] focus:outline-none dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:[--field-border:var(--color-gray-700)] dark:focus:[--field-border:var(--color-brand-400)]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={ui.clearSearchAria}
                  onClick={() => setSearchQuery("")}
                  className="absolute end-0.5 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <CloseLineIcon className="size-3.5" aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute end-1 top-1/2 hidden -translate-y-1/2 font-mono text-[11px] text-gray-500 sm:inline-block dark:text-gray-400"
                >
                  /
                </kbd>
              )}
            </div>

            {normalizedQuery.length > 0 && (
              <button
                type="button"
                onClick={() => handleJumpToSection("tools")}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-brand-50/90 px-3 text-xs font-semibold whitespace-nowrap text-brand-700 ring-1 ring-brand-600/20 ring-inset transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25 dark:hover:bg-brand-500/25"
              >
                {ui.jumpToMatchingTools.replace(
                  "{count}",
                  String(filteredTools.length),
                )}
              </button>
            )}
          </div>

          {/* Frameless Language Group + ThemeToggle + Rounded-Full CTA Links */}
          <div className="order-2 flex shrink-0 items-center gap-1.5 sm:gap-2 md:order-3">
            <div
              role="group"
              aria-label={ui.langGroupAria}
              className="inline-flex items-center gap-1"
            >
              <button
                type="button"
                aria-pressed={docLang === "vi"}
                onClick={() => handleLangSwitch("vi")}
                className={cn(
                  "min-h-8 cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                  docLang === "vi"
                    ? "bg-brand-50/90 text-brand-700 ring-1 ring-brand-600/25 ring-inset dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-400/30"
                    : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-white",
                )}
              >
                {ui.langViLabel}
              </button>
              <button
                type="button"
                aria-pressed={docLang === "en"}
                onClick={() => handleLangSwitch("en")}
                className={cn(
                  "min-h-8 cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                  docLang === "en"
                    ? "bg-brand-50/90 text-brand-700 ring-1 ring-brand-600/25 ring-inset dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-400/30"
                    : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-white",
                )}
              >
                {ui.langEnLabel}
              </button>
            </div>

            <div className="shrink-0">
              <ThemeToggleButton />
            </div>

            {hasOrgSession ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden min-h-9 items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-300/90 ring-inset transition-colors hover:bg-gray-100/80 lg:inline-flex dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800/80"
                >
                  {ui.workspaceCta}
                </Link>
                <Link
                  href="/organization/integrations"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-700 sm:px-4 dark:bg-brand-500 dark:hover:bg-brand-400"
                >
                  <span>{ui.manageKeysCta}</span>
                  <ArrowRightIcon
                    className="hidden size-3.5 shrink-0 sm:inline-block rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="inline-flex min-h-9 items-center justify-center rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-300/90 ring-inset transition-colors hover:bg-white sm:px-3.5 dark:bg-gray-900/85 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
                >
                  {ui.signInCta}
                </Link>
                <Link
                  href="/signup"
                  className="hidden min-h-9 items-center justify-center rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-700 sm:inline-flex dark:bg-brand-500 dark:hover:bg-brand-400"
                >
                  {ui.getStartedCta}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Open Architectural Hero over Ruled Note Canvas + Work-Note Motif */}
      <section className="relative overflow-hidden border-b border-gray-200/90 dark:border-gray-800/90">
        <div
          className={cn(
            "relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-11 lg:px-8",
            styles.notebookSheet,
          )}
        >
          {/* Decorative Continuum Work-Note Linework Motif (lg+ right margin) */}
          <div aria-hidden="true" className={styles.heroNoteMotif}>
            <svg
              viewBox="0 0 296 176"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-auto w-full"
            >
              <line
                x1="58"
                y1="4"
                x2="58"
                y2="170"
                stroke="currentColor"
                strokeOpacity="0.32"
                strokeWidth="1"
              />
              <line
                x1="61"
                y1="4"
                x2="61"
                y2="170"
                stroke="currentColor"
                strokeOpacity="0.16"
                strokeWidth="1"
              />
              <text
                x="4"
                y="24"
                fill="currentColor"
                fillOpacity="0.72"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="9.5"
                fontWeight="600"
                letterSpacing="0.06em"
              >
                WN-01
              </text>
              <line
                x1="48"
                y1="21"
                x2="58"
                y2="21"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <rect
                x="72"
                y="18"
                width="208"
                height="5"
                fill="currentColor"
                fillOpacity="0.22"
              />
              <rect
                x="72"
                y="30"
                width="164"
                height="3"
                fill="currentColor"
                fillOpacity="0.13"
              />

              <text
                x="4"
                y="88"
                fill="currentColor"
                fillOpacity="0.64"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="9.5"
                fontWeight="600"
                letterSpacing="0.06em"
              >
                WN-104
              </text>
              <line
                x1="48"
                y1="85"
                x2="58"
                y2="85"
                stroke="currentColor"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <rect
                x="72"
                y="82"
                width="216"
                height="5"
                fill="currentColor"
                fillOpacity="0.2"
              />
              <rect
                x="72"
                y="94"
                width="182"
                height="3"
                fill="currentColor"
                fillOpacity="0.12"
              />
              <rect
                x="72"
                y="104"
                width="136"
                height="3"
                fill="currentColor"
                fillOpacity="0.1"
              />

              <text
                x="4"
                y="152"
                fill="currentColor"
                fillOpacity="0.72"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="9.5"
                fontWeight="600"
                letterSpacing="0.06em"
              >
                MCP-36
              </text>
              <line
                x1="48"
                y1="149"
                x2="58"
                y2="149"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <rect
                x="72"
                y="146"
                width="192"
                height="5"
                fill="currentColor"
                fillOpacity="0.18"
              />
              <rect
                x="72"
                y="158"
                width="124"
                height="3"
                fill="currentColor"
                fillOpacity="0.11"
              />
            </svg>
          </div>

          <div className="relative z-10 max-w-3xl space-y-2.5 lg:pe-64 xl:pe-24">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              <LockIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{corpus.hero.eyebrow}</span>
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              {corpus.hero.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6.5 text-gray-600 sm:text-base dark:text-gray-300">
              {corpus.hero.subtitle}
            </p>
          </div>

          {/* Horizontal Hairline Telemetry Bar */}
          <dl className="relative z-10 mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-200/90 pt-4 text-xs tabular-nums dark:border-gray-800/90">
            {[
              {
                label: corpus.hero.protocolStatLabel,
                value: corpus.hero.protocolStatValue,
              },
              {
                label: corpus.hero.toolsStatLabel,
                value: corpus.hero.toolsStatValue,
              },
              {
                label: corpus.hero.subsystemsStatLabel,
                value: corpus.hero.subsystemsStatValue,
              },
              {
                label: corpus.hero.authStatLabel,
                value: corpus.hero.authStatValue,
              },
            ].map((stat, idx) => (
              <div key={stat.label} className="inline-flex items-center gap-2">
                {idx > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden h-3.5 w-px bg-gray-200 sm:inline-block dark:bg-gray-800"
                  />
                )}
                <dt className="font-medium text-gray-500 dark:text-gray-400">
                  {stat.label}:
                </dt>
                <dd className="font-mono font-semibold text-gray-900 dark:text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 3. Main Architectural Documentation Sheet */}
      <main
        className={cn(
          "mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8",
          styles.notebookSheet,
        )}
      >
        {/* Mobile Collapsible TOC */}
        <div className="mb-7 lg:hidden print:hidden">
          <button
            ref={mobileTocToggleRef}
            type="button"
            aria-expanded={mobileTocOpen}
            aria-controls="docs-mobile-toc"
            onClick={() => setMobileTocOpen((prev) => !prev)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-full border border-gray-300/90 bg-white/90 px-4 py-2.5 text-start text-xs font-semibold text-gray-800 backdrop-blur-xs transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100 dark:hover:border-gray-600"
          >
            <span className="tabular-nums">
              {ui.mobileTocToggle.replace(
                "{count}",
                String(corpus.sections.length),
              )}
            </span>
            {mobileTocOpen ? (
              <ChevronUpIcon className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
            )}
          </button>

          {mobileTocOpen && (
            <nav
              id="docs-mobile-toc"
              aria-label={ui.tocHeading}
              className="mt-3 rounded-none border-y border-gray-200/90 bg-white/75 py-1.5 backdrop-blur-xs dark:border-gray-800 dark:bg-gray-950/75"
            >
              <ul className="ms-2 border-s border-gray-200/90 dark:border-gray-800">
                {corpus.sections.map((sec) => {
                  const active = activeSectionId === sec.id;
                  return (
                    <li key={sec.id}>
                      <button
                        type="button"
                        aria-current={active ? "location" : undefined}
                        onClick={() => handleJumpToSection(sec.id)}
                        className={cn(
                          "-ms-px flex w-full cursor-pointer items-center gap-2.5 rounded-none border-s-2 py-2 ps-3.5 pe-3 text-start text-xs transition-colors",
                          active
                            ? "border-brand-600 font-semibold text-brand-700 dark:border-brand-400 dark:text-brand-300"
                            : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-100",
                        )}
                      >
                        <span className="font-mono text-[11px] font-bold tabular-nums opacity-75">
                          {sec.number}
                        </span>
                        <span className="truncate">{sec.shortTitle}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Desktop Frameless Left Architectural Rail */}
          <aside className="hidden lg:col-span-3 lg:block lg:border-e lg:border-gray-200/85 lg:pe-7 dark:lg:border-gray-800/85 print:hidden">
            <div className="sticky top-22 space-y-8">
              <div>
                <h2 className="font-mono text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase dark:text-gray-400">
                  {ui.tocHeading}
                </h2>
                <nav aria-label={ui.tocHeading}>
                  <ul className="mt-3 border-s border-gray-200/90 dark:border-gray-800">
                    {corpus.sections.map((sec) => {
                      const active = activeSectionId === sec.id;
                      return (
                        <li key={sec.id}>
                          <button
                            type="button"
                            aria-current={active ? "location" : undefined}
                            onClick={() => handleJumpToSection(sec.id)}
                            className={cn(
                              "group -ms-px flex w-full cursor-pointer items-center gap-2.5 rounded-none border-s-2 py-2 ps-3.5 pe-2 text-start text-xs transition-colors",
                              active
                                ? "border-brand-600 font-semibold text-brand-700 dark:border-brand-400 dark:text-brand-300"
                                : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-100",
                            )}
                          >
                            <span
                              className={cn(
                                "font-mono text-[11px] font-semibold tabular-nums",
                                active
                                  ? "text-brand-700 dark:text-brand-300"
                                  : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200",
                              )}
                            >
                              {sec.number}
                            </span>
                            <span className="truncate">{sec.shortTitle}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              <div className="border-t border-gray-200/85 pt-6 dark:border-gray-800/85">
                <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase dark:text-gray-400">
                  {ui.endpointCardHeading}
                </p>
                <code className="mt-2.5 block truncate rounded-none border-s-2 border-brand-600 bg-gray-950 px-3 py-2 font-mono text-[11px] text-emerald-300 dark:border-brand-400">
                  POST /api/v1/mcp
                </code>
                <Link
                  href={keysDestinationHref}
                  className="mt-3.5 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full bg-brand-50/90 px-3.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/20 ring-inset transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25 dark:hover:bg-brand-500/25"
                >
                  <span>
                    {hasOrgSession ? ui.manageKeysCta : ui.signInCta}
                  </span>
                  <ArrowRightIcon
                    className="size-3.5 shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Specification Ledger Surface */}
          <div className="min-w-0 space-y-12 lg:col-span-9">
            {/* SECTION 01: OVERVIEW & 6-SUBSYSTEM ARCHITECTURE */}
            <section
              id="overview"
              aria-labelledby="docs-heading-overview"
              className="min-w-0 scroll-mt-40 border-b border-gray-200/85 pb-12 sm:scroll-mt-36 md:scroll-mt-24 dark:border-gray-800/90"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                  01
                </span>
                <h2
                  id="docs-heading-overview"
                  className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
                >
                  {corpus.sections[0].title}
                </h2>
              </div>

              <div className="mt-4 max-w-3xl space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {corpus.overview.rationaleTitle}
                </h3>
                {corpus.overview.rationaleParagraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-sm leading-6.5 text-gray-600 dark:text-gray-300"
                  >
                    {para}
                  </p>
                ))}
              </div>

              {/* Connected Horizontal 4-Stage Pipeline Bar + Frameless Left-Rule Inspector */}
              <div className="mt-8">
                <div className="max-w-3xl">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {corpus.overview.pipelineTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {corpus.overview.pipelineSubtitle}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 border-b border-gray-200/90 sm:grid-cols-4 dark:border-gray-800">
                  {corpus.overview.stages.map((stage, idx) => {
                    const selected = stage.id === activeStage.id;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={cn(
                          "-mb-px flex min-w-0 cursor-pointer flex-col items-start rounded-none border-b-2 px-3 py-3 text-start transition-colors",
                          selected
                            ? "border-brand-600 text-gray-900 dark:border-brand-400 dark:text-white"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200",
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold tabular-nums">
                          <span
                            className={
                              selected
                                ? "text-brand-600 dark:text-brand-400"
                                : "text-gray-500 dark:text-gray-400"
                            }
                          >
                            {stage.step}
                          </span>
                          {idx < corpus.overview.stages.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="hidden text-gray-300 sm:inline dark:text-gray-700"
                            >
                              →
                            </span>
                          )}
                        </span>
                        <span className="mt-1 line-clamp-1 text-xs font-semibold">
                          {stage.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 min-w-0 rounded-none border-s-2 border-brand-600 bg-white/55 py-3.5 ps-5 pe-3 dark:border-brand-400 dark:bg-gray-950/45">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {activeStage.step} — {activeStage.title}
                    </span>
                    <code className="rounded-none font-mono text-[11px] font-medium [overflow-wrap:anywhere] text-brand-700 dark:text-brand-300">
                      {activeStage.protocolTag}
                    </code>
                  </div>
                  <p className="mt-2 max-w-3xl text-xs leading-5.5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">
                    {activeStage.summary}
                  </p>
                  <ul className="mt-3.5 space-y-1.5 border-t border-gray-200/75 pt-3 dark:border-gray-800/80">
                    {activeStage.invariants.map((inv, idx) => (
                      <li
                        key={idx}
                        className="flex min-w-0 items-start gap-2 text-xs text-gray-700 dark:text-gray-300"
                      >
                        <CheckCircleIcon
                          className="mt-0.5 size-3.5 shrink-0 text-success-600 dark:text-success-400"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {inv}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 2x3 Architectural Hairline Subsystem Matrix */}
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  {corpus.overview.subsystemsTitle}
                </h3>
                <div className="grid grid-cols-1 rounded-none border-y border-gray-200/90 bg-white/45 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-950/35">
                  {corpus.overview.subsystems.map((sys, idx) => {
                    const total = corpus.overview.subsystems.length;
                    const isLastRowDesktop = idx >= total - 2;
                    const isLastItem = idx === total - 1;
                    return (
                      <div
                        key={sys.code}
                        className={cn(
                          "flex min-w-0 flex-col justify-between gap-3 px-4 py-4 sm:px-5",
                          !isLastItem &&
                            "border-b border-gray-200/85 dark:border-gray-800",
                          isLastRowDesktop && !isLastItem && "md:border-b-0",
                          idx % 2 === 1 &&
                            "md:border-s md:border-gray-200/85 dark:md:border-gray-800",
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                            {sys.code}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {sys.name}
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                              {sys.summary}
                            </p>
                          </div>
                        </div>

                        <div className="ps-7">
                          <button
                            type="button"
                            onClick={() =>
                              handleJumpToSubsystemTools(sys.domain)
                            }
                            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-brand-50/90 px-3 font-mono text-xs font-semibold whitespace-nowrap text-brand-700 ring-1 ring-brand-600/20 ring-inset transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25 dark:hover:bg-brand-500/25"
                          >
                            <span>
                              {ui.subsystemToolsCount.replace(
                                "{count}",
                                String(sys.toolCount),
                              )}
                            </span>
                            <ArrowRightIcon
                              className="size-3.5 shrink-0 rtl:rotate-180"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 02: ASYMMETRIC 2-COLUMN QUICKSTART & 7-CLIENT CONFIGURATOR */}
            <section
              id="quickstart"
              aria-labelledby="docs-heading-quickstart"
              className="min-w-0 scroll-mt-40 border-b border-gray-200/85 pb-12 sm:scroll-mt-36 md:scroll-mt-24 dark:border-gray-800/90"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                  02
                </span>
                <h2
                  id="docs-heading-quickstart"
                  className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
                >
                  {corpus.sections[1].title}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                {corpus.quickstart.subtitle}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Left Column: Hairline Stepper + Frameless Endpoint Pill Group */}
                <div className="min-w-0 space-y-6 lg:col-span-5">
                  <ol className="space-y-5 border-s border-gray-300 ps-5 dark:border-gray-700">
                    {corpus.quickstart.steps.map((item, idx) => (
                      <li key={item.step} className="space-y-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-[11px] font-bold text-brand-600 tabular-nums dark:text-brand-400">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-sm font-semibold [overflow-wrap:anywhere] text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                        </div>
                        <p className="text-xs leading-5.5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-400">
                          {item.body}
                        </p>
                      </li>
                    ))}
                  </ol>

                  <div className="space-y-2 border-t border-gray-200/85 pt-4 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {corpus.quickstart.configuratorTitle}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {corpus.quickstart.configuratorSubtitle}
                    </p>
                    <div
                      role="group"
                      aria-label={ui.endpointModeAriaLabel}
                      className="mt-2.5 flex flex-wrap items-center gap-2"
                    >
                      <button
                        type="button"
                        aria-pressed={endpointMode === "direct"}
                        onClick={() => {
                          userToggledEndpointRef.current = true;
                          setEndpointMode("direct");
                        }}
                        className={cn(
                          "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                          endpointMode === "direct"
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
                            : "bg-white/80 text-gray-700 ring-1 ring-gray-300/90 ring-inset hover:bg-white dark:bg-gray-900/80 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800",
                        )}
                      >
                        {ui.endpointDirectLabel}
                      </button>
                      <button
                        type="button"
                        aria-pressed={endpointMode === "bff"}
                        onClick={() => {
                          userToggledEndpointRef.current = true;
                          setEndpointMode("bff");
                        }}
                        className={cn(
                          "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                          endpointMode === "bff"
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
                            : "bg-white/80 text-gray-700 ring-1 ring-gray-300/90 ring-inset hover:bg-white dark:bg-gray-900/80 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800",
                        )}
                      >
                        {ui.endpointBffLabel}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sharp Architectural Dark Terminal */}
                <div className="min-w-0 lg:col-span-7">
                  <div className="overflow-hidden rounded-none border-y border-gray-800 bg-gray-950 lg:border-s-2 lg:border-s-brand-500">
                    <div
                      role="tablist"
                      aria-label={corpus.quickstart.configuratorTitle}
                      className="flex flex-wrap gap-1.5 border-b border-gray-800 bg-gray-900/95 px-3 py-2.5"
                    >
                      {MCP_IDE_CLIENT_SPECS.map((spec, idx) => {
                        const selected = spec.id === activeIdeSpec.id;
                        return (
                          <button
                            key={spec.id}
                            ref={(el) => {
                              ideTabRefs.current[spec.id] = el;
                            }}
                            id={`docs-ide-tab-${spec.id}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`docs-ide-panel-${spec.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setActiveIdeClient(spec.id)}
                            onKeyDown={(event) =>
                              handleIdeTabKeyDown(event, idx)
                            }
                            className={cn(
                              "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
                              selected
                                ? "bg-brand-600 text-white"
                                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100",
                            )}
                          >
                            {spec.label}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      id={`docs-ide-panel-${activeIdeSpec.id}`}
                      role="tabpanel"
                      aria-labelledby={`docs-ide-tab-${activeIdeSpec.id}`}
                      className="min-w-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/90 bg-gray-900/60 px-4 py-2">
                        <span className="min-w-0 truncate font-mono text-xs text-slate-400">
                          {ui.targetFileLabel}{" "}
                          <span className="text-slate-200">
                            {activeIdeSpec.targetFile}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy(
                              `quickstart-${activeIdeSpec.id}`,
                              quickstartSnippet,
                            )
                          }
                          className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gray-800 px-3 text-xs font-semibold text-gray-100 ring-1 ring-gray-700 ring-inset transition-colors hover:bg-gray-700"
                        >
                          {copiedId === `quickstart-${activeIdeSpec.id}` ? (
                            <>
                              <CheckLineIcon
                                className="size-3.5 text-emerald-400"
                                aria-hidden="true"
                              />
                              <span className="text-emerald-300">
                                {ui.copiedCta}
                              </span>
                            </>
                          ) : (
                            <>
                              <CopyIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              <span>{ui.copyCta}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre
                        data-testid="docs-ide-config-pre"
                        className="max-w-full overflow-x-auto rounded-none p-4 font-mono text-xs leading-6 text-slate-100"
                      >
                        <code>
                          {renderSyntaxTintedSnippet(
                            quickstartSnippet,
                            activeIdeSpec.language,
                          )}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 03: AUTHENTICATION, SCOPES & ACCESS BOUNDARIES */}
            <section
              id="security"
              aria-labelledby="docs-heading-security"
              className="min-w-0 scroll-mt-40 border-b border-gray-200/85 pb-12 sm:scroll-mt-36 md:scroll-mt-24 dark:border-gray-800/90"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                  03
                </span>
                <h2
                  id="docs-heading-security"
                  className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
                >
                  {corpus.sections[2].title}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                {corpus.security.subtitle}
              </p>

              {/* 2x2 Architectural Hairline Security Controls Grid */}
              <ul className="mt-5 grid grid-cols-1 rounded-none border-y border-gray-200/90 bg-white/45 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-950/35">
                {corpus.security.controls.map((ctrl, idx) => {
                  const total = corpus.security.controls.length;
                  const isLastRowDesktop = idx >= total - 2;
                  const isLastItem = idx === total - 1;
                  return (
                    <li
                      key={ctrl.code}
                      className={cn(
                        "flex min-w-0 items-start gap-3.5 px-4 py-4 sm:px-5",
                        !isLastItem &&
                          "border-b border-gray-200/85 dark:border-gray-800",
                        isLastRowDesktop && !isLastItem && "md:border-b-0",
                        idx % 2 === 1 &&
                          "md:border-s md:border-gray-200/85 dark:md:border-gray-800",
                      )}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                        {ctrl.code}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold [overflow-wrap:anywhere] text-gray-900 dark:text-white">
                          {ctrl.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5.5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-400">
                          {ctrl.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* 3-Scope Architectural Comparison Table */}
              <h3 className="mt-7 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {corpus.security.tiersTitle}
              </h3>
              <div className="max-w-full overflow-x-auto rounded-none border-y border-gray-200/90 bg-white/55 dark:border-gray-800 dark:bg-gray-950/45">
                <table className="w-full min-w-[560px] divide-y divide-gray-200/90 text-start text-xs dark:divide-gray-800">
                  <thead className="bg-gray-100/60 dark:bg-gray-900/60">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-start font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {docLang === "vi" ? "Tầng quyền" : "Scope"}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-start font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {docLang === "vi" ? "Số lượng công cụ" : "Tools"}
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-start font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {docLang === "vi" ? "Phạm vi thao tác" : "Capabilities"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/75 dark:divide-gray-800/80">
                    {corpus.security.tiers.map((tier) => (
                      <tr key={tier.scope} className="align-top">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <ScopeIndicator scope={tier.scope} />
                          <p className="mt-1.5 font-semibold text-gray-900 dark:text-white">
                            {tier.title}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-medium whitespace-nowrap text-gray-700 tabular-nums dark:text-gray-300">
                          {tier.badge.split("·")[1]?.trim() ?? tier.badge}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-gray-600 dark:text-gray-300">
                            {tier.summary}
                          </p>
                          <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                            {tier.capabilities.map((cap, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircleIcon
                                  className="mt-0.5 size-3.5 shrink-0 text-success-600 dark:text-success-400"
                                  aria-hidden="true"
                                />
                                <span>{cap}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 04: 36-TOOL ARCHITECTURAL REFERENCE EXPLORER */}
            <section
              id="tools"
              aria-labelledby="docs-heading-tools"
              className="min-w-0 scroll-mt-40 border-b border-gray-200/85 pb-12 sm:scroll-mt-36 md:scroll-mt-24 dark:border-gray-800/90"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                    04
                  </span>
                  <h2
                    id="docs-heading-tools"
                    className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
                  >
                    {corpus.sections[3].title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={toggleAllFilteredTools}
                  className="inline-flex h-8 cursor-pointer items-center rounded-full bg-white/85 px-3.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300/90 ring-inset transition-colors hover:bg-white dark:bg-gray-900/85 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
                >
                  {allFilteredExpanded
                    ? ui.collapseAllTools
                    : ui.expandAllTools}
                </button>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                {corpus.toolsExplorer.subtitle}
              </p>

              {/* Horizontal Underline Subsystem Filter Strip */}
              <div
                role="group"
                aria-label={ui.filterDomainAriaLabel}
                className="mt-5 flex flex-wrap gap-x-1 gap-y-1 border-b border-gray-200/90 dark:border-gray-800"
              >
                <button
                  type="button"
                  aria-pressed={selectedDomain === "ALL"}
                  onClick={() => setSelectedDomain("ALL")}
                  className={cn(
                    "-mb-px cursor-pointer rounded-none border-b-2 px-3 py-2 text-xs font-semibold tabular-nums transition-colors",
                    selectedDomain === "ALL"
                      ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200",
                  )}
                >
                  {ui.allDomainsLabel} ({CONTINUUM_MCP_TOOLS.length})
                </button>
                {MCP_TOOL_DOMAIN_ORDER.map((domainId) => {
                  const active = selectedDomain === domainId;
                  return (
                    <button
                      key={domainId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedDomain(domainId)}
                      className={cn(
                        "-mb-px cursor-pointer rounded-none border-b-2 px-3 py-2 text-xs font-semibold tabular-nums transition-colors",
                        active
                          ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                          : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200",
                      )}
                    >
                      {corpus.toolsExplorer.domainLabels[domainId]} (
                      {domainCounts[domainId]})
                    </button>
                  );
                })}
              </div>

              {/* Capability Scope Pill Filter Toolbar + Live Counter */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label={ui.filterScopeAriaLabel}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      { id: "ALL" as const, label: ui.allScopesLabel },
                      {
                        id: "READ_ONLY" as const,
                        label: `READ_ONLY (${scopeCounts.READ_ONLY})`,
                      },
                      {
                        id: "READ_WRITE" as const,
                        label: `READ_WRITE (${scopeCounts.READ_WRITE})`,
                      },
                      {
                        id: "FULL_OPERATIONS" as const,
                        label: `FULL_OPERATIONS (${scopeCounts.FULL_OPERATIONS})`,
                      },
                    ] as const
                  ).map((tier) => {
                    const active = selectedScope === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedScope(tier.id)}
                        className={cn(
                          "cursor-pointer rounded-full px-3 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                          active
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                            : "bg-white/80 text-gray-600 ring-1 ring-gray-300/85 ring-inset hover:bg-white dark:bg-gray-900/80 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800",
                        )}
                      >
                        {tier.label}
                      </button>
                    );
                  })}
                </div>

                <span
                  data-testid="docs-tools-count"
                  role="status"
                  aria-live="polite"
                  className="font-mono text-xs font-medium text-gray-500 tabular-nums dark:text-gray-400"
                >
                  {ui.matchingToolsCount
                    .replace("{count}", String(filteredTools.length))
                    .replace("{total}", String(CONTINUUM_MCP_TOOLS.length))}
                </span>
              </div>

              {/* Frameless Border-Y Architectural Tool Ledger */}
              {filteredTools.length === 0 ? (
                <div className="mt-4 rounded-none border-y border-dashed border-gray-300 py-10 text-center dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {ui.emptyToolsTitle}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {ui.emptyToolsDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDomain("ALL");
                      setSelectedScope("ALL");
                      setSearchQuery("");
                    }}
                    className="mt-4 inline-flex h-8 cursor-pointer items-center rounded-full bg-brand-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
                  >
                    {ui.resetFiltersCta}
                  </button>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-gray-200/85 rounded-none border-y border-gray-200/90 dark:divide-gray-800/85 dark:border-gray-800">
                  {filteredTools.map((tool) => {
                    const isExpanded = Boolean(expandedTools[tool.name]);
                    const rpcPayload = buildToolJsonRpcPayload(tool);
                    const copyKey = `rpc-${tool.name}`;

                    return (
                      <article
                        key={tool.name}
                        id={`mcp-tool-anchor-${tool.name}`}
                        data-testid={`mcp-tool-card-${tool.name}`}
                        className="min-w-0 scroll-mt-36"
                      >
                        <div className="flex flex-col gap-3 px-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <code className="font-mono text-xs font-bold break-all text-gray-900 sm:text-sm sm:break-normal dark:text-white">
                                {tool.name}
                              </code>
                              <ScopeIndicator scope={tool.minScope} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ·{" "}
                                {corpus.toolsExplorer.domainLabels[tool.domain]}
                              </span>
                            </div>
                            {tool.escalationNote && (
                              <p className="font-mono text-[11px] font-medium [overflow-wrap:anywhere] text-warning-700 dark:text-warning-300">
                                ↳ {tool.escalationNote[docLang]}
                              </p>
                            )}
                            <p className="max-w-3xl text-xs leading-5.5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">
                              {tool.summary[docLang]}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={`tool-schema-${tool.name}`}
                            onClick={() =>
                              setExpandedTools((prev) => ({
                                ...prev,
                                [tool.name]: !prev[tool.name],
                              }))
                            }
                            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-full bg-white/80 px-3 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-300/85 ring-inset transition-colors hover:bg-white hover:text-gray-900 dark:bg-gray-900/80 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                          >
                            <span>
                              {isExpanded
                                ? ui.hideSchemaCta
                                : ui.inspectSchemaCta}
                            </span>
                            {isExpanded ? (
                              <ChevronUpIcon
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDownIcon
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>

                        {/* Expanded Schema Drawer: Left Accent Rule + Sharp Tables & Terminal */}
                        {isExpanded && (
                          <div
                            id={`tool-schema-${tool.name}`}
                            className="ms-1 mb-3 min-w-0 space-y-4 rounded-none border-s-2 border-brand-600/75 bg-white/65 py-4 ps-4 pe-2 sm:ps-5 dark:border-brand-400/75 dark:bg-gray-950/60"
                          >
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                              <span>
                                {corpus.toolsExplorer.hintLabels.readOnly}:{" "}
                                <strong className="text-gray-800 dark:text-gray-200">
                                  {String(tool.annotations.readOnlyHint)}
                                </strong>
                              </span>
                              <span>
                                {corpus.toolsExplorer.hintLabels.idempotent}:{" "}
                                <strong className="text-gray-800 dark:text-gray-200">
                                  {String(tool.annotations.idempotentHint)}
                                </strong>
                              </span>
                              <span
                                className={
                                  tool.annotations.destructiveHint
                                    ? "text-warning-700 dark:text-warning-300"
                                    : undefined
                                }
                              >
                                {corpus.toolsExplorer.hintLabels.destructive}:{" "}
                                <strong className="font-semibold">
                                  {String(tool.annotations.destructiveHint)}
                                </strong>
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h4 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                                {ui.paramsHeading}
                              </h4>
                              {tool.params.length === 0 ? (
                                <p className="text-xs italic text-gray-500 dark:text-gray-400">
                                  {ui.noParamsNote}
                                </p>
                              ) : (
                                <div className="max-w-full overflow-x-auto rounded-none border-y border-gray-200/90 bg-white/60 dark:border-gray-800 dark:bg-gray-950/55">
                                  <table className="w-full min-w-[520px] divide-y divide-gray-200/90 text-start text-xs dark:divide-gray-800">
                                    <thead className="bg-gray-100/60 dark:bg-gray-900/60">
                                      <tr>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-start font-semibold text-gray-600 dark:text-gray-300"
                                        >
                                          {ui.paramColName}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-start font-semibold text-gray-600 dark:text-gray-300"
                                        >
                                          {ui.paramColType}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-start font-semibold whitespace-nowrap text-gray-600 dark:text-gray-300"
                                        >
                                          {ui.paramColRequired}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-start font-semibold text-gray-600 dark:text-gray-300"
                                        >
                                          {ui.paramColDesc}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200/75 dark:divide-gray-800/80">
                                      {tool.params.map((param) => (
                                        <tr key={param.name}>
                                          <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap text-gray-900 dark:text-white">
                                            {param.name}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-brand-700 dark:text-brand-300">
                                            {param.type}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            {param.required ? (
                                              <span className="font-mono text-[10px] font-bold whitespace-nowrap text-brand-700 uppercase dark:text-brand-300">
                                                {ui.requiredYes}
                                              </span>
                                            ) : (
                                              <span className="text-[11px] whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                {ui.requiredNo}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                            {param.description[docLang]}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 overflow-hidden rounded-none border-y border-gray-800 bg-gray-950">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-gray-900 px-3.5 py-2">
                                <span className="font-mono text-[11px] text-slate-300">
                                  {ui.examplePayloadHeading}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopy(copyKey, rpcPayload)
                                  }
                                  className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-gray-800 px-3 text-[11px] font-semibold whitespace-nowrap text-gray-100 ring-1 ring-gray-700 ring-inset transition-colors hover:bg-gray-700"
                                >
                                  {copiedId === copyKey ? (
                                    <>
                                      <CheckLineIcon
                                        className="size-3 text-emerald-400"
                                        aria-hidden="true"
                                      />
                                      <span className="text-emerald-300">
                                        {ui.copiedJsonRpcCta}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <CopyIcon
                                        className="size-3"
                                        aria-hidden="true"
                                      />
                                      <span>{ui.copyJsonRpcCta}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="max-w-full overflow-x-auto rounded-none p-3.5 font-mono text-xs leading-5.5 text-slate-100">
                                <code>
                                  {renderSyntaxTintedSnippet(
                                    rpcPayload,
                                    "json",
                                  )}
                                </code>
                              </pre>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECTION 05: MCP RESOURCES, PROMPTS & 3-TAB PLAYBOOK TIMELINE */}
            <section
              id="resources-prompts"
              aria-labelledby="docs-heading-resources"
              className="min-w-0 scroll-mt-40 sm:scroll-mt-36 md:scroll-mt-24"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs font-bold text-brand-600 tabular-nums dark:text-brand-400">
                  05
                </span>
                <h2
                  id="docs-heading-resources"
                  className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
                >
                  {corpus.sections[4].title}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                {corpus.resourcesAndPrompts.subtitle}
              </p>

              {/* 2-Column Architectural Hairline Split for MCP Resources */}
              <h3 className="mt-6 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {corpus.resourcesAndPrompts.resourcesHeading}
              </h3>
              <div className="grid grid-cols-1 rounded-none border-y border-gray-200/90 bg-white/45 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-950/35">
                {corpus.resourcesAndPrompts.resources.map((res, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={res.uri}
                      className={cn(
                        "flex min-w-0 flex-col justify-between gap-3 px-4 py-4 sm:px-5",
                        isFirst &&
                          "border-b border-gray-200/85 md:border-b-0 dark:border-gray-800",
                        !isFirst &&
                          "md:border-s md:border-gray-200/85 dark:md:border-gray-800",
                      )}
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <code className="font-mono text-xs font-bold break-all text-gray-900 sm:break-normal dark:text-white">
                            {res.uri}
                          </code>
                          <span className="font-mono text-[11px] font-medium text-brand-700 dark:text-brand-300">
                            {res.kind} · {res.mimeType}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {res.title}
                        </h4>
                        <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
                          {res.description}
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          aria-label={`${ui.copyCta} ${res.uri}`}
                          onClick={() => void handleCopy(res.uri, res.uri)}
                          className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-white/85 px-3 text-[11px] font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-300/85 ring-inset transition-colors hover:bg-white dark:bg-gray-900/85 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800"
                        >
                          {copiedId === res.uri ? ui.copiedCta : ui.copyCta}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2x2 Architectural Hairline Grid for MCP Prompts */}
              <h3 className="mt-7 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {corpus.resourcesAndPrompts.promptsHeading}
              </h3>
              <div className="grid grid-cols-1 rounded-none border-y border-gray-200/90 bg-white/45 md:grid-cols-2 dark:border-gray-800 dark:bg-gray-950/35">
                {corpus.resourcesAndPrompts.prompts.map((prompt, idx) => {
                  const total = corpus.resourcesAndPrompts.prompts.length;
                  const isLastRowDesktop = idx >= total - 2;
                  const isLastItem = idx === total - 1;
                  return (
                    <div
                      key={prompt.name}
                      className={cn(
                        "min-w-0 space-y-1.5 px-4 py-4 sm:px-5",
                        !isLastItem &&
                          "border-b border-gray-200/85 dark:border-gray-800",
                        isLastRowDesktop && !isLastItem && "md:border-b-0",
                        idx % 2 === 1 &&
                          "md:border-s md:border-gray-200/85 dark:md:border-gray-800",
                      )}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <code className="font-mono text-xs font-bold [overflow-wrap:anywhere] text-brand-700 dark:text-brand-300">
                          {prompt.name}
                        </code>
                        <code className="font-mono text-[11px] [overflow-wrap:anywhere] text-gray-500 dark:text-gray-400">
                          {prompt.argumentsSignature}
                        </code>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                        {prompt.title}
                      </h4>
                      <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
                        {prompt.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Frameless 3-Tab Playbook Switcher & Open Vertical Timeline */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {corpus.resourcesAndPrompts.playbooksHeading}
                </h3>
                <p className="mt-0.5 max-w-3xl text-xs text-gray-500 dark:text-gray-400">
                  {corpus.resourcesAndPrompts.playbooksSubtitle}
                </p>

                <div
                  role="tablist"
                  aria-label={corpus.resourcesAndPrompts.playbooksHeading}
                  className="mt-4 flex flex-wrap gap-x-1 border-b border-gray-200/90 dark:border-gray-800"
                >
                  {corpus.resourcesAndPrompts.playbooks.map((pb, idx) => {
                    const selected = pb.id === activePlaybook.id;
                    return (
                      <button
                        key={pb.id}
                        ref={(el) => {
                          playbookTabRefs.current[pb.id] = el;
                        }}
                        id={`docs-playbook-tab-${pb.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`docs-playbook-panel-${pb.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setActivePlaybookId(pb.id)}
                        onKeyDown={(event) =>
                          handlePlaybookTabKeyDown(event, idx)
                        }
                        className={cn(
                          "-mb-px cursor-pointer rounded-none border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                          selected
                            ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                            : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200",
                        )}
                      >
                        {pb.badge}
                      </button>
                    );
                  })}
                </div>

                <div
                  id={`docs-playbook-panel-${activePlaybook.id}`}
                  role="tabpanel"
                  aria-labelledby={`docs-playbook-tab-${activePlaybook.id}`}
                  className="rounded-none pt-5 pb-2"
                >
                  <h4 className="text-sm font-semibold text-gray-900 sm:text-base dark:text-white">
                    {activePlaybook.title}
                  </h4>
                  <p className="mt-1 max-w-3xl text-xs leading-5.5 text-gray-600 dark:text-gray-400">
                    {activePlaybook.scenario}
                  </p>

                  <ol className="mt-5 space-y-4 border-s border-gray-300 ps-5 dark:border-gray-700">
                    {activePlaybook.steps.map((step, sIdx) => (
                      <li key={sIdx} className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-[11px] font-bold text-brand-600 tabular-nums dark:text-brand-400">
                            {String(sIdx + 1).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleJumpToPlaybookTool(step.tool)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-brand-50/90 px-3 py-1 font-mono text-xs font-bold break-all text-brand-700 ring-1 ring-brand-600/20 ring-inset transition-colors hover:bg-brand-100 sm:break-normal dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25 dark:hover:bg-brand-500/25"
                          >
                            <code>{step.tool}</code>
                            <ArrowRightIcon
                              className="size-3 shrink-0 rtl:rotate-180"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                        <p className="max-w-3xl text-xs leading-5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-300">
                          {step.detail}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* 4. Flush Canonical Continuum Public Footer */}
      <footer className="mt-12 border-t border-gray-200/90 bg-white/75 backdrop-blur-xs dark:border-gray-800 dark:bg-gray-950/75">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:text-gray-400">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {ui.footerCopyright}
          </p>
          <nav
            aria-label={
              docLang === "vi" ? "Liên kết chân trang" : "Footer navigation"
            }
            className="flex flex-wrap items-center gap-4 font-medium print:hidden"
          >
            <Link
              href="/"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {ui.footerHomeLink}
            </Link>
            <Link
              href={keysDestinationHref}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {ui.footerIntegrationsLink}
            </Link>
            <Link
              href="/terms"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {ui.footerTermsLink}
            </Link>
            <Link
              href="/privacy"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {ui.footerPrivacyLink}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
