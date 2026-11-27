"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import {
  useCreateMcpApiKeyMutation,
  useMcpApiKeysQuery,
  useRevokeMcpApiKeyMutation,
} from "@/lib/queries/mcp-keys/useMcpApiKeys";
import type {
  McpApiKeyView,
  McpKeyScopeMode,
} from "@/lib/queries/mcp-keys/mcp-keys.types";
import {
  MCP_IDE_CLIENT_SPECS,
  MCP_PLACEHOLDER_TOKEN,
  resolvePublicMcpEndpoints,
  type McpEndpointMode,
  type McpIdeClientId,
} from "@/lib/mcp-client-configs";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ANIMATE_UI_ICON_SPRING,
  useHydratedReducedMotion,
} from "@/components/ui/button/buttonMotion";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  InfoIcon,
  LockIcon,
  PlugInIcon,
  PlusIcon,
  SearchIcon,
  TrashBinIcon,
} from "@/icons";
import { cn } from "@/utils";
import { writeClipboardText } from "@/utils/clipboard";
import CreateMcpKeySheet, {
  type ExpirationPreset,
} from "./CreateMcpKeySheet";

function renderModalPortal(node: ReactNode): ReactNode {
  if (typeof document === "undefined") {
    return node;
  }
  return createPortal(node, document.body);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ScopeBadge({
  scope,
  label,
}: {
  scope: McpKeyScopeMode;
  label: string;
}) {
  const dotClass =
    scope === "READ_ONLY"
      ? "bg-success-600 dark:bg-success-400"
      : scope === "READ_WRITE"
        ? "bg-blue-light-600 dark:bg-blue-light-400"
        : "bg-gray-900 dark:bg-brand-400";

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap text-gray-800 dark:text-gray-200">
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", dotClass)}
      />
      <span>{label}</span>
    </span>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: McpApiKeyView["status"];
  label: string;
}) {
  const textClass =
    status === "ACTIVE"
      ? "text-gray-900 dark:text-gray-100"
      : status === "EXPIRED"
        ? "text-warning-700 dark:text-warning-300"
        : "text-gray-500 dark:text-gray-400";

  const dotClass =
    status === "ACTIVE"
      ? "bg-success-500"
      : status === "EXPIRED"
        ? "bg-warning-500"
        : "bg-gray-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        textClass,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", dotClass)}
      />
      <span>{label}</span>
    </span>
  );
}

function renderSyntaxTintedSnippet(
  snippet: string,
  language: "json" | "bash",
  wrapCode = false,
): ReactNode {
  if (language === "json") {
    const lines = snippet.split("\n");
    return lines.map((line, lineIdx) => {
      const nl = lineIdx < lines.length - 1 ? "\n" : "";
      const keyValueMatch = /^(\s*)("(?:\\.|[^"\\])*")(\s*:\s*)(.*)$/.exec(
        line,
      );
      let lineContent: ReactNode;
      if (keyValueMatch) {
        const [, indent, keyToken, colon, rest] = keyValueMatch;
        const strValMatch = /^("(?:\\.|[^"\\])*")(,?)$/.exec(rest);
        if (strValMatch) {
          lineContent = (
            <>
              {indent}
              <span className="text-slate-700 dark:text-slate-300">
                {keyToken}
              </span>
              <span className="text-slate-400 dark:text-slate-500">{colon}</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                {strValMatch[1]}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {strValMatch[2]}
              </span>
            </>
          );
        } else {
          lineContent = (
            <>
              {indent}
              <span className="text-slate-700 dark:text-slate-300">
                {keyToken}
              </span>
              <span className="text-slate-400 dark:text-slate-500">{colon}</span>
              <span className="text-slate-800 dark:text-slate-200">{rest}</span>
            </>
          );
        }
      } else {
        const arrayStringMatch = /^(\s*)("(?:\\.|[^"\\])*")(,?)$/.exec(line);
        if (arrayStringMatch) {
          lineContent = (
            <>
              {arrayStringMatch[1]}
              <span className="text-emerald-700 dark:text-emerald-300">
                {arrayStringMatch[2]}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {arrayStringMatch[3]}
              </span>
            </>
          );
        } else {
          lineContent = (
            <span className="text-slate-500 dark:text-slate-400">{line}</span>
          );
        }
      }

      return (
        <span
          key={lineIdx}
          data-line={lineIdx + 1}
          className={cn(
            "block before:me-4 before:inline-block before:w-5 before:text-right before:text-slate-400 before:select-none before:content-[attr(data-line)] dark:before:text-slate-500",
            wrapCode && "whitespace-pre-wrap [overflow-wrap:anywhere]",
          )}
        >
          {lineContent}
          {nl}
        </span>
      );
    });
  }

  const tokens = snippet.match(/"(?:\\.|[^"\\])*"|\s+|\S+/g) ?? [snippet];
  return (
    <span
      data-prompt="$"
      className={cn(
        "block before:me-2.5 before:font-semibold before:text-brand-600 before:select-none before:content-[attr(data-prompt)] dark:before:text-brand-400",
        wrapCode && "whitespace-pre-wrap [overflow-wrap:anywhere]",
      )}
    >
      {tokens.map((token, idx) => {
        if (/^\s+$/.test(token)) {
          return <span key={idx}>{token}</span>;
        }
        if (idx === 0) {
          return (
            <span
              key={idx}
              className="font-semibold text-brand-700 dark:text-sky-300"
            >
              {token}
            </span>
          );
        }
        if (token.startsWith("-")) {
          return (
            <span key={idx} className="text-brand-700 dark:text-sky-300">
              {token}
            </span>
          );
        }
        if (token.startsWith('"')) {
          return (
            <span key={idx} className="text-emerald-700 dark:text-emerald-300">
              {token}
            </span>
          );
        }
        return (
          <span key={idx} className="text-slate-800 dark:text-slate-200">
            {token}
          </span>
        );
      })}
    </span>
  );
}

export default function OrganizationIntegrationsManager() {
  const t = useTranslations("organizationIntegrations");
  const format = useFormatter();
  const shouldReduceMotion = useHydratedReducedMotion();
  const currentUser = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const user = userAccessLost ? undefined : currentUser.data;
  const organizationId =
    user && "organizationId" in user ? (user.organizationId ?? "") : "";
  const validOrg = Boolean(
    user &&
      user.context !== "ACCOUNT" &&
      organizationId &&
      isOrganizationResourceId(organizationId),
  );
  const workspaceScopeKey = `${user?.id ?? ""}:${organizationId}`;

  const keysQuery = useMcpApiKeysQuery(
    user?.id ?? "",
    organizationId,
    validOrg,
  );
  const keysAccessLost = isAccessOrResourceUnavailableError(keysQuery.error);
  const visibleData = keysAccessLost ? undefined : keysQuery.data;

  const projectsQuery = useProjectsQuery(
    organizationId,
    { page: 1, pageSize: 100, status: "ACTIVE", includeTotal: false },
    { enabled: validOrg, staleTime: 30_000, refetchOnWindowFocus: false },
  );
  const activeProjects: readonly Project[] = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data?.data],
  );
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const proj of activeProjects) {
      map.set(proj.id, proj);
    }
    return map;
  }, [activeProjects]);

  const createMutation = useCreateMcpApiKeyMutation(
    user?.id ?? "",
    organizationId,
  );
  const revokeMutation = useRevokeMcpApiKeyMutation(
    user?.id ?? "",
    organizationId,
  );

  // SSR-safe origin resolution: initialize to "" so SSR & initial client render match 100%
  const [browserOrigin, setBrowserOrigin] = useState<string>("");
  const userToggledEndpointRef = useRef(false);
  const mcpEndpointPath = visibleData?.mcpEndpointPath ?? "/api/v1/mcp";
  const [endpointMode, setEndpointMode] = useState<McpEndpointMode>(
    () => resolvePublicMcpEndpoints("", "/api/v1/mcp").recommendedMode,
  );

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setBrowserOrigin(currentOrigin);
    if (!userToggledEndpointRef.current) {
      const resolved = resolvePublicMcpEndpoints(
        currentOrigin,
        mcpEndpointPath,
      );
      setEndpointMode(resolved.recommendedMode);
    }
  }, [mcpEndpointPath]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScope, setSelectedScope] =
    useState<McpKeyScopeMode>("FULL_OPERATIONS");
  const [projectPartitionMode, setProjectPartitionMode] = useState<
    "all" | "selected"
  >("all");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [expirationPreset, setExpirationPreset] =
    useState<ExpirationPreset>("90");
  const [formValidationError, setFormValidationError] = useState<string | null>(
    null,
  );

  // Scope-keyed secret state prevents even a 1-frame cross-organization leak before useEffect runs
  const [mintedSecretState, setMintedSecretState] = useState<{
    rawKey: string;
    keyName: string;
    scopeKey: string;
  } | null>(null);
  const mintedSecret =
    mintedSecretState?.scopeKey === workspaceScopeKey
      ? mintedSecretState
      : null;

  const [revokeTarget, setRevokeTarget] = useState<McpApiKeyView | null>(null);

  const [activeIdeClient, setActiveIdeClient] =
    useState<McpIdeClientId>("antigravity");
  const [keyStatusFilter, setKeyStatusFilter] = useState<
    "ALL" | "ACTIVE" | "REVOKED"
  >("ALL");
  const [keySearchQuery, setKeySearchQuery] = useState("");
  const [wrapCode, setWrapCode] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<boolean>(false);
  const [copyAnnouncement, setCopyAnnouncement] = useState<string>("");

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScopeKeyRef = useRef<string>(workspaceScopeKey);
  const isSubmittingCreateRef = useRef<boolean>(false);
  const isSubmittingRevokeRef = useRef<boolean>(false);

  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const createDialogRef = useRef<HTMLDivElement | null>(null);
  const revokeDialogRef = useRef<HTMLDivElement | null>(null);
  const keyNameInputRef = useRef<HTMLInputElement | null>(null);
  const revokeCancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const vaultCopyBtnRef = useRef<HTMLButtonElement | null>(null);
  const ledgerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const ideTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // [C-01] Cross-Org & Cross-User Reset: wipe secret, modals, form fields & mutations immediately
  useEffect(() => {
    if (prevScopeKeyRef.current === workspaceScopeKey) return;
    prevScopeKeyRef.current = workspaceScopeKey;

    setMintedSecretState(null);
    setIsCreateModalOpen(false);
    setRevokeTarget(null);
    setKeyName("");
    setSelectedScope("FULL_OPERATIONS");
    setProjectPartitionMode("all");
    setSelectedProjectIds([]);
    setProjectSearchQuery("");
    setExpirationPreset("90");
    setKeyStatusFilter("ALL");
    setKeySearchQuery("");
    setFormValidationError(null);
    setCopiedTarget(null);
    setCopyFailed(false);
    setCopyAnnouncement("");
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    createMutation.reset();
    revokeMutation.reset();
  }, [workspaceScopeKey, createMutation, revokeMutation]);

  const restoreTriggerFocus = useCallback(() => {
    const trigger = modalTriggerRef.current;
    modalTriggerRef.current = null;
    trigger?.focus?.();
  }, []);

  const closeCreateModal = useCallback(() => {
    if (createMutation.isPending || isSubmittingCreateRef.current) return;
    setIsCreateModalOpen(false);
    restoreTriggerFocus();
  }, [createMutation.isPending, restoreTriggerFocus]);

  const closeRevokeModal = useCallback(() => {
    if (revokeMutation.isPending || isSubmittingRevokeRef.current) return;
    setRevokeTarget(null);
    restoreTriggerFocus();
  }, [revokeMutation.isPending, restoreTriggerFocus]);

  // Body scroll lock while Create or Revoke modal is open
  useEffect(() => {
    if (!isCreateModalOpen && !revokeTarget) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isCreateModalOpen, revokeTarget]);

  // Initial focus when Create modal opens
  useEffect(() => {
    if (!isCreateModalOpen) return;
    keyNameInputRef.current?.focus();
  }, [isCreateModalOpen]);

  // Initial focus on Cancel button when Revoke confirmation dialog opens
  useEffect(() => {
    if (!revokeTarget) return;
    revokeCancelBtnRef.current?.focus();
  }, [revokeTarget]);

  // Escape & Tab/Shift+Tab focus trap for active modal
  useEffect(() => {
    if (!isCreateModalOpen && !revokeTarget) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isCreateModalOpen) {
          closeCreateModal();
        } else if (revokeTarget) {
          closeRevokeModal();
        }
        return;
      }

      if (event.key === "Tab") {
        const activeDialog = isCreateModalOpen
          ? createDialogRef.current
          : revokeDialogRef.current;
        if (!activeDialog) return;

        const focusables = Array.from(
          activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;

        if (event.shiftKey) {
          if (current === first || !activeDialog.contains(current)) {
            event.preventDefault();
            last.focus();
          }
        } else if (current === last || !activeDialog.contains(current)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isCreateModalOpen, revokeTarget, closeCreateModal, closeRevokeModal]);

  const filteredModalProjects = useMemo(() => {
    const q = projectSearchQuery.trim().toLowerCase();
    if (!q) return activeProjects;
    return activeProjects.filter(
      (proj) =>
        proj.name.toLowerCase().includes(q) ||
        proj.code.toLowerCase().includes(q),
    );
  }, [activeProjects, projectSearchQuery]);

  const resolveErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      const normalizedCode = (error.code ?? "").toUpperCase();
      if (
        error.status === 401 ||
        normalizedCode === "AUTHENTICATION_FAILED" ||
        normalizedCode === "UNAUTHORIZED"
      ) {
        return t("unauthorizedError");
      }
      if (error.status === 403) {
        if (normalizedCode.includes("CSRF")) {
          return t("csrfError");
        }
        return t("forbiddenError");
      }
      if (error.status === 404 || normalizedCode === "MCP_API_KEY_NOT_FOUND") {
        return t("notFoundError");
      }
      if (error.status === 409) {
        if (
          normalizedCode === "MCP_API_KEY_LIMIT_EXCEEDED" ||
          normalizedCode.includes("LIMIT")
        ) {
          return t("limitExceededError");
        }
        return t("conflictError");
      }
      if (error.status === 422 || error.status === 400) {
        return t("validationError");
      }
      return t("saveError");
    }
    return t("networkError");
  };

  const formatTimestamp = (value: string | null): string => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format.dateTime(parsed, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getScopeTitle = (scope: McpKeyScopeMode): string => {
    if (scope === "READ_ONLY") return t("scopeReadOnlyTitle");
    if (scope === "READ_WRITE") return t("scopeReadWriteTitle");
    return t("scopeFullOpsTitle");
  };

  const getStatusLabel = (status: McpApiKeyView["status"]): string => {
    if (status === "ACTIVE") return t("statusActive");
    if (status === "EXPIRED") return t("statusExpired");
    return t("statusRevoked");
  };

  const copyText = async (
    targetId: string,
    value: string,
    copiedMessage?: string,
  ) => {
    const ok = await writeClipboardText(value);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    if (ok) {
      setCopyFailed(false);
      setCopiedTarget(targetId);
      setCopyAnnouncement(copiedMessage ?? t("copiedBadge"));
      copyTimerRef.current = setTimeout(() => {
        setCopiedTarget(null);
        setCopyAnnouncement("");
      }, 2000);
    } else {
      setCopiedTarget(null);
      setCopyFailed(true);
      setCopyAnnouncement(t("copyFailedHint"));
      copyTimerRef.current = setTimeout(() => {
        setCopyFailed(false);
        setCopyAnnouncement("");
      }, 4500);
    }
  };

  const openCreateModal = (triggerElement?: HTMLElement | null) => {
    modalTriggerRef.current =
      triggerElement ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setFormValidationError(null);
    createMutation.reset();
    setIsCreateModalOpen(true);
  };

  const openRevokeModal = (
    item: McpApiKeyView,
    triggerElement?: HTMLElement | null,
  ) => {
    modalTriggerRef.current =
      triggerElement ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    revokeMutation.reset();
    setRevokeTarget(item);
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

  const handleJumpToIdeSetup = () => {
    const sectionEl = document.getElementById("mcp-ide-quick-setup");
    if (sectionEl && typeof sectionEl.scrollIntoView === "function") {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    ideTabRefs.current[activeIdeClient]?.focus({ preventScroll: true });
  };

  const renderHeader = () => (
    <>
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("breadcrumbLabel")}
        items={[{ label: t("organizationBreadcrumb") }]}
        showTitle={false}
      />

      <header className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-gray-800">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {t("description")}
          </p>
        </div>
        {validOrg && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={(event) => openCreateModal(event.currentTarget)}
            >
              <PlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t("createKeyCta")}</span>
            </Button>
          </div>
        )}
      </header>
    </>
  );

  if (currentUser.isPending && !currentUser.data) {
    return (
      <div className="space-y-5" role="status" aria-busy="true">
        {renderHeader()}
        <div aria-hidden="true" className="space-y-4">
          <div className="continuum-shimmer h-16 rounded-2xl" />
          <div className="continuum-shimmer h-64 rounded-2xl" />
        </div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (currentUser.isError && !user) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div className="space-y-4" role="alert">
          <Alert
            variant="error"
            title={t("errorTitle")}
            message={resolveErrorMessage(currentUser.error)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void currentUser.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (!user || !validOrg) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <InfoIcon
            viewBox="0 0 24 24"
            className="mx-auto size-8 text-gray-400"
          />
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {t("noOrganization")}
          </p>
        </div>
      </div>
    );
  }

  if (keysQuery.isPending && !visibleData) {
    return (
      <div className="space-y-5" role="status" aria-busy="true">
        {renderHeader()}
        <div aria-hidden="true" className="space-y-4">
          <div className="continuum-shimmer h-16 rounded-2xl" />
          <div className="continuum-shimmer h-72 rounded-2xl" />
        </div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (keysQuery.isError && !visibleData) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div className="space-y-4" role="alert">
          <Alert
            variant="error"
            title={t("errorTitle")}
            message={resolveErrorMessage(keysQuery.error)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void keysQuery.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  const keys = visibleData?.items ?? [];
  const activeKeyCount = keys.filter((k) => k.status === "ACTIVE").length;
  const revokedKeyCount = keys.filter((k) => k.status !== "ACTIVE").length;
  const normalizedKeyQuery = keySearchQuery.trim().toLowerCase();
  const filteredKeys = keys.filter((item) => {
    if (keyStatusFilter === "ACTIVE" && item.status !== "ACTIVE") return false;
    if (keyStatusFilter === "REVOKED" && item.status === "ACTIVE") return false;
    if (!normalizedKeyQuery) return true;
    return (
      item.name.toLowerCase().includes(normalizedKeyQuery) ||
      item.keyPrefix.toLowerCase().includes(normalizedKeyQuery)
    );
  });
  const protocolVersion = visibleData?.protocolVersion ?? "2025-03-26";
  const toolCount = visibleData?.toolCount ?? 36;
  const { directEndpointUrl, bffEndpointUrl } = resolvePublicMcpEndpoints(
    browserOrigin,
    mcpEndpointPath,
  );
  const selectedEndpointUrl =
    endpointMode === "direct" ? directEndpointUrl : bffEndpointUrl;
  const activeClientSpec =
    MCP_IDE_CLIENT_SPECS.find((spec) => spec.id === activeIdeClient) ??
    MCP_IDE_CLIENT_SPECS[0];
  const snippetToken = mintedSecret?.rawKey ?? MCP_PLACEHOLDER_TOKEN;
  const renderedSnippet = activeClientSpec.buildSnippet({
    endpointUrl: selectedEndpointUrl,
    bearerToken: snippetToken,
  });

  const handleToggleProjectId = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
    setFormValidationError(null);
  };

  const handleSelectAllFilteredProjects = () => {
    setSelectedProjectIds((prev) => {
      const merged = new Set(prev);
      for (const proj of filteredModalProjects) {
        merged.add(proj.id);
      }
      return Array.from(merged);
    });
    setFormValidationError(null);
  };

  const handleClearSelectedProjects = () => {
    setSelectedProjectIds([]);
    setFormValidationError(null);
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createMutation.isPending || isSubmittingCreateRef.current) return;
    setFormValidationError(null);

    const trimmedName = keyName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      setFormValidationError(t("keyNameValidation"));
      return;
    }

    if (
      projectPartitionMode === "selected" &&
      selectedProjectIds.length === 0
    ) {
      setFormValidationError(t("projectSelectionValidation"));
      return;
    }

    const expiresInDays =
      expirationPreset === "never" ? null : Number(expirationPreset);

    isSubmittingCreateRef.current = true;
    try {
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        scope: selectedScope,
        allowedProjectIds:
          projectPartitionMode === "all" ? null : selectedProjectIds,
        expiresInDays,
      });
      setMintedSecretState({
        rawKey: created.rawKey,
        keyName: created.key.name,
        scopeKey: workspaceScopeKey,
      });
      setKeyName("");
      setSelectedScope("FULL_OPERATIONS");
      setProjectPartitionMode("all");
      setSelectedProjectIds([]);
      setProjectSearchQuery("");
      setExpirationPreset("90");
      setIsCreateModalOpen(false);
      modalTriggerRef.current = null;
      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        window.requestAnimationFrame(() => {
          vaultCopyBtnRef.current?.focus();
        });
      }
    } catch {
      // Mutation error banner renders inside the modal.
    } finally {
      isSubmittingCreateRef.current = false;
    }
  };

  const handleConfirmRevoke = async () => {
    if (
      !revokeTarget ||
      revokeMutation.isPending ||
      isSubmittingRevokeRef.current
    ) {
      return;
    }
    isSubmittingRevokeRef.current = true;
    try {
      await revokeMutation.mutateAsync(revokeTarget.id);
      setRevokeTarget(null);
      modalTriggerRef.current = null;
      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        window.requestAnimationFrame(() => {
          ledgerHeadingRef.current?.focus({ preventScroll: true });
        });
      }
    } catch {
      // Error surfaces inside revoke dialog.
    } finally {
      isSubmittingRevokeRef.current = false;
    }
  };

  return (
    <div className="min-w-0 space-y-5" aria-busy={keysQuery.isFetching}>
      {renderHeader()}

      {/* Polite live region for clipboard announcements and copy-blocked fallback */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          copyFailed
            ? "rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-xs font-medium text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
            : "sr-only"
        }
      >
        {copyAnnouncement}
      </div>

      {!userAccessLost && currentUser.isFetching && (
        <UpdatingStatus>{t("loading")}</UpdatingStatus>
      )}
      {!keysAccessLost && keysQuery.isFetching && (
        <UpdatingStatus>{t("loading")}</UpdatingStatus>
      )}
      {!keysAccessLost && keysQuery.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={t("retry")}
          onRetry={() => void keysQuery.refetch()}
        >
          {resolveErrorMessage(keysQuery.error)}
        </BackgroundRefreshError>
      )}

      {/* 1. Quiet Frameless Gateway Metadata Row + Docs Link */}
      <section
        aria-label={t("heroTitle")}
        className="flex flex-col gap-2.5 border-b border-gray-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 tabular-nums dark:text-gray-300">
          <span className="inline-flex items-center gap-2 font-mono font-medium text-gray-900 dark:text-white">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-success-500"
            />
            <span>{t("protocolBadge", { version: protocolVersion })}</span>
          </span>
          <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
            ·
          </span>
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {t("toolsBadge", { count: toolCount })}
          </span>
          <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-gray-600 dark:text-gray-400">
            <LockIcon className="size-3 shrink-0" aria-hidden="true" />
            <span>{t("securityBadge")}</span>
          </span>
        </div>

        <Link
          href="/docs"
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-medium whitespace-nowrap text-gray-700 transition-colors hover:text-gray-950 sm:self-center dark:text-gray-300 dark:hover:text-white"
        >
          <DocsIcon
            className="size-3.5 shrink-0 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <span>{t("exploreDocsCta")}</span>
          <ArrowRightIcon
            className="size-3.5 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
        </Link>
      </section>

      {/* 2. One-Time Secret Reveal Vault Callout */}
      {mintedSecret && (
        <section
          role="region"
          aria-labelledby="mcp-secret-vault-heading"
          data-testid="mcp-secret-reveal-vault"
          className="continuum-stagger-1 rounded-xl border border-gray-200 border-s-2 border-s-success-600 bg-white p-5 dark:border-gray-800 dark:border-s-success-400 dark:bg-gray-900"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-success-700 uppercase dark:text-success-300">
                  <LockIcon className="size-3 shrink-0" aria-hidden="true" />
                  <span>{t("secretVaultBadge")}</span>
                </span>
                <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                  <CheckCircleIcon
                    className="size-3.5 shrink-0 text-success-600 dark:text-success-400"
                    aria-hidden="true"
                  />
                  <span>{t("injectedNotice")}</span>
                </span>
              </div>
              <h2
                id="mcp-secret-vault-heading"
                className="text-base font-semibold text-balance text-gray-900 dark:text-white"
              >
                {t("secretVaultTitle", { name: mintedSecret.keyName })}
              </h2>
              <p className="max-w-3xl text-xs leading-5 text-pretty text-gray-600 dark:text-gray-300">
                {t("secretVaultWarning")}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleJumpToIdeSetup}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium whitespace-nowrap text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t("jumpToIdeSetup")}
              </button>
              <button
                type="button"
                onClick={() => setMintedSecretState(null)}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-2.5 text-xs font-medium whitespace-nowrap text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                {t("dismissSecretCta")}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200/90 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-950">
            <code
              data-testid="mcp-raw-secret-value"
              className="custom-scrollbar min-w-0 flex-1 overflow-x-auto font-mono text-xs break-all text-emerald-800 select-all sm:text-sm dark:text-emerald-300"
            >
              {mintedSecret.rawKey}
            </code>
            <button
              ref={vaultCopyBtnRef}
              type="button"
              onClick={() =>
                void copyText(
                  "raw-secret-key",
                  mintedSecret.rawKey,
                  t("copiedRawKeyCta"),
                )
              }
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3.5 text-xs font-medium whitespace-nowrap text-white transition-colors hover:bg-gray-800 dark:bg-success-600 dark:hover:bg-success-500"
            >
              {copiedTarget === "raw-secret-key" ? (
                <>
                  <CheckLineIcon className="size-3.5" aria-hidden="true" />
                  <span>{t("copiedRawKeyCta")}</span>
                </>
              ) : (
                <>
                  <CopyIcon className="size-3.5" aria-hidden="true" />
                  <span>{t("copyRawKeyCta")}</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* 3. Frameless Editorial MCP API Keys Ledger */}
      <section aria-labelledby="mcp-keys-ledger-heading" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2
                ref={ledgerHeadingRef}
                id="mcp-keys-ledger-heading"
                tabIndex={-1}
                className="text-base font-semibold tracking-tight text-balance text-gray-900 focus:outline-none dark:text-white"
              >
                {t("ledgerTitle")}
              </h2>
              <span className="font-mono text-xs text-gray-500 tabular-nums dark:text-gray-400">
                · {t("activeCountBadge", { count: activeKeyCount })}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-pretty text-gray-500 dark:text-gray-400">
              {t("ledgerSubtitle")}
            </p>
          </div>

          {keys.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              <div
                role="group"
                aria-label={t("colStatus")}
                className="flex items-center gap-4 border-b border-gray-200/80 dark:border-gray-800"
              >
                {(
                  [
                    { id: "ALL" as const, label: t("filterAll"), count: keys.length },
                    {
                      id: "ACTIVE" as const,
                      label: t("filterActive"),
                      count: activeKeyCount,
                    },
                    {
                      id: "REVOKED" as const,
                      label: t("filterRevoked"),
                      count: revokedKeyCount,
                    },
                  ] as const
                ).map((pill) => {
                  const active = keyStatusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKeyStatusFilter(pill.id)}
                      className={cn(
                        "-mb-px cursor-pointer border-b-2 pb-1.5 text-xs font-medium tabular-nums transition-colors",
                        active
                          ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                          : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                      )}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={keySearchQuery}
                  onChange={(event) => setKeySearchQuery(event.target.value)}
                  placeholder={t("searchKeysPlaceholder")}
                  aria-label={t("searchKeysPlaceholder")}
                  className="h-8 w-full rounded-lg border border-gray-200 bg-white ps-8 pe-7 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
                {keySearchQuery && (
                  <button
                    type="button"
                    aria-label={t("clearKeySearchAria")}
                    onClick={() => setKeySearchQuery("")}
                    className="absolute end-1 top-1/2 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <CloseLineIcon className="size-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {keys.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 rounded-xl border border-gray-200/90 bg-white p-6 sm:p-7 lg:grid-cols-12 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="space-y-3 lg:col-span-6">
              <div className="inline-flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300">
                <PlugInIcon className="size-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-balance text-gray-900 dark:text-white">
                  {t("emptyKeysTitle")}
                </h3>
                <p className="mt-1 max-w-md text-sm text-pretty text-gray-500 dark:text-gray-400">
                  {t("emptyKeysDesc")}
                </p>
              </div>
              <div className="pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={(event) => openCreateModal(event.currentTarget)}
                >
                  <PlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{t("createKeyCta")}</span>
                </Button>
              </div>
            </div>

            <ol className="space-y-3.5 border-s border-gray-200 ps-5 lg:col-span-6 dark:border-gray-800">
              <li>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {t("emptyStep1Title")}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-gray-500 dark:text-gray-400">
                  {t("emptyStep1Desc")}
                </p>
              </li>
              <li>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {t("emptyStep2Title")}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-gray-500 dark:text-gray-400">
                  {t("emptyStep2Desc")}
                </p>
              </li>
              <li>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {t("emptyStep3Title")}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-pretty text-gray-500 dark:text-gray-400">
                  {t("emptyStep3Desc")}
                </p>
              </li>
            </ol>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="rounded-xl border border-gray-200/90 bg-white px-6 py-8 text-center dark:border-gray-800 dark:bg-gray-900/60">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("noMatchingKeys")}
            </p>
            <button
              type="button"
              onClick={() => {
                setKeyStatusFilter("ALL");
                setKeySearchQuery("");
              }}
              className="mt-3 inline-flex h-8 cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t("resetKeyFilters")}
            </button>
          </div>
        ) : (
          <div className="custom-scrollbar max-w-full overflow-x-auto rounded-xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-900/60">
            <table className="w-full min-w-[760px] divide-y divide-gray-200 text-start text-sm dark:divide-gray-800">
              <thead className="bg-gray-50/70 dark:bg-gray-950/40">
                <tr>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colName")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colScope")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colProjects")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colLifecycle")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colExpires")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-start text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colStatus")}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-end text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {filteredKeys.map((item) => {
                  const projectIds = item.allowedProjectIds;
                  const resolvedProjectCodes = projectIds
                    ? projectIds
                        .map((id) => projectMap.get(id)?.code)
                        .filter((code): code is string => Boolean(code))
                    : [];
                  const overflowProjectCount =
                    projectIds && projectIds.length > 2
                      ? projectIds.length - 2
                      : 0;
                  const projectTooltip = projectIds
                    ? projectIds
                        .map((id) => {
                          const proj = projectMap.get(id);
                          return proj ? `${proj.name} (${proj.code})` : id;
                        })
                        .join(", ")
                    : undefined;
                  const prefixCopyId = `prefix-${item.id}`;

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        <button
                          type="button"
                          aria-label={t("copyPrefixAria", { name: item.name })}
                          onClick={() =>
                            void copyText(
                              prefixCopyId,
                              item.keyPrefix,
                              t("copiedPrefixToast"),
                            )
                          }
                          className="group mt-0.5 inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                          <code>{item.keyPrefix}••••</code>
                          {copiedTarget === prefixCopyId ? (
                            <CheckLineIcon
                              className="size-3 text-success-600 dark:text-success-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <CopyIcon
                              className="size-3 opacity-0 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <ScopeBadge
                          scope={item.scope}
                          label={getScopeTitle(item.scope)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        {projectIds === null ? (
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {t("allProjectsBadge")}
                          </span>
                        ) : (
                          <div
                            className="flex flex-wrap items-center gap-1.5 text-xs"
                            title={projectTooltip}
                          >
                            <span className="font-medium text-gray-700 tabular-nums dark:text-gray-300">
                              {t("restrictedProjectsBadge", {
                                count: projectIds.length,
                              })}
                            </span>
                            {resolvedProjectCodes.slice(0, 2).map((code) => (
                              <code
                                key={code}
                                className="font-mono text-[11px] text-gray-500 dark:text-gray-400"
                              >
                                {code}
                              </code>
                            ))}
                            {overflowProjectCount > 0 && (
                              <span className="font-mono text-[11px] font-medium text-gray-500 tabular-nums dark:text-gray-400">
                                +{overflowProjectCount}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 tabular-nums dark:text-gray-300">
                        <p>
                          <time dateTime={item.createdAt}>
                            {t("createdLabel", {
                              date: formatTimestamp(item.createdAt),
                            })}
                          </time>
                        </p>
                        <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                          {item.status === "REVOKED" && item.revokedAt ? (
                            <time dateTime={item.revokedAt}>
                              {t("revokedOnDate", {
                                date: formatTimestamp(item.revokedAt),
                              })}
                            </time>
                          ) : item.lastUsedAt ? (
                            <time dateTime={item.lastUsedAt}>
                              {t("lastUsedLabel", {
                                date: formatTimestamp(item.lastUsedAt),
                              })}
                            </time>
                          ) : (
                            t("neverUsedLabel")
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 tabular-nums dark:text-gray-300">
                        {item.expiresAt ? (
                          <time dateTime={item.expiresAt}>
                            {formatTimestamp(item.expiresAt)}
                          </time>
                        ) : (
                          t("neverExpiresLabel")
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          status={item.status}
                          label={getStatusLabel(item.status)}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {item.status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={(event) =>
                              openRevokeModal(item, event.currentTarget)
                            }
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap text-gray-500 transition-colors hover:bg-error-50/80 hover:text-error-700 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
                          >
                            <TrashBinIcon
                              className="size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{t("revokeCta")}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Asymmetric Editorial IDE & Agent Quick-Setup Workbench */}
      <section
        id="mcp-ide-quick-setup"
        aria-labelledby="mcp-ide-quick-setup-heading"
        className="scroll-mt-20 border-t border-gray-200/80 pt-7 dark:border-gray-800"
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Context, Endpoint Mode & Copyable Endpoint URL */}
          <div className="min-w-0 space-y-5 lg:col-span-4">
            <div>
              <h2
                id="mcp-ide-quick-setup-heading"
                className="text-base font-semibold tracking-tight text-balance text-gray-900 dark:text-white"
              >
                {t("quickSetupTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-pretty text-gray-500 dark:text-gray-400">
                {t("quickSetupSubtitle")}
              </p>
              <p className="mt-2.5 inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    mintedSecret
                      ? "bg-success-500"
                      : "bg-gray-400 dark:bg-gray-500",
                  )}
                />
                <span>
                  {mintedSecret
                    ? t("usingLiveSecretBadge")
                    : t("usingPlaceholderBadge")}
                </span>
              </p>
            </div>

            {/* Endpoint Target Switcher */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("endpointModeLabel")}
              </p>
              <div
                role="group"
                aria-label={t("endpointModeLabel")}
                className="divide-y divide-gray-200/80 overflow-hidden rounded-xl border border-gray-200/90 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900/60"
              >
                {(
                  [
                    { id: "direct" as const, label: t("endpointModeDirect") },
                    { id: "bff" as const, label: t("endpointModeBff") },
                  ] as const
                ).map((option) => {
                  const active = endpointMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        userToggledEndpointRef.current = true;
                        setEndpointMode(option.id);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between border-s-2 px-3.5 py-2.5 text-start text-xs font-medium transition-colors",
                        active
                          ? "border-s-brand-600 bg-gray-50/90 text-gray-950 dark:border-s-brand-400 dark:bg-gray-800/70 dark:text-white"
                          : "border-s-transparent text-gray-600 hover:bg-gray-50/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.02] dark:hover:text-gray-200",
                      )}
                    >
                      <span>{option.label}</span>
                      {active && (
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Single Copyable Endpoint URL Bar */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200/90 bg-gray-50/70 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 font-mono text-[10px] font-semibold text-brand-700 uppercase dark:text-brand-300">
                  POST
                </span>
                <code
                  title={selectedEndpointUrl}
                  className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800 dark:text-gray-200"
                >
                  {selectedEndpointUrl}
                </code>
              </div>
              <button
                type="button"
                aria-label={t("copyEndpointAria", {
                  label:
                    endpointMode === "direct"
                      ? t("directEndpointLabel")
                      : t("bffEndpointLabel"),
                })}
                onClick={() =>
                  void copyText(
                    `endpoint-${endpointMode}`,
                    selectedEndpointUrl,
                    t("copiedBadge"),
                  )
                }
                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap text-gray-600 transition-colors hover:bg-gray-200/70 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                {copiedTarget === `endpoint-${endpointMode}` ? (
                  <>
                    <CheckLineIcon
                      className="size-3.5 text-success-600 dark:text-success-400"
                      aria-hidden="true"
                    />
                    <span className="text-success-700 dark:text-success-300">
                      {t("copiedBadge")}
                    </span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-3.5" aria-hidden="true" />
                    <span>{t("copyButton")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Light/Dark-Adaptive Editorial Code Workbench */}
          <div className="min-w-0 lg:col-span-8">
            <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white dark:border-gray-800 dark:bg-gray-950">
              <div
                role="tablist"
                aria-label={t("quickSetupTitle")}
                className="custom-scrollbar flex items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-gray-200/90 bg-white px-2 pt-1 whitespace-nowrap dark:border-gray-800 dark:bg-gray-900/80"
              >
                {MCP_IDE_CLIENT_SPECS.map((spec, idx) => {
                  const isSelected = spec.id === activeClientSpec.id;
                  return (
                    <button
                      key={spec.id}
                      ref={(el) => {
                        ideTabRefs.current[spec.id] = el;
                      }}
                      id={`org-mcp-ide-tab-${spec.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls={`org-mcp-ide-panel-${spec.id}`}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setActiveIdeClient(spec.id)}
                      onKeyDown={(event) => handleIdeTabKeyDown(event, idx)}
                      className={cn(
                        "relative shrink-0 cursor-pointer px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                        isSelected
                          ? "text-gray-950 dark:text-white"
                          : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                      )}
                    >
                      {isSelected &&
                        (shouldReduceMotion ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-900 dark:bg-brand-400"
                          />
                        ) : (
                          <motion.span
                            layoutId="org-mcp-ide-active-underline"
                            transition={ANIMATE_UI_BUTTON_SPRING}
                            aria-hidden="true"
                            className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-900 dark:bg-brand-400"
                          />
                        ))}
                      <span>{spec.label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id={`org-mcp-ide-panel-${activeClientSpec.id}`}
                role="tabpanel"
                aria-labelledby={`org-mcp-ide-tab-${activeClientSpec.id}`}
                className="min-w-0"
              >
                <div className="flex flex-nowrap items-center justify-between gap-3 border-b border-gray-200/80 bg-gray-50/75 px-4 py-2 dark:border-gray-800/80 dark:bg-gray-900/50">
                  <span
                    title={activeClientSpec.targetFile}
                    className="min-w-0 flex-1 truncate font-mono text-xs text-gray-500 dark:text-slate-400"
                  >
                    {t("configFileHint", { target: activeClientSpec.targetFile })}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-pressed={wrapCode}
                      aria-label={t("wrapCodeAria")}
                      onClick={() => setWrapCode((prev) => !prev)}
                      className={cn(
                        "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                        wrapCode
                          ? "bg-gray-200/80 text-gray-950 dark:bg-gray-800 dark:text-white"
                          : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
                      )}
                    >
                      {t("wrapCodeLabel")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          `ide-${activeClientSpec.id}`,
                          renderedSnippet,
                          t("copiedSnippetCta"),
                        )
                      }
                      className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-medium whitespace-nowrap text-gray-800 ring-1 ring-gray-200 ring-inset transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
                    >
                      <motion.span
                        key={
                          copiedTarget === `ide-${activeClientSpec.id}`
                            ? "copied"
                            : "copy"
                        }
                        initial={
                          shouldReduceMotion
                            ? false
                            : { scale: 0.6, opacity: 0 }
                        }
                        animate={{ scale: 1, opacity: 1 }}
                        transition={ANIMATE_UI_ICON_SPRING}
                        className="inline-flex items-center justify-center"
                      >
                        {copiedTarget === `ide-${activeClientSpec.id}` ? (
                          <CheckLineIcon
                            className="size-3.5 text-success-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : (
                          <CopyIcon className="size-3.5" aria-hidden="true" />
                        )}
                      </motion.span>
                      <span
                        className={
                          copiedTarget === `ide-${activeClientSpec.id}`
                            ? "text-success-700 dark:text-emerald-300"
                            : undefined
                        }
                      >
                        {copiedTarget === `ide-${activeClientSpec.id}`
                          ? t("copiedSnippetCta")
                          : t("copySnippetCta")}
                      </span>
                    </button>
                  </div>
                </div>
                <pre
                  data-testid="mcp-ide-config-pre"
                  className={cn(
                    "custom-scrollbar max-w-full overflow-x-auto bg-gray-50/80 p-4 font-mono text-xs leading-6 text-slate-800 dark:bg-gray-950 dark:text-slate-100",
                    wrapCode && "whitespace-pre-wrap",
                  )}
                >
                  <code>
                    {renderSyntaxTintedSnippet(
                      renderedSnippet,
                      activeClientSpec.language,
                      wrapCode,
                    )}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Create MCP API Key Inspector Sheet */}
      {isCreateModalOpen &&
        renderModalPortal(
          <CreateMcpKeySheet
            dialogRef={createDialogRef}
            keyNameInputRef={keyNameInputRef}
            onClose={closeCreateModal}
            onSubmit={handleCreateSubmit}
            isPending={createMutation.isPending}
            formValidationError={formValidationError}
            mutationErrorMessage={
              createMutation.isError
                ? resolveErrorMessage(createMutation.error)
                : null
            }
            keyName={keyName}
            onKeyNameChange={(value) => {
              setKeyName(value);
              setFormValidationError(null);
            }}
            selectedScope={selectedScope}
            onSelectScope={setSelectedScope}
            projectPartitionMode={projectPartitionMode}
            onProjectPartitionModeChange={(mode) => {
              setProjectPartitionMode(mode);
              setFormValidationError(null);
            }}
            selectedProjectIds={selectedProjectIds}
            activeProjects={activeProjects}
            filteredModalProjects={filteredModalProjects}
            projectsLoading={projectsQuery.isPending}
            projectsError={projectsQuery.isError}
            onRetryProjects={() => void projectsQuery.refetch()}
            projectSearchQuery={projectSearchQuery}
            onProjectSearchChange={setProjectSearchQuery}
            onSelectAllFilteredProjects={handleSelectAllFilteredProjects}
            onClearSelectedProjects={handleClearSelectedProjects}
            onToggleProjectId={handleToggleProjectId}
            expirationPreset={expirationPreset}
            onExpirationPresetChange={setExpirationPreset}
          />,
        )}

      {/* 6. Revoke Confirmation Dialog */}
      {revokeTarget &&
        renderModalPortal(
          <div
            data-testid="mcp-revoke-modal-backdrop"
            onClick={closeRevokeModal}
            className="continuum-backdrop-enter fixed inset-0 z-99999 flex items-start justify-center overflow-y-auto overscroll-contain bg-gray-950/45 p-4 backdrop-blur-[3px] sm:items-center dark:bg-gray-950/65"
          >
            <div
              ref={revokeDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="revoke-mcp-key-dialog-title"
              aria-describedby="revoke-mcp-key-dialog-desc"
              onClick={(event) => event.stopPropagation()}
              className="continuum-sheet-enter relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl sm:p-6 dark:border-gray-800 dark:bg-gray-900"
            >
              <h2
                id="revoke-mcp-key-dialog-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {t("revokeConfirmTitle")}
              </h2>
              <p
                id="revoke-mcp-key-dialog-desc"
                className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300"
              >
                {t("revokeConfirmDesc", {
                  name: revokeTarget.name,
                  prefix: revokeTarget.keyPrefix,
                })}
              </p>

              {revokeMutation.isError && (
                <div className="mt-4" role="alert">
                  <Alert
                    variant="error"
                    title={t("errorTitle")}
                    message={resolveErrorMessage(revokeMutation.error)}
                  />
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <Button
                  ref={revokeCancelBtnRef}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={revokeMutation.isPending}
                  onClick={closeRevokeModal}
                >
                  {t("cancelCta")}
                </Button>
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => void handleConfirmRevoke()}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-error-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-error-700 disabled:opacity-60"
                >
                  {revokeMutation.isPending
                    ? t("revokingCta")
                    : t("revokeConfirmSubmit")}
                </button>
              </div>
            </div>
          </div>,
        )}
    </div>
  );
}
