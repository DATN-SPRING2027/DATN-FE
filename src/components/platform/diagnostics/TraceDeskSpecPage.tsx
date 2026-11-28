"use client";

import { useTranslations } from "next-intl";
import PlatformShell from "../ui/PlatformShell";
import RagTraceExplorer from "./RagTraceExplorer";

export default function TraceDeskSpecPage() {
  const t = useTranslations("platformConsole.ragTrace.explorer");

  return (
    <PlatformShell
      activeSection="diagnostics"
      permissions={["platform.diagnostics.trace.read"]}
      contentStyle="custom"
      operatorName={t("operatorName")}
      operatorEmail={t("operatorEmail")}
      onSignOut={() => undefined}
    >
      <RagTraceExplorer />
    </PlatformShell>
  );
}
