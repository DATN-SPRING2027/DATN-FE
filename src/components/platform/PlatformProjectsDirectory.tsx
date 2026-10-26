"use client";

import { useTranslations } from "next-intl";
import ProjectDirectory from "./projects/ProjectDirectory";
import ProjectDetail from "./projects/ProjectDetail";
import { box } from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformProjectsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformProjectDirectory");
  if (!model.canReadProjects) {
    return (
      <p
        role="status"
        className={`${box} p-6 text-sm text-warning-700 dark:text-warning-400`}
      >
        {t("denied")}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <ProjectDirectory model={model} />
      <ProjectDetail model={model} />
    </div>
  );
}
