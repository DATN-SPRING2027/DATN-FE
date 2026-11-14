"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api-client";
import {
  usePlatformAllOrganizationsQuery,
  type PlatformPermission,
} from "@/lib/queries/platform/usePlatformConsole";
import {
  usePlatformAddProjectMemberMutation,
  usePlatformAiOperationsQuery,
  usePlatformArchiveUserMutation,
  usePlatformRestoreUserMutation,
  usePlatformChangeProjectMemberRoleMutation,
  usePlatformChangeProjectMetadataMutation,
  usePlatformChangeUserStatusMutation,
  usePlatformCreateIncidentMutation,
  usePlatformIncidentActionMutation,
  usePlatformIncidentQuery,
  usePlatformIncidentHistoryQuery,
  usePlatformIncidentsQuery,
  usePlatformIntegrationsQuery,
  usePlatformJobCommandMutation,
  usePlatformJobsQuery,
  usePlatformProjectMemberCandidatesQuery,
  usePlatformProjectMembershipsQuery,
  usePlatformProjectQuery,
  usePlatformProjectsQuery,
  usePlatformQueuesQuery,
  usePlatformRemoveProjectMemberMutation,
  usePlatformRequestTraceQuery,
  usePlatformRevokeSessionMutation,
  usePlatformServicesQuery,
  usePlatformUserQuery,
  usePlatformUpdateUserProfileMutation,
  usePlatformUserOrganizationsQuery,
  usePlatformUserSessionQuery,
  usePlatformUserSessionsQuery,
  usePlatformUsersQuery,
  type PlatformProjectMemberRoleCode,
} from "@/lib/queries/platform/usePlatformOperations";
import type { PlatformOperationsProps } from "./PlatformOperationsTypes";
import {
  syncOrganizationUrlParam,
  syncProjectUrlParam,
  useOrganizationUrlFilter,
  useProjectUrlFilter,
} from "./ui/organizationUrlFilter";

function has(
  permissions: readonly PlatformPermission[],
  permission: PlatformPermission,
) {
  return permissions.includes(permission);
}

function operationErrorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "The operation could not be confirmed. Refresh the record before trying again.";
  switch (error.code) {
    case "PROJECT_LOCKED":
      return "This project is currently locked. Unlock the project before managing memberships.";
    case "LAST_PROJECT_LEADER_REQUIRED":
      return "An active project must retain at least one Project Leader.";
    case "PROJECT_MEMBER_ALREADY_EXISTS":
      return "This user is already an active member of the project.";
    case "PROJECT_MEMBER_ELIGIBILITY_REQUIRED":
      return "Only active members of the owning organization can join this project.";
    case "PROJECT_CODE_CONFLICT":
      return "A project with this code already exists in the organization.";
  }
  switch (error.status) {
    case 401:
      return "Your Platform session expired. Sign in again to continue.";
    case 403:
      return "Your Platform account does not have permission to complete this action.";
    case 404:
      return "This record no longer exists. Refresh the directory.";
    case 409:
      return "This record changed after it was loaded. Current details are refreshing; review them before trying again.";
    case 422:
      return "Some values are invalid or the action is not allowed for this account state. Review the form and try again.";
    case 429:
      return "Too many requests were made. Wait a moment before trying this action again.";
    case 500:
      return "The Platform service could not complete this action. No success was confirmed.";
    case 503:
      return "The Platform service is temporarily unavailable. No success was confirmed.";
    default:
      if (error.status >= 500)
        return "The Platform service could not confirm this action. No success was confirmed.";
      return "The operation could not be confirmed. Refresh the record before trying again.";
  }
}

export function usePlatformOperationsViewModel({
  section,
  permissions,
  operatorId,
}: PlatformOperationsProps) {
  const canReadUsers = has(permissions, "platform.users.account.read");
  const canManageUsers = has(permissions, "platform.users.account.manage");
  const canReadSessions = has(permissions, "platform.sessions.session.read");
  const canManageSessions = has(
    permissions,
    "platform.sessions.session.manage",
  );
  const canReadProjects = has(permissions, "platform.projects.project.read");
  const canManageProjects = has(
    permissions,
    "platform.projects.project.manage",
  );
  const canReadServices = has(permissions, "platform.services.service.read");
  const canReadJobs = has(permissions, "platform.jobs.job.read");
  const canManageJobs = has(permissions, "platform.jobs.job.manage");
  const canReadAi = has(permissions, "platform.ai.operations.read");
  const canReadIntegrations = has(
    permissions,
    "platform.integrations.integration.read",
  );
  const canReadIncidents = has(permissions, "platform.incidents.incident.read");
  const canManageIncidents = has(
    permissions,
    "platform.incidents.incident.manage",
  );
  const [page, setPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);
  const [userOrganizationId, setUserOrganizationId] = useState("");
  const projectOrganizationId = useOrganizationUrlFilter(
    section === "projects",
  );
  const urlProjectId = useProjectUrlFilter(section === "projects");
  const [projectVisibility, setProjectVisibilityState] = useState<
    "" | "PUBLIC" | "PRIVATE"
  >("");
  const [lastErrorCode, setLastErrorCode] = useState("");
  const canFilterUserOrganizations = has(
    permissions,
    "platform.organizations.organization.read",
  );
  const filterOrganizations = usePlatformAllOrganizationsQuery(
    canFilterUserOrganizations &&
      ((section === "users" && canReadUsers) ||
        (section === "projects" && canReadProjects)),
  );
  function setProjectOrganizationId(nextOrganizationId: string) {
    setPage(1);
    syncOrganizationUrlParam(nextOrganizationId);
  }
  function setProjectVisibility(nextVisibility: "" | "PUBLIC" | "PRIVATE") {
    setProjectVisibilityState(nextVisibility);
    setPage(1);
  }
  const [organizationPage, setOrganizationPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [incidentHistoryPage, setIncidentHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusBySection, setStatusBySection] = useState<
    Partial<Record<PlatformOperationsProps["section"], string>>
  >({});
  const status = statusBySection[section] ?? "";
  function setStatus(nextStatus: string) {
    setStatusBySection((current) => ({ ...current, [section]: nextStatus }));
  }
  const [selectedIdState, setSelectedIdState] = useState("");
  const selectedId = section === "projects" ? urlProjectId : selectedIdState;
  const [projectMemberScope, setProjectMemberScope] = useState<{
    projectId: string;
    page: number;
    search: string;
    status: "" | "ACTIVE" | "INACTIVE";
    role: "" | PlatformProjectMemberRoleCode;
    candidateSearch: string;
  }>({
    projectId: "",
    page: 1,
    search: "",
    status: "",
    role: "",
    candidateSearch: "",
  });
  const activeMemberScope =
    projectMemberScope.projectId === selectedId
      ? projectMemberScope
      : {
          projectId: selectedId,
          page: 1,
          search: "",
          status: "" as const,
          role: "" as const,
          candidateSearch: "",
        };
  const projectMemberPage = activeMemberScope.page;
  const projectMemberSearch = activeMemberScope.search;
  const projectMemberStatus = activeMemberScope.status;
  const projectMemberRole = activeMemberScope.role;
  const projectCandidateSearch = activeMemberScope.candidateSearch;

  function setProjectMemberPage(nextPage: number) {
    setProjectMemberScope((current) => {
      const base =
        current.projectId === selectedId
          ? current
          : {
              projectId: selectedId,
              page: 1,
              search: "",
              status: "" as const,
              role: "" as const,
              candidateSearch: "",
            };
      return { ...base, page: nextPage };
    });
  }
  function setProjectMemberSearch(value: string) {
    setProjectMemberScope((current) => {
      const base =
        current.projectId === selectedId
          ? current
          : {
              projectId: selectedId,
              page: 1,
              search: "",
              status: "" as const,
              role: "" as const,
              candidateSearch: "",
            };
      return { ...base, search: value, page: 1 };
    });
  }
  function setProjectMemberStatus(value: "" | "ACTIVE" | "INACTIVE") {
    setProjectMemberScope((current) => {
      const base =
        current.projectId === selectedId
          ? current
          : {
              projectId: selectedId,
              page: 1,
              search: "",
              status: "" as const,
              role: "" as const,
              candidateSearch: "",
            };
      return { ...base, status: value, page: 1 };
    });
  }
  function setProjectMemberRole(value: "" | PlatformProjectMemberRoleCode) {
    setProjectMemberScope((current) => {
      const base =
        current.projectId === selectedId
          ? current
          : {
              projectId: selectedId,
              page: 1,
              search: "",
              status: "" as const,
              role: "" as const,
              candidateSearch: "",
            };
      return { ...base, role: value, page: 1 };
    });
  }
  function setProjectCandidateSearch(value: string) {
    setProjectMemberScope((current) => {
      const base =
        current.projectId === selectedId
          ? current
          : {
              projectId: selectedId,
              page: 1,
              search: "",
              status: "" as const,
              role: "" as const,
              candidateSearch: "",
            };
      return { ...base, candidateSearch: value };
    });
  }
  function setSelectedId(nextId: string) {
    setSelectedIdState(nextId);
    if (section === "projects") {
      syncProjectUrlParam(nextId);
      setFormMessage("");
      setLastErrorCode("");
    }
  }
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [note, setNote] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const userDetailDialogRef = useRef<HTMLDialogElement>(null);
  const userDetailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const userDetailTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selectedId) {
      userDetailTriggerRef.current?.focus();
      return;
    }

    const dialog = userDetailDialogRef.current;
    if (!dialog) return;

    userDetailTriggerRef.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    userDetailCloseButtonRef.current?.focus();
  }, [selectedId]);

  function closeUserDetails() {
    setSelectedId("");
    setSelectedSessionId("");
  }

  const users = usePlatformUsersQuery(
    {
      page,
      pageSize: userPageSize,
      organizationId: userOrganizationId || undefined,
      search: search.trim() || undefined,
      status:
        section === "users" && status
          ? (status as "ACTIVE" | "SUSPENDED" | "PENDING_INVITE" | "ARCHIVED")
          : undefined,
    },
    section === "users" && canReadUsers,
  );
  const selectedUser = usePlatformUserQuery(
    selectedId,
    section === "users" && canReadUsers,
  );
  const userOrganizations = usePlatformUserOrganizationsQuery(
    selectedId,
    section === "users" && canReadUsers && Boolean(selectedId),
    organizationPage,
  );
  const userSessions = usePlatformUserSessionsQuery(
    section === "security" ? operatorId : selectedId,
    (section === "security" && canReadSessions) ||
      (section === "users" && canReadSessions && Boolean(selectedId)),
    sessionPage,
    section === "security" ? 10 : 25,
  );
  const selectedSession = usePlatformUserSessionQuery(
    section === "security" ? operatorId : selectedId,
    selectedSessionId,
    Boolean(selectedSessionId) &&
      ((section === "security" && canReadSessions) ||
        (section === "users" && canReadSessions && Boolean(selectedId))),
  );
  const changeUserStatus = usePlatformChangeUserStatusMutation();
  const updateUserProfile = usePlatformUpdateUserProfileMutation();
  const archiveUser = usePlatformArchiveUserMutation();
  const restoreUser = usePlatformRestoreUserMutation();
  const revokeSession = usePlatformRevokeSessionMutation();
  const projects = usePlatformProjectsQuery(
    {
      page,
      pageSize: 10,
      organizationId: projectOrganizationId || undefined,
      search: search.trim() || undefined,
      visibility: projectVisibility || undefined,
      status:
        section === "projects" &&
        (status === "ACTIVE" || status === "ARCHIVED")
          ? status
          : undefined,
    },
    section === "projects" && canReadProjects,
  );
  const selectedProject = usePlatformProjectQuery(
    selectedId,
    section === "projects" && canReadProjects,
  );
  const changeProject = usePlatformChangeProjectMetadataMutation();
  const projectMembers = usePlatformProjectMembershipsQuery(
    selectedId,
    {
      page: projectMemberPage,
      pageSize: 10,
      search: projectMemberSearch.trim() || undefined,
      status: projectMemberStatus || undefined,
      roleCode: projectMemberRole || undefined,
    },
    section === "projects" && canReadProjects && Boolean(selectedId),
  );
  const projectMemberCandidates = usePlatformProjectMemberCandidatesQuery(
    selectedId,
    projectCandidateSearch,
    section === "projects" && canManageProjects && Boolean(selectedId),
  );
  const addProjectMember = usePlatformAddProjectMemberMutation();
  const changeProjectMemberRole = usePlatformChangeProjectMemberRoleMutation();
  const removeProjectMember = usePlatformRemoveProjectMemberMutation();
  const services = usePlatformServicesQuery(
    section === "services" && canReadServices,
  );
  const queues = usePlatformQueuesQuery(section === "jobs" && canReadJobs);
  const jobs = usePlatformJobsQuery(
    { page, pageSize: 10, status: status || undefined },
    section === "jobs" && canReadJobs,
  );
  const jobCommand = usePlatformJobCommandMutation();
  const ai = usePlatformAiOperationsQuery(section === "ai" && canReadAi);
  const integrations = usePlatformIntegrationsQuery(
    { page, pageSize: 10, status: status || undefined },
    section === "integrations" && canReadIntegrations,
  );
  const incidents = usePlatformIncidentsQuery(
    { page, pageSize: 10, status: status || undefined },
    section === "incidents" && canReadIncidents,
  );
  const incidentHistory = usePlatformIncidentHistoryQuery(
    selectedId,
    section === "incidents" && canReadIncidents && Boolean(selectedId),
    incidentHistoryPage,
  );
  const selectedIncident = usePlatformIncidentQuery(
    selectedId,
    section === "incidents" && canReadIncidents && Boolean(selectedId),
  );
  const createIncident = usePlatformCreateIncidentMutation();
  const incidentAction = usePlatformIncidentActionMutation();
  const trace = usePlatformRequestTraceQuery(
    traceId,
    section === "diagnostics" &&
      Boolean(traceId) &&
      has(permissions, "platform.diagnostics.trace.read"),
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<unknown>,
  ): Promise<boolean> {
    event.preventDefault();
    setFormMessage("");
    setLastErrorCode("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
      return true;
    } catch (error) {
      setLastErrorCode(error instanceof ApiError ? (error.code ?? "") : "");
      setFormMessage(operationErrorMessage(error));
      return false;
    }
  }
  async function runOperation(
    action: () => Promise<unknown>,
  ): Promise<boolean> {
    setFormMessage("");
    setLastErrorCode("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
      return true;
    } catch (error) {
      setLastErrorCode(error instanceof ApiError ? (error.code ?? "") : "");
      setFormMessage(operationErrorMessage(error));
      return false;
    }
  }
  const canReadDiagnostics = has(
    permissions,
    "platform.diagnostics.trace.read",
  );

  return {
    section,
    operatorId,
    permissions,
    canReadUsers,
    canManageUsers,
    canReadSessions,
    canManageSessions,
    canReadProjects,
    canManageProjects,
    canReadServices,
    canReadJobs,
    canManageJobs,
    canReadAi,
    canReadIntegrations,
    canReadIncidents,
    canManageIncidents,
    canReadDiagnostics,
    page,
    setPage,
    userPageSize,
    setUserPageSize,
    userOrganizationId,
    setUserOrganizationId,
    projectOrganizationId,
    setProjectOrganizationId,
    projectVisibility,
    setProjectVisibility,
    projectMemberPage,
    setProjectMemberPage,
    projectMemberSearch,
    setProjectMemberSearch,
    projectMemberStatus,
    setProjectMemberStatus,
    projectMemberRole,
    setProjectMemberRole,
    projectCandidateSearch,
    setProjectCandidateSearch,
    lastErrorCode,
    setLastErrorCode,
    canFilterUserOrganizations,
    filterOrganizations,
    organizationPage,
    setOrganizationPage,
    sessionPage,
    setSessionPage,
    incidentHistoryPage,
    setIncidentHistoryPage,
    search,
    setSearch,
    status,
    setStatus,
    selectedId,
    setSelectedId,
    selectedSessionId,
    setSelectedSessionId,
    requestId,
    setRequestId,
    traceId,
    setTraceId,
    note,
    setNote,
    formMessage,
    setFormMessage,
    userDetailDialogRef,
    userDetailCloseButtonRef,
    closeUserDetails,
    users,
    selectedUser,
    userOrganizations,
    userSessions,
    selectedSession,
    changeUserStatus,
    updateUserProfile,
    archiveUser,
    restoreUser,
    revokeSession,
    projects,
    selectedProject,
    changeProject,
    projectMembers,
    projectMemberCandidates,
    addProjectMember,
    changeProjectMemberRole,
    removeProjectMember,
    services,
    queues,
    jobs,
    jobCommand,
    ai,
    integrations,
    incidents,
    incidentHistory,
    selectedIncident,
    createIncident,
    incidentAction,
    trace,
    handleSubmit,
    runOperation,
  };
}

export type PlatformOperationsViewModel = ReturnType<
  typeof usePlatformOperationsViewModel
>;
