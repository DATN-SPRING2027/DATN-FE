"use client";

import { useSyncExternalStore } from "react";

const workspaceIdPattern = /^[A-Za-z0-9._:-]{1,64}$/;
const ORG_PARAM_CHANGE_EVENT = "platform-org-param-change";

function readUrlParam(key: "organizationId" | "projectId"): string {
  if (typeof window === "undefined") return "";
  const candidate = new URLSearchParams(window.location.search).get(key);
  return candidate && workspaceIdPattern.test(candidate) ? candidate : "";
}

function readOrganizationUrlParam(): string {
  return readUrlParam("organizationId");
}

function readProjectUrlParam(): string {
  return readUrlParam("projectId");
}

function getEmptyServerSnapshot(): string {
  return "";
}

function subscribeOrganizationUrlParam(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(ORG_PARAM_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(ORG_PARAM_CHANGE_EVENT, onStoreChange);
  };
}

/** Build a Platform workspace route preserving valid query filters. */
export function buildPlatformWorkspaceHref(
  basePath: string,
  params: { organizationId?: string; projectId?: string },
): string {
  const query = new URLSearchParams();
  if (params.organizationId && workspaceIdPattern.test(params.organizationId)) {
    query.set("organizationId", params.organizationId);
  }
  if (params.projectId && workspaceIdPattern.test(params.projectId)) {
    query.set("projectId", params.projectId);
  }
  const encoded = query.toString();
  return encoded ? `${basePath}?${encoded}` : basePath;
}

/** Atomically update `organizationId` and `projectId` in the URL query string. */
export function syncWorkspaceUrlParams(params: {
  organizationId?: string;
  projectId?: string;
}) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (params.organizationId !== undefined) {
    if (
      params.organizationId &&
      workspaceIdPattern.test(params.organizationId)
    ) {
      url.searchParams.set("organizationId", params.organizationId);
    } else {
      url.searchParams.delete("organizationId");
    }
  }
  if (params.projectId !== undefined) {
    if (params.projectId && workspaceIdPattern.test(params.projectId)) {
      url.searchParams.set("projectId", params.projectId);
    } else {
      url.searchParams.delete("projectId");
    }
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
  window.dispatchEvent(new Event(ORG_PARAM_CHANGE_EVENT));
}

/** Sync the selected workspace organization filter into the current URL query string. */
export function syncOrganizationUrlParam(organizationId: string) {
  syncWorkspaceUrlParams({ organizationId, projectId: "" });
}

/** Sync the selected workspace project ID into the current URL query string. */
export function syncProjectUrlParam(projectId: string) {
  syncWorkspaceUrlParams({ projectId });
}

/** Read and subscribe to `?organizationId=` without causing hydration mismatches. */
export function useOrganizationUrlFilter(enabled: boolean): string {
  const value = useSyncExternalStore(
    subscribeOrganizationUrlParam,
    readOrganizationUrlParam,
    getEmptyServerSnapshot,
  );
  return enabled ? value : "";
}

/** Read and subscribe to `?projectId=` without causing hydration mismatches. */
export function useProjectUrlFilter(enabled: boolean): string {
  const value = useSyncExternalStore(
    subscribeOrganizationUrlParam,
    readProjectUrlParam,
    getEmptyServerSnapshot,
  );
  return enabled ? value : "";
}
