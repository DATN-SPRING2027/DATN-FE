"use client";

import dynamic from "next/dynamic";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import { usePlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import type { PlatformOperationsProps } from "./PlatformOperationsTypes";

function OperationsSectionFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

const PlatformUsersDirectory = dynamic(
  () => import("./PlatformUsersDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformProjectsDirectory = dynamic(
  () => import("./PlatformProjectsDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformServicesDirectory = dynamic(
  () => import("./PlatformServicesDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformJobsDirectory = dynamic(
  () => import("./PlatformJobsDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformAiDirectory = dynamic(() => import("./PlatformAiDirectory"), {
  loading: OperationsSectionFallback,
});
const PlatformIntegrationsDirectory = dynamic(
  () => import("./PlatformIntegrationsDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformIncidentsDirectory = dynamic(
  () => import("./PlatformIncidentsDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformDiagnosticsDirectory = dynamic(
  () => import("./PlatformDiagnosticsDirectory"),
  { loading: OperationsSectionFallback },
);
const PlatformSecurityDirectory = dynamic(
  () => import("./PlatformSecurityDirectory"),
  { loading: OperationsSectionFallback },
);

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
