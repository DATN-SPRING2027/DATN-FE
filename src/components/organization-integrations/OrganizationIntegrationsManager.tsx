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
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import Label from "@/components/form/Label";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseIcon,
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

type ExpirationPreset = "30" | "90" | "365" | "never";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ScopeBadge({
  scope,
  label,
}: {
  scope: McpKeyScopeMode;
  label: string;
}) {
  const toneClass =
    scope === "READ_ONLY"
      ? "bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-400/25"
      : scope === "READ_WRITE"
        ? "bg-blue-light-50 text-blue-light-700 ring-blue-light-600/20 dark:bg-blue-light-500/10 dark:text-blue-light-300 dark:ring-blue-light-400/25"
        : "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap ring-1 ring-inset",
        toneClass,
      )}
    >
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
  const toneClass =
    status === "ACTIVE"
      ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
      : status === "EXPIRED"
        ? "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
        : "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

  const dotClass =
    status === "ACTIVE"
      ? "bg-success-500"
      : status === "EXPIRED"
        ? "bg-warning-500"
        : "bg-gray-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dotClass)}
      />
      <span>{label}</span>
    </span>
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

export default function OrganizationIntegrationsManager() {
  const t = useTranslations("organizationIntegrations");
  const format = useFormatter();
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
  const protocolVersion = visibleData?.protocolVersion ?? "2025-03-26";
  const toolCount = visibleData?.toolCount ?? 28;
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

      {/* 1. Compact Enterprise MCP Gateway Status Strip (keeps Personal Keys above the fold) */}
      <section
        aria-label={t("heroTitle")}
        className="flex flex-col gap-3 rounded-xl border border-gray-200/90 bg-white px-4 py-3 shadow-theme-xs sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 tabular-nums dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-gray-900 dark:text-white">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-success-500"
            />
            <span>{t("protocolBadge", { version: protocolVersion })}</span>
          </span>
          <span
            aria-hidden="true"
            className="hidden text-gray-300 sm:inline dark:text-gray-700"
          >
            ·
          </span>
          <span className="font-mono">{t("toolsBadge", { count: toolCount })}</span>
          <span
            aria-hidden="true"
            className="hidden text-gray-300 sm:inline dark:text-gray-700"
          >
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-gray-600 dark:text-gray-400">
            <LockIcon className="size-3 shrink-0" aria-hidden="true" />
            <span>{t("securityBadge")}</span>
          </span>
        </div>

        <Link
          href="/docs"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg bg-gray-50 px-3 text-xs font-semibold whitespace-nowrap text-gray-800 ring-1 ring-gray-200/90 ring-inset transition-colors hover:bg-gray-100 sm:self-center dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
        >
          <DocsIcon
            className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
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
          className="rounded-2xl border border-success-500/70 bg-success-50/50 p-5 shadow-theme-sm sm:p-6 dark:border-success-400/50 dark:bg-success-500/[0.08]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success-600 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase">
                  <LockIcon className="size-3 shrink-0" aria-hidden="true" />
                  <span>{t("secretVaultBadge")}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700 dark:text-success-300">
                  <CheckCircleIcon
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{t("injectedNotice")}</span>
                </span>
              </div>
              <h2
                id="mcp-secret-vault-heading"
                className="text-base font-semibold text-gray-900 sm:text-lg dark:text-white"
              >
                {t("secretVaultTitle", { name: mintedSecret.keyName })}
              </h2>
              <p className="max-w-3xl text-xs leading-5 text-gray-700 dark:text-gray-300">
                {t("secretVaultWarning")}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleJumpToIdeSetup}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-white px-3.5 text-xs font-semibold whitespace-nowrap text-brand-700 ring-1 ring-brand-200 ring-inset transition-colors hover:bg-brand-50 dark:bg-gray-900 dark:text-brand-300 dark:ring-brand-500/30 dark:hover:bg-gray-800"
              >
                {t("jumpToIdeSetup")}
              </button>
              <button
                type="button"
                onClick={() => setMintedSecretState(null)}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-white px-3.5 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-200 ring-inset transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
              >
                {t("dismissSecretCta")}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-900/15 bg-gray-950 p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/15">
            <code
              data-testid="mcp-raw-secret-value"
              className="min-w-0 flex-1 font-mono text-xs break-all text-emerald-300 select-all sm:text-sm"
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
              className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-success-500 px-3.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-success-600"
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

      {/* 3. Personal MCP API Keys Table (Elevated Immediately Above the Fold) */}
      <section
        aria-labelledby="mcp-keys-ledger-heading"
        className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                ref={ledgerHeadingRef}
                id="mcp-keys-ledger-heading"
                tabIndex={-1}
                className="text-base font-semibold tracking-tight text-gray-900 focus:outline-none dark:text-white"
              >
                {t("ledgerTitle")}
              </h2>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/15 ring-inset tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
                {t("activeCountBadge", { count: activeKeyCount })}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("ledgerSubtitle")}
            </p>
          </div>
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <PlugInIcon className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
              {t("emptyKeysTitle")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              {t("emptyKeysDesc")}
            </p>
            <div className="mt-4">
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
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[780px] divide-y divide-gray-200 text-start text-sm dark:divide-gray-800">
              <thead className="bg-gray-50/80 dark:bg-gray-950/60">
                <tr>
                  <th
                    scope="col"
                    className="px-5 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colName")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colScope")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colProjects")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colLifecycle")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colExpires")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colStatus")}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-end text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                  >
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {keys.map((item) => {
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

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        <code className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {item.keyPrefix}••••
                        </code>
                      </td>
                      <td className="px-4 py-3.5">
                        <ScopeBadge
                          scope={item.scope}
                          label={getScopeTitle(item.scope)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        {projectIds === null ? (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {t("allProjectsBadge")}
                          </span>
                        ) : (
                          <div
                            className="flex flex-wrap items-center gap-1"
                            title={projectTooltip}
                          >
                            <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-600/20 ring-inset tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
                              {t("restrictedProjectsBadge", {
                                count: projectIds.length,
                              })}
                            </span>
                            {resolvedProjectCodes.slice(0, 2).map((code) => (
                              <code
                                key={code}
                                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {code}
                              </code>
                            ))}
                            {overflowProjectCount > 0 && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
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
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-error-200 bg-error-50/70 px-2.5 text-xs font-semibold whitespace-nowrap text-error-700 transition-colors hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 dark:hover:bg-error-500/20"
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

      {/* 4. Interactive IDE & Agent Quick-Setup Configurator */}
      <section
        id="mcp-ide-quick-setup"
        aria-labelledby="mcp-ide-quick-setup-heading"
        className="scroll-mt-20 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="mcp-ide-quick-setup-heading"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {t("quickSetupTitle")}
              </h2>
              {mintedSecret ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 ring-1 ring-success-600/20 ring-inset dark:bg-success-500/15 dark:text-success-300 dark:ring-success-400/25">
                  <CheckCircleIcon
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{t("usingLiveSecretBadge")}</span>
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {t("usingPlaceholderBadge")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("quickSetupSubtitle")}
            </p>
          </div>

          {/* Endpoint Target Switch */}
          <div
            role="group"
            aria-label={t("endpointModeLabel")}
            className="inline-flex max-w-full shrink-0 flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-950"
          >
            <button
              type="button"
              aria-pressed={endpointMode === "direct"}
              onClick={() => {
                userToggledEndpointRef.current = true;
                setEndpointMode("direct");
              }}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                endpointMode === "direct"
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {t("endpointModeDirect")}
            </button>
            <button
              type="button"
              aria-pressed={endpointMode === "bff"}
              onClick={() => {
                userToggledEndpointRef.current = true;
                setEndpointMode("bff");
              }}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                endpointMode === "bff"
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {t("endpointModeBff")}
            </button>
          </div>
        </div>

        {/* Compact Copyable Endpoint URL Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 ring-1 ring-gray-200/80 ring-inset dark:bg-gray-950/70 dark:ring-gray-800">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {endpointMode === "direct"
                ? t("directEndpointLabel")
                : t("bffEndpointLabel")}
              :
            </span>
            <code className="min-w-0 truncate font-mono text-xs text-gray-900 dark:text-gray-100">
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
            className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-200 ring-inset transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800"
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

        {/* WAI-ARIA IDE Tabs + Tabpanel */}
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
          <div
            role="tablist"
            aria-label={t("quickSetupTitle")}
            className="flex flex-wrap gap-1 border-b border-gray-800 bg-gray-900/95 p-2"
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
                    "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
                    isSelected
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
            id={`org-mcp-ide-panel-${activeClientSpec.id}`}
            role="tabpanel"
            aria-labelledby={`org-mcp-ide-tab-${activeClientSpec.id}`}
            className="min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/90 bg-gray-900/60 px-4 py-2.5">
              <span className="min-w-0 truncate font-mono text-xs text-slate-300">
                {t("configFileHint", { target: activeClientSpec.targetFile })}
              </span>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    `ide-${activeClientSpec.id}`,
                    renderedSnippet,
                    t("copiedSnippetCta"),
                  )
                }
                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-gray-800 px-2.5 text-xs font-semibold whitespace-nowrap text-gray-100 ring-1 ring-gray-700 ring-inset transition-colors hover:bg-gray-700"
              >
                {copiedTarget === `ide-${activeClientSpec.id}` ? (
                  <>
                    <CheckLineIcon
                      className="size-3.5 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-emerald-300">
                      {t("copiedSnippetCta")}
                    </span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-3.5" aria-hidden="true" />
                    <span>{t("copySnippetCta")}</span>
                  </>
                )}
              </button>
            </div>
            <pre
              data-testid="mcp-ide-config-pre"
              className="max-w-full overflow-x-auto p-4 font-mono text-xs leading-6 text-slate-100"
            >
              <code>
                {renderSyntaxTintedSnippet(
                  renderedSnippet,
                  activeClientSpec.language,
                )}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* 5. Create MCP API Key Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-xs">
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-mcp-key-dialog-title"
            aria-describedby="create-mcp-key-dialog-desc"
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <h2
                  id="create-mcp-key-dialog-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {t("createModalTitle")}
                </h2>
                <p
                  id="create-mcp-key-dialog-desc"
                  className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400"
                >
                  {t("createModalSubtitle")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("closeModalAria")}
                disabled={createMutation.isPending}
                onClick={closeCreateModal}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <CloseIcon className="size-4" aria-hidden="true" />
              </button>
            </div>

            {formValidationError && (
              <div className="mt-4" role="alert">
                <Alert
                  variant="warning"
                  title={t("errorTitle")}
                  message={formValidationError}
                />
              </div>
            )}

            {createMutation.isError && (
              <div className="mt-4" role="alert">
                <Alert
                  variant="error"
                  title={t("errorTitle")}
                  message={resolveErrorMessage(createMutation.error)}
                />
              </div>
            )}

            <form
              onSubmit={handleCreateSubmit}
              className="mt-5 space-y-5"
              noValidate
            >
              {/* Key Name */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="mcp-key-name-input">
                    {t("keyNameLabel")}
                  </Label>
                  <span className="mb-1 text-xs text-gray-400 tabular-nums">
                    {keyName.trim().length}/80
                  </span>
                </div>
                <input
                  ref={keyNameInputRef}
                  id="mcp-key-name-input"
                  type="text"
                  maxLength={80}
                  required
                  value={keyName}
                  disabled={createMutation.isPending}
                  onChange={(event) => {
                    setKeyName(event.target.value);
                    setFormValidationError(null);
                  }}
                  placeholder={t("keyNamePlaceholder")}
                  className="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("keyNameHelp")}
                </p>
              </div>

              {/* Capability Tier Selector */}
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("scopeLabel")}
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      {
                        value: "FULL_OPERATIONS" as const,
                        title: t("scopeFullOpsTitle"),
                        desc: t("scopeFullOpsDesc"),
                        code: "FULL_OPERATIONS",
                      },
                      {
                        value: "READ_WRITE" as const,
                        title: t("scopeReadWriteTitle"),
                        desc: t("scopeReadWriteDesc"),
                        code: "READ_WRITE",
                      },
                      {
                        value: "READ_ONLY" as const,
                        title: t("scopeReadOnlyTitle"),
                        desc: t("scopeReadOnlyDesc"),
                        code: "READ_ONLY",
                      },
                    ] as const
                  ).map((tier) => {
                    const active = selectedScope === tier.value;
                    return (
                      <button
                        key={tier.value}
                        type="button"
                        aria-pressed={active}
                        disabled={createMutation.isPending}
                        onClick={() => setSelectedScope(tier.value)}
                        className={cn(
                          "flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-start transition-colors",
                          active
                            ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-500/15"
                            : "border-gray-200 bg-gray-50/50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700",
                        )}
                      >
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                          {tier.code}
                        </code>
                        <span className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {tier.title}
                        </span>
                        <span className="mt-1 text-xs leading-4.5 text-gray-600 dark:text-gray-400">
                          {tier.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Project Scope Partition */}
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("projectScopeLabel")}
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={projectPartitionMode === "all"}
                    disabled={createMutation.isPending}
                    onClick={() => {
                      setProjectPartitionMode("all");
                      setFormValidationError(null);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 text-start transition-colors",
                      projectPartitionMode === "all"
                        ? "border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-500/15"
                        : "border-gray-200 bg-gray-50/50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950",
                    )}
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {t("allProjectsOption")}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                      {t("allProjectsDesc")}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={projectPartitionMode === "selected"}
                    disabled={createMutation.isPending}
                    onClick={() => {
                      setProjectPartitionMode("selected");
                      setFormValidationError(null);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 text-start transition-colors",
                      projectPartitionMode === "selected"
                        ? "border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-500/15"
                        : "border-gray-200 bg-gray-50/50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t("selectedProjectsOption")}
                      </span>
                      {selectedProjectIds.length > 0 && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                          {t("selectedProjectsCount", {
                            count: selectedProjectIds.length,
                          })}
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                      {t("selectedProjectsDesc")}
                    </span>
                  </button>
                </div>

                {projectPartitionMode === "selected" && (
                  <div className="mt-2.5 rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-950">
                    {projectsQuery.isPending ? (
                      <p className="px-2 py-2 text-xs text-gray-500">
                        {t("projectsLoading")}
                      </p>
                    ) : projectsQuery.isError ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-xs">
                        <span className="text-error-700 dark:text-error-300">
                          {t("projectsLoadError")}
                        </span>
                        <button
                          type="button"
                          onClick={() => void projectsQuery.refetch()}
                          className="cursor-pointer rounded-md bg-white px-2.5 py-1 font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                        >
                          {t("retry")}
                        </button>
                      </div>
                    ) : activeProjects.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">
                        {t("projectsEmpty")}
                      </p>
                    ) : (
                      <>
                        {activeProjects.length > 6 && (
                          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-200/80 pb-2 dark:border-gray-800">
                            <div className="relative min-w-0 flex-1">
                              <SearchIcon
                                aria-hidden="true"
                                className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
                              />
                              <input
                                type="search"
                                value={projectSearchQuery}
                                onChange={(event) =>
                                  setProjectSearchQuery(event.target.value)
                                }
                                placeholder={t("searchProjectsPlaceholder")}
                                aria-label={t("searchProjectsPlaceholder")}
                                className="h-8 w-full rounded-lg border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleSelectAllFilteredProjects}
                              className="cursor-pointer rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                            >
                              {t("selectAllProjects")}
                            </button>
                            <button
                              type="button"
                              onClick={handleClearSelectedProjects}
                              className="cursor-pointer rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
                            >
                              {t("clearSelectedProjects")}
                            </button>
                          </div>
                        )}

                        <ul className="max-h-44 space-y-1 overflow-y-auto">
                          {filteredModalProjects.map((proj) => {
                            const checked = selectedProjectIds.includes(
                              proj.id,
                            );
                            return (
                              <li key={proj.id}>
                                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs hover:bg-white dark:hover:bg-gray-900">
                                  <span className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        handleToggleProjectId(proj.id)
                                      }
                                      className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {proj.name}
                                    </span>
                                  </span>
                                  <code className="rounded bg-gray-200/70 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {proj.code}
                                  </code>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Expiration Selector */}
              <div>
                <Label htmlFor="mcp-key-expiration-select">
                  {t("expirationLabel")}
                </Label>
                <select
                  id="mcp-key-expiration-select"
                  value={expirationPreset}
                  disabled={createMutation.isPending}
                  onChange={(event) =>
                    setExpirationPreset(event.target.value as ExpirationPreset)
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  <option value="30">{t("exp30Days")}</option>
                  <option value="90">{t("exp90Days")}</option>
                  <option value="365">{t("exp365Days")}</option>
                  <option value="never">{t("expNever")}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={createMutation.isPending}
                  onClick={closeCreateModal}
                >
                  {t("cancelCta")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? t("mintingKey")
                    : t("mintKeySubmit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Revoke Confirmation Dialog */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-xs">
          <div
            ref={revokeDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-mcp-key-dialog-title"
            aria-describedby="revoke-mcp-key-dialog-desc"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg sm:p-6 dark:border-gray-800 dark:bg-gray-900"
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
        </div>
      )}
    </div>
  );
}
