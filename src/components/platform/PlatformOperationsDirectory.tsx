"use client";

import PlatformUsersDirectory from "./PlatformUsersDirectory";
import PlatformProjectsDirectory from "./PlatformProjectsDirectory";
import PlatformServicesDirectory from "./PlatformServicesDirectory";
import PlatformJobsDirectory from "./PlatformJobsDirectory";
import PlatformAiDirectory from "./PlatformAiDirectory";
import PlatformIntegrationsDirectory from "./PlatformIntegrationsDirectory";
import PlatformIncidentsDirectory from "./PlatformIncidentsDirectory";
import PlatformDiagnosticsDirectory from "./PlatformDiagnosticsDirectory";
import PlatformSecurityDirectory from "./PlatformSecurityDirectory";
import { usePlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import type { PlatformOperationsProps } from "./PlatformOperationsTypes";

export default function PlatformOperationsDirectory(
  props: PlatformOperationsProps,
) {
  const model = usePlatformOperationsViewModel(props);

  switch (model.section) {
    case "users":
      return <PlatformUsersDirectory model={model} />;
    case "projects":
      return <PlatformProjectsDirectory model={model} />;
    case "services":
      return <PlatformServicesDirectory model={model} />;
    case "jobs":
      return <PlatformJobsDirectory model={model} />;
    case "ai":
      return <PlatformAiDirectory model={model} />;
    case "integrations":
      return <PlatformIntegrationsDirectory model={model} />;
    case "incidents":
      return <PlatformIncidentsDirectory model={model} />;
    case "diagnostics":
      return <PlatformDiagnosticsDirectory model={model} />;
    case "security":
      return <PlatformSecurityDirectory model={model} />;
  }
}
