"use client";

import Button from "@/components/ui/button/Button";
import { usePlatformAuditQuery, type PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export default function PlatformAuditProjection({ permissions }: { permissions: readonly PlatformPermission[] }) {
  const t = useTranslations("platformConsole");
  const allowed = permissions.includes("platform.audit.read");
  const audit = usePlatformAuditQuery(allowed);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [resource, setResource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filtered = useMemo(() => (audit.data ?? []).filter((event) => {
    const time = Date.parse(event.occurredAt);
    return (!action || event.action.toLowerCase().includes(action.trim().toLowerCase())) &&
      (!actor || event.actorUserId.toLowerCase().includes(actor.trim().toLowerCase())) &&
      (!resource || event.targetResource.toLowerCase().includes(resource.trim().toLowerCase())) &&
      (!from || time >= new Date(`${from}T00:00:00`).getTime()) &&
      (!to || time <= new Date(`${to}T23:59:59.999`).getTime());
  }), [action, actor, audit.data, from, resource, to]);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div><h3 className="font-semibold text-gray-900 dark:text-white">{t("audit.title")}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("audit.boundedNote")}</p></div>
        <Button variant="outline" size="sm" disabled={!allowed || audit.isFetching} onClick={() => void audit.refetch()}>{audit.isFetching ? t("refreshing") : t("refresh")}</Button>
      </div>
      {!allowed ? <p role="status" className="px-5 py-5 text-sm text-gray-500 dark:text-gray-400">{t("audit.permissionNeeded")}</p> : audit.isError ? <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert"><p className="text-sm text-error-600 dark:text-error-400">{t("errors.audit")}</p><button type="button" onClick={() => void audit.refetch()} className="text-sm font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div> : audit.isPending ? <p className="px-5 py-8 text-sm text-gray-500" role="status">{t("audit.loading")}</p> : (
        <>
          <div className="grid gap-3 border-b border-gray-100 p-5 sm:grid-cols-2 xl:grid-cols-5 dark:border-gray-800">
            <FilterInput label={t("audit.filterAction")} value={action} onChange={setAction} />
            <FilterInput label={t("audit.filterActor")} value={actor} onChange={setActor} />
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">{t("audit.filterResource")}<select value={resource} onChange={(event) => setResource(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="">{t("audit.allResources")}</option><option value="ORGANIZATION">ORGANIZATION</option><option value="ORGANIZATION_MEMBERSHIP">ORGANIZATION_MEMBERSHIP</option><option value="PLATFORM_AUTHORITY">PLATFORM_AUTHORITY</option></select></label>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">{t("audit.from")}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">{t("audit.to")}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
          </div>
          <p className="px-5 pt-4 text-xs text-gray-500 dark:text-gray-400">{t("audit.localFilterNote", { count: audit.data?.length ?? 0, filtered: filtered.length })}</p>
          {filtered.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-5 py-3 text-start font-medium">{t("table.event")}</th><th className="px-5 py-3 text-start font-medium">{t("table.target")}</th><th className="px-5 py-3 text-start font-medium">{t("table.actor")}</th><th className="px-5 py-3 text-start font-medium">{t("table.time")}</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filtered.map((row, index) => <tr key={`${row.action}-${row.targetResourceId}-${row.occurredAt}-${index}`}><td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{row.action}</td><td className="px-5 py-3"><p>{row.targetResource}</p><p className="text-xs text-gray-500">{row.targetResourceId}</p></td><td className="px-5 py-3 font-mono text-xs text-gray-500">{row.actorUserId}</td><td className="px-5 py-3 text-gray-500">{new Date(row.occurredAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="px-5 py-8 text-center"><h4 className="font-semibold text-gray-800 dark:text-gray-100">{audit.data?.length ? t("audit.noFilterMatches") : t("audit.emptyTitle")}</h4><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{audit.data?.length ? t("audit.noFilterMatchesHelp") : t("audit.emptyBody")}</p></div>}
        </>
      )}
    </section>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">{label}<input value={value} onChange={(event) => onChange(event.target.value)} maxLength={100} className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>;
}
