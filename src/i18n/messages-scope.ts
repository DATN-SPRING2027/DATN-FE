export const ROOT_BASE_NAMESPACES = [
  "common",
  "pageTitles",
  "roleLabels",
  "notFound",
] as const;

export const LANDING_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "landingScotch",
  "landingRylo",
  "userDropdown",
] as const;

export const AUTH_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "auth",
  "authExperience",
  "accountOnboarding",
] as const;

export const AUTH_INVITATION_NAMESPACES = [
  ...AUTH_NAMESPACES,
  "organizationMembers",
] as const;

export const LEGAL_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "legalCenter",
] as const;

export const DOCS_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "developerDocs",
] as const;

export const PLATFORM_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "auth",
  "header",
  "userDropdown",
  "platformConsole",
  "platformProjectDirectory",
  "platformUserDirectory",
  "platformUserActions",
] as const;

export const ADMIN_NAMESPACES = [
  ...ROOT_BASE_NAMESPACES,
  "auth",
  "authExperience",
  "accountOnboarding",
  "sidebar",
  "header",
  "userDropdown",
  "aiCompanionNotifications",
  "organizationOverview",
  "organizationMembers",
  "organizationIntegrations",
  "organizationSettings",
  "projects",
  "projectMembers",
  "projectLeaders",
  "projectVisibility",
  "work",
  "workNotes",
  "AiChat",
  "TokenUsage",
  "chat",
  "handover",
  "knowledgeUniverse",
  "teams",
  "teamFoundation",
  "teamPreview",
  "profile",
  "users",
  "ecommerce",
] as const;

export function pickMessages(
  messages: Record<string, unknown>,
  namespaces: readonly string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    if (namespace in messages) {
      picked[namespace] = messages[namespace];
    }
  }
  return picked;
}
