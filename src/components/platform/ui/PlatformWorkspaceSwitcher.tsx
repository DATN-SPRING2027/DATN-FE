"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  PlatformBuildingIcon,
  SearchIcon,
} from "@/icons";
import {
  usePlatformAllOrganizationsQuery,
  type PlatformPermission,
} from "@/lib/queries/platform/usePlatformConsole";
import {
  buildPlatformWorkspaceHref,
  syncWorkspaceUrlParams,
  useOrganizationUrlFilter,
} from "./organizationUrlFilter";
import styles from "./PlatformWorkspaceSwitcher.module.css";

function getOrganizationInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Taskbar Organization dropdown switcher under the Workspace group. */
export default function PlatformWorkspaceSwitcher({
  activeSection,
  permissions,
}: Readonly<{
  activeSection: string;
  permissions: readonly PlatformPermission[];
}>) {
  const t = useTranslations("platformConsole");
  const router = useRouter();

  const canReadOrganizations = permissions.includes(
    "platform.organizations.organization.read",
  );
  const canReadProjects = permissions.includes(
    "platform.projects.project.read",
  );
  const canReadMemberships = permissions.includes(
    "platform.memberships.membership.read",
  );
  const canSwitchWorkspace =
    canReadOrganizations && (canReadProjects || canReadMemberships);

  const selectedOrgId = useOrganizationUrlFilter(canSwitchWorkspace);

  const [isOpen, setIsOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const organizationsQuery = usePlatformAllOrganizationsQuery(canSwitchWorkspace);

  const organizations = useMemo(
    () => organizationsQuery.data?.data ?? [],
    [organizationsQuery.data],
  );

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId),
    [organizations, selectedOrgId],
  );

  const filteredOrganizations = useMemo(() => {
    const query = orgSearch.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.slug.toLowerCase().includes(query),
    );
  }, [organizations, orgSearch]);

  if (!canSwitchWorkspace) return null;

  function navigateWorkspace(href: string) {
    if ("push" in router && typeof router.push === "function") {
      router.push(href as never);
    } else {
      router.replace(href as never);
    }
  }

  function handleSelectOrganization(organizationId: string) {
    syncWorkspaceUrlParams({ organizationId, projectId: "" });
    setIsOpen(false);
    setOrgSearch("");

    if (activeSection !== "projects" && activeSection !== "memberships") {
      const targetPath = canReadProjects
        ? "/platform/projects"
        : "/platform/memberships";
      navigateWorkspace(
        buildPlatformWorkspaceHref(targetPath, { organizationId }),
      );
    }
  }

  const orgDisplayValue = selectedOrg
    ? selectedOrg.name
    : selectedOrgId
      ? organizationsQuery.isPending
        ? t("workspaceSwitcher.loadingOrganizations")
        : selectedOrgId
      : t("workspaceSwitcher.allOrganizations");

  return (
    <div ref={rootRef} className={styles.switcher}>
      <div className={styles.selectorWrap}>
        <button
          type="button"
          aria-label={t("workspaceSwitcher.organizationSwitcherLabel")}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        >
          <span
            aria-hidden="true"
            className={`${styles.orgBadge} ${
              selectedOrg ? styles.orgBadgeSelected : ""
            }`}
          >
            {selectedOrg ? (
              getOrganizationInitials(selectedOrg.name)
            ) : (
              <PlatformBuildingIcon />
            )}
          </span>
          <span className={styles.triggerText}>
            <span className={styles.microLabel}>
              {t("workspaceSwitcher.organizationLabel")}
            </span>
            <span className={styles.valueRow}>
              <span className={styles.valueText}>{orgDisplayValue}</span>
              {!selectedOrg && organizations.length > 0 && (
                <span className={styles.countPill}>
                  {organizations.length}
                </span>
              )}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
        </button>

        {isOpen && (
          <div className={styles.popover}>
            <div className={styles.popoverHeader}>
              <span>{t("workspaceSwitcher.organizationListLabel")}</span>
              {organizations.length > 0 && (
                <span className={styles.countPill}>
                  {organizations.length}
                </span>
              )}
            </div>
            <div className={styles.searchWrap}>
              <SearchIcon aria-hidden="true" className={styles.searchIcon} />
              <input
                type="search"
                value={orgSearch}
                autoFocus
                aria-label={t(
                  "workspaceSwitcher.searchOrganizationsPlaceholder",
                )}
                placeholder={t(
                  "workspaceSwitcher.searchOrganizationsPlaceholder",
                )}
                onChange={(event) => setOrgSearch(event.target.value)}
                className={styles.searchInput}
              />
            </div>

            {!orgSearch.trim() && (
              <>
                <button
                  type="button"
                  onClick={() => handleSelectOrganization("")}
                  className={`${styles.optionButton} ${
                    !selectedOrgId ? styles.optionButtonActive : ""
                  }`}
                >
                  <span aria-hidden="true" className={styles.optionAvatar}>
                    <PlatformBuildingIcon />
                  </span>
                  <span className={styles.optionBody}>
                    <span className={styles.optionTitle}>
                      {t("workspaceSwitcher.allOrganizationsOption")}
                    </span>
                  </span>
                  {!selectedOrgId && (
                    <CheckCircleIcon
                      aria-hidden="true"
                      className={styles.checkIcon}
                    />
                  )}
                </button>
                <div className={styles.divider} />
              </>
            )}

            {organizationsQuery.isPending && !organizations.length ? (
              <p className={styles.emptyState}>
                {t("workspaceSwitcher.loadingOrganizations")}
              </p>
            ) : organizationsQuery.isError && !organizations.length ? (
              <div className={styles.emptyState}>
                <p>{t("workspaceSwitcher.organizationsLoadError")}</p>
                <button
                  type="button"
                  onClick={() => void organizationsQuery.refetch()}
                  className={styles.retryAction}
                >
                  {t("workspaceSwitcher.retry")}
                </button>
              </div>
            ) : filteredOrganizations.length ? (
              <ul
                role="listbox"
                aria-label={t("workspaceSwitcher.organizationListLabel")}
                className={styles.optionList}
              >
                {filteredOrganizations.map((org) => {
                  const isSelected = org.id === selectedOrgId;
                  return (
                    <li key={org.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectOrganization(org.id)}
                        className={`${styles.optionButton} ${
                          isSelected ? styles.optionButtonActive : ""
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={styles.optionAvatar}
                        >
                          {getOrganizationInitials(org.name)}
                        </span>
                        <span className={styles.optionBody}>
                          <span className={styles.optionTitleRow}>
                            <span className={styles.optionTitle}>
                              {org.name}
                            </span>
                          </span>
                          <span className={styles.optionMeta}>
                            {org.slug} · {org.plan}
                          </span>
                        </span>
                        {isSelected && (
                          <CheckCircleIcon
                            aria-hidden="true"
                            className={styles.checkIcon}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                {t("workspaceSwitcher.noOrganizationsMatch")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
