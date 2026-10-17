"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import {
  usePlatformAiOperationsQuery,
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
  usePlatformProjectQuery,
  usePlatformProjectsQuery,
  usePlatformQueuesQuery,
  usePlatformRequestTraceQuery,
  usePlatformRevokeSessionMutation,
  usePlatformServicesQuery,
  usePlatformUserQuery,
  usePlatformUserOrganizationsQuery,
  usePlatformUserSessionQuery,
  usePlatformUserSessionsQuery,
  usePlatformUsersQuery,
} from "@/lib/queries/platform/usePlatformOperations";
import type { PlatformOperationsProps } from "./PlatformOperationsTypes";

function has(
  permissions: readonly PlatformPermission[],
  permission: PlatformPermission,
) {
  return permissions.includes(permission);
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
  const [organizationPage, setOrganizationPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [incidentHistoryPage, setIncidentHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
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
      pageSize: 25,
      search: search.trim() || undefined,
      status: status as "ACTIVE" | "SUSPENDED" | "PENDING_INVITE" | undefined,
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
  );
  const selectedSession = usePlatformUserSessionQuery(
    section === "security" ? operatorId : selectedId,
    selectedSessionId,
    Boolean(selectedSessionId) &&
      ((section === "security" && canReadSessions) ||
        (section === "users" && canReadSessions && Boolean(selectedId))),
  );
  const changeUserStatus = usePlatformChangeUserStatusMutation();
  const revokeSession = usePlatformRevokeSessionMutation();
  const projects = usePlatformProjectsQuery(
    {
      page,
      pageSize: 25,
      search: search.trim() || undefined,
      visibility: status ? (status as "PUBLIC" | "PRIVATE") : undefined,
    },
    section === "projects" && canReadProjects,
  );
  const selectedProject = usePlatformProjectQuery(
    selectedId,
    section === "projects" && canReadProjects,
  );
  const changeProject = usePlatformChangeProjectMetadataMutation();
  const services = usePlatformServicesQuery(
    section === "services" && canReadServices,
  );
  const queues = usePlatformQueuesQuery(section === "jobs" && canReadJobs);
  const jobs = usePlatformJobsQuery(
    { page, pageSize: 25, status: status || undefined },
    section === "jobs" && canReadJobs,
  );
  const jobCommand = usePlatformJobCommandMutation();
  const ai = usePlatformAiOperationsQuery(section === "ai" && canReadAi);
  const integrations = usePlatformIntegrationsQuery(
    { page, pageSize: 25, status: status || undefined },
    section === "integrations" && canReadIntegrations,
  );
  const incidents = usePlatformIncidentsQuery(
    { page, pageSize: 25, status: status || undefined },
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
  ) {
    event.preventDefault();
    setFormMessage("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
    } catch {
      setFormMessage(
        "The operation was not confirmed. Refresh the record before trying again.",
      );
    }
  }
  async function runOperation(action: () => Promise<unknown>) {
    setFormMessage("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
    } catch {
      setFormMessage(
        "The operation was not confirmed. Refresh the record before trying again.",
      );
    }
  }
  const canReadDiagnostics = has(
    permissions,
    "platform.diagnostics.trace.read",
  );

  return {
    section,
    operatorId,
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
    revokeSession,
    projects,
    selectedProject,
    changeProject,
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
