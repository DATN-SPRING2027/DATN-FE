"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, PlusIcon, SettingsIcon, TrashBinIcon } from "@/icons";

const FIELD_CLASS = "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300";

export default function WorkNotesConfigPanel() {
  const t = useTranslations("workNotes");
  const weekdays = (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const).map((value) => ({
    value,
    label: t(`config.days.${value}`),
  }));
  const [templates, setTemplates] = useState([t("config.templates.workUpdate"), t("config.templates.weeklyReport"), t("config.templates.knowledge")]);
  const [reminderDay, setReminderDay] = useState("FRIDAY");
  const [reminderTime, setReminderTime] = useState("15:00");
  const [deadlineDay, setDeadlineDay] = useState("MONDAY");
  const [requiredSections, setRequiredSections] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  function savePreview() {
    setAnnouncement(t("config.savedPreview"));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("config.title")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{t("config.description")}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"><SettingsIcon className="size-3.5" aria-hidden="true" />{t("config.previewOnly")}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <ConfigSection title={t("config.templatesTitle")} description={t("config.templatesDescription")}>
          <div className="space-y-2.5">
            {templates.map((template, index) => (
              <div key={`${index}-${template}`} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`work-note-template-${index}`}>{t("config.templateName", { number: index + 1 })}</label>
                <input id={`work-note-template-${index}`} value={template} onChange={(event) => setTemplates((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className={FIELD_CLASS} />
                <button type="button" onClick={() => setTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t("config.removeTemplate", { name: template })} className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-error-200 hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-error-500/10"><TrashBinIcon aria-hidden="true" className="size-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setTemplates((current) => [...current, t("config.newTemplate")])} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"><PlusIcon aria-hidden="true" className="size-4" />{t("config.addTemplate")}</button>
        </ConfigSection>

        <ConfigSection title={t("config.remindersTitle")} description={t("config.remindersDescription")}>
          <ToggleRow label={t("config.enableReminders")} checked={remindersEnabled} onChange={setRemindersEnabled} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField label={t("config.reminderDay")} value={reminderDay} onChange={setReminderDay} values={weekdays} />
            <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">{t("config.reminderTime")}<input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} className={FIELD_CLASS} /></label>
          </div>
        </ConfigSection>

        <ConfigSection title={t("config.rulesTitle")} description={t("config.rulesDescription")}>
          <ToggleRow label={t("config.requireAllSections")} checked={requiredSections} onChange={setRequiredSections} />
          <div className="mt-4 max-w-xs"><SelectField label={t("config.reportDeadline")} value={deadlineDay} onChange={setDeadlineDay} values={weekdays} /></div>
        </ConfigSection>

        <ConfigSection title={t("config.approvalTitle")} description={t("config.approvalDescription")}>
          <ToggleRow label={t("config.requireLeaderApproval")} checked={approvalRequired} onChange={setApprovalRequired} />
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {[t("config.flow.draft"), t("config.flow.pending"), t("config.flow.published")].map((step, index) => <li key={step} className="flex items-center gap-2"><span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">{step}</span>{index < 2 && <span aria-hidden="true" className="text-gray-400">→</span>}</li>)}
          </ol>
        </ConfigSection>

        <ConfigSection title={t("config.permissionsTitle")} description={t("config.permissionsDescription")} className="@4xl:col-span-2">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[38rem] text-start text-xs">
              <thead className="bg-gray-50 dark:bg-gray-950/60"><tr><th scope="col" className="px-4 py-3 text-start font-semibold uppercase tracking-wide text-gray-500">{t("config.capability")}</th>{["MEMBER", "LEADER", "ADMIN"].map((role) => <th key={role} scope="col" className="px-4 py-3 text-center font-semibold uppercase tracking-wide text-gray-500">{t(`roles.${role}`)}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {(["viewProjectContent", "createNotes", "submitWeeklyReports", "reviewKnowledge", "manageConfiguration"] as const).map((capability) => (
                  <tr key={capability}><th scope="row" className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">{t(`config.capabilities.${capability}`)}</th>{(["MEMBER", "LEADER", "ADMIN"] as const).map((role) => {
                    const allowed = capability === "createNotes" || capability === "submitWeeklyReports" ? role === "MEMBER" : capability === "reviewKnowledge" ? role === "LEADER" : capability === "manageConfiguration" && role === "ADMIN";
                    return <td key={role} className="px-4 py-3 text-center">{capability === "viewProjectContent" ? <span className="text-[11px] text-gray-500 dark:text-gray-400">{t("config.projectPolicyCell")}</span> : allowed ? <span className="inline-flex items-center gap-1 text-success-700 dark:text-success-400"><CheckCircleIcon aria-hidden="true" className="size-4" /><span className="sr-only">{t("config.allowed")}</span></span> : <span className="text-gray-300 dark:text-gray-600" aria-label={t("config.notAllowed")}>—</span>}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("config.projectPermissionHint")}</p>
        </ConfigSection>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">{announcement || t("config.unsavedHint")}</p>
        <Button type="button" onClick={savePreview} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">{t("config.savePreview")}</Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  );
}

function ConfigSection({ title, description, className = "", children }: { title: string; description: string; className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900 ${className}`}><h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p><div className="mt-4">{children}</div></section>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4"><span className="text-sm text-gray-700 dark:text-gray-300">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600" /></label>;
}

function SelectField({ label, value, onChange, values }: { label: string; value: string; onChange: (value: string) => void; values: readonly { value: string; label: string }[] }) {
  return <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_CLASS} cursor-pointer`}>{values.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}
