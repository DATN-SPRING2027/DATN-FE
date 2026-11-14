"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  FolderIcon,
  LockIcon,
  PlatformBuildingIcon,
  SearchIcon,
} from "@/icons";
import {
  usePlatformAllOrganizationsQuery,
  type PlatformPermission,
} from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformAllOrganizationProjectsQuery } from "@/lib/queries/platform/usePlatformOperations";
import {
  buildPlatformWorkspaceHref,
  syncWorkspaceUrlParams,
  useOrganizationUrlFilter,
  useProjectUrlFilter,
} from "./organizationUrlFilter";
import styles from "./PlatformWorkspaceSwitcher.module.css";

function getOrganizationInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getProjectBadgeCode(code: string): string {
  return code.trim().slice(0, 3).toUpperCase() || "PRJ";
}

/** Taskbar Organization and Project dropdown switchers under the Workspace group. */
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

  const selectedOrgId = useOrganizationUrlFilter(
    canReadProjects || canReadMemberships,
  );
  const selectedProjectId = useProjectUrlFilter(
    canReadProjects || canReadMemberships,
  );

  const [openMenu, setOpenMenu] = useState<null | "org" | "project">(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const organizationsQuery = usePlatformAllOrganizationsQuery(
    canReadOrganizations && (canReadProjects || canReadMemberships),
  );
  const orgProjectsQuery = usePlatformAllOrganizationProjectsQuery(
    selectedOrgId,
    canReadProjects && Boolean(selectedOrgId),
  );

  const organizations = useMemo(
    () => organizationsQuery.data?.data ?? [],
    [organizationsQuery.data],
  );
  const orgProjects = useMemo(
    () => orgProjectsQuery.data?.data ?? [],
    [orgProjectsQuery.data],
  );

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId),
    [organizations, selectedOrgId],
  );
  const selectedProject = useMemo(
    () => orgProjects.find((project) => project.id === selectedProjectId),
    [orgProjects, selectedProjectId],
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

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return orgProjects;
    return orgProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.code.toLowerCase().includes(query),
    );
  }, [orgProjects, projectSearch]);

  if (!canReadProjects && !canReadMemberships) return null;

  function navigateWorkspace(href: string) {
    if ("push" in router && typeof router.push === "function") {
      router.push(href as never);
    } else {
      router.replace(href as never);
    }
  }

  function handleSelectOrganization(organizationId: string) {
    syncWorkspaceUrlParams({ organizationId, projectId: "" });
    setOpenMenu(null);
    setOrgSearch("");
    setProjectSearch("");

    if (activeSection !== "projects" && activeSection !== "memberships") {
      const targetPath = canReadProjects
        ? "/platform/projects"
        : "/platform/memberships";
      navigateWorkspace(
        buildPlatformWorkspaceHref(targetPath, { organizationId }),
      );
    }
  }

  function handleSelectProject(projectId: string) {
    syncWorkspaceUrlParams({
      organizationId: selectedOrgId,
      projectId,
    });
    setOpenMenu(null);
    setProjectSearch("");

    if (activeSection !== "projects") {
      navigateWorkspace(
        buildPlatformWorkspaceHref("/platform/projects", {
          organizationId: selectedOrgId,
          projectId,
        }),
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

  const projectDisplayValue = !selectedOrgId
    ? t("workspaceSwitcher.selectOrgFirst")
    : selectedProject
      ? selectedProject.name
      : orgProjectsQuery.data
        ? t("workspaceSwitcher.selectProjectCount", {
            count: String(orgProjects.length),
          })
        : orgProjectsQuery.isPending
          ? t("workspaceSwitcher.loadingProjects")
          : t("workspaceSwitcher.selectProject");

  return (
    <div ref={rootRef} className={styles.switcher}>
      {canReadOrganizations && (
        <div className={styles.selectorWrap}>
          <button
            type="button"
            aria-label={t("workspaceSwitcher.organizationSwitcherLabel")}
            aria-haspopup="listbox"
            aria-expanded={openMenu === "org"}
            onClick={() => {
              setProjectSearch("");
              setOpenMenu((prev) => (prev === "org" ? null : "org"));
            }}
            className={`${styles.trigger} ${
              openMenu === "org" ? styles.triggerOpen : ""
            }`}
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
              className={`${styles.chevron} ${
                openMenu === "org" ? styles.chevronOpen : ""
              }`}
            />
          </button>

          {openMenu === "org" && (
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
      )}

      {canReadProjects && (
        <div className={styles.selectorWrap}>
          <button
            type="button"
            aria-label={t("workspaceSwitcher.projectSwitcherLabel")}
            aria-haspopup={selectedOrgId ? "listbox" : "dialog"}
            aria-expanded={openMenu === "project"}
            onClick={() => {
              setOrgSearch("");
              setOpenMenu((prev) => (prev === "project" ? null : "project"));
            }}
            className={`${styles.trigger} ${
              openMenu === "project" ? styles.triggerOpen : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`${styles.projectBadge} ${
                selectedProject ? styles.projectBadgeSelected : ""
              }`}
            >
              {selectedProject ? (
                getProjectBadgeCode(selectedProject.code)
              ) : (
                <FolderIcon />
              )}
            </span>
            <span className={styles.triggerText}>
              <span className={styles.microLabel}>
                {t("workspaceSwitcher.projectLabel")}
              </span>
              <span className={styles.valueRow}>
                <span
                  className={`${styles.valueText} ${
                    !selectedOrgId ? styles.valueMuted : ""
                  }`}
                >
                  {projectDisplayValue}
                </span>
                {selectedProject?.status === "ARCHIVED" && (
                  <LockIcon aria-hidden="true" className={styles.lockMini} />
                )}
              </span>
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className={`${styles.chevron} ${
                openMenu === "project" ? styles.chevronOpen : ""
              }`}
            />
          </button>

          {openMenu === "project" && (
            <div className={styles.popover}>
              {!selectedOrgId ? (
                <div className={styles.hintCard}>
                  <p>{t("workspaceSwitcher.selectOrgFirstHint")}</p>
                  {canReadOrganizations && (
                    <button
                      type="button"
                      onClick={() => setOpenMenu("org")}
                      className={styles.hintAction}
                    >
                      {t("workspaceSwitcher.chooseOrgAction")}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.popoverHeader}>
                    <span>{t("workspaceSwitcher.projectListLabel")}</span>
                    {orgProjects.length > 0 && (
                      <span className={styles.countPill}>
                        {orgProjects.length}
                      </span>
                    )}
                  </div>
                  <div className={styles.searchWrap}>
                    <SearchIcon
                      aria-hidden="true"
                      className={styles.searchIcon}
                    />
                    <input
                      type="search"
                      value={projectSearch}
                      autoFocus
                      aria-label={t(
                        "workspaceSwitcher.searchProjectsPlaceholder",
                      )}
                      placeholder={t(
                        "workspaceSwitcher.searchProjectsPlaceholder",
                      )}
                      onChange={(event) => setProjectSearch(event.target.value)}
                      className={styles.searchInput}
                    />
                  </div>

                  {selectedProjectId && !projectSearch.trim() && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectProject("")}
                        className={styles.optionButton}
                      >
                        <span aria-hidden="true" className={styles.optionAvatar}>
                          <FolderIcon />
                        </span>
                        <span className={styles.optionBody}>
                          <span className={styles.optionTitle}>
                            {t("workspaceSwitcher.allProjectsInOrg", {
                              name: selectedOrg?.name ?? selectedOrgId,
                            })}
                          </span>
                        </span>
                      </button>
                      <div className={styles.divider} />
                    </>
                  )}

                  {orgProjectsQuery.isPending && !orgProjects.length ? (
                    <p className={styles.emptyState}>
                      {t("workspaceSwitcher.loadingProjects")}
                    </p>
                  ) : orgProjectsQuery.isError && !orgProjects.length ? (
                    <div className={styles.emptyState}>
                      <p>{t("workspaceSwitcher.projectsLoadError")}</p>
                      <button
                        type="button"
                        onClick={() => void orgProjectsQuery.refetch()}
                        className={styles.retryAction}
                      >
                        {t("workspaceSwitcher.retry")}
                      </button>
                    </div>
                  ) : !orgProjects.length ? (
                    <p className={styles.emptyState}>
                      {t("workspaceSwitcher.noProjectsInOrg")}
                    </p>
                  ) : filteredProjects.length ? (
                    <ul
                      role="listbox"
                      aria-label={t("workspaceSwitcher.projectListLabel")}
                      className={styles.optionList}
                    >
                      {filteredProjects.map((project) => {
                        const isSelected = project.id === selectedProjectId;
                        const isLocked = project.status === "ARCHIVED";
                        return (
                          <li key={project.id} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectProject(project.id)}
                              className={`${styles.optionButton} ${
                                isSelected ? styles.optionButtonActive : ""
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${styles.optionAvatar} ${styles.optionAvatarCode}`}
                              >
                                {getProjectBadgeCode(project.code)}
                              </span>
                              <span className={styles.optionBody}>
                                <span className={styles.optionTitleRow}>
                                  <span className={styles.optionTitle}>
                                    {project.name}
                                  </span>
                                  {isLocked && (
                                    <span className={styles.lockedTag}>
                                      <LockIcon aria-hidden="true" />
                                      <span>
                                        {t("workspaceSwitcher.lockedBadge")}
                                      </span>
                                    </span>
                                  )}
                                </span>
                                <span className={styles.optionMeta}>
                                  <span>{project.code}</span>
                                  <span>·</span>
                                  <span>
                                    {t("workspaceSwitcher.memberCountShort", {
                                      count: String(project.memberCount),
                                    })}
                                  </span>
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
                      {t("workspaceSwitcher.noProjectsMatch")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
