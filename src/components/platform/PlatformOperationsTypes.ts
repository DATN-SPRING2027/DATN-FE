import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";

export type PlatformOperationsSection =
  | "users"
  | "projects"
  | "services"
  | "jobs"
  | "ai"
  | "integrations"
  | "incidents"
  | "diagnostics"
  | "security";

export type PlatformOperationsProps = Readonly<{
  section: PlatformOperationsSection;
  permissions: readonly PlatformPermission[];
  operatorId: string;
}>;
