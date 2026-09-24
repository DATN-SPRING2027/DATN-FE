import { useTranslations } from "next-intl";
import { isResourceId, secondaryButtonClassName } from "./work-management-ui";

type WorkProjectSelectorProps = Readonly<{
  activeProjectId: string | null;
  projectDraft: string;
  canCreate: boolean;
  showCreateForm: boolean;
  onProjectDraftChange: (value: string) => void;
  onToggleCreateForm: () => void;
  onSelectProject: (projectId: string) => void;
  onClearProject: () => void;
}>;

export default function WorkProjectSelector({
  activeProjectId,
  projectDraft,
  canCreate,
  showCreateForm,
  onProjectDraftChange,
  onToggleCreateForm,
  onSelectProject,
  onClearProject,
}: WorkProjectSelectorProps) {
  const t = useTranslations("workManagement");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title-md font-semibold text-gray-900 dark:text-white/90">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onToggleCreateForm}
          >
            {showCreateForm ? t("cancel") : t("newItem")}
          </button>
        )}
      </div>

      <form
        className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end dark:border-gray-800"
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedId = projectDraft.trim();
          if (isResourceId(normalizedId)) onSelectProject(normalizedId);
        }}
      >
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="work-project-id"
          >
            {t("projectId")}
          </label>
          <input
            id="work-project-id"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white ps-3 pe-3 text-sm text-gray-800 shadow-theme-xs outline-hidden transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            value={projectDraft}
            onChange={(event) =>
              onProjectDraftChange(event.currentTarget.value)
            }
            autoComplete="off"
            aria-describedby="work-project-help"
            placeholder="507f1f77bcf86cd799439011"
          />
          <p
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
            id="work-project-help"
          >
            {activeProjectId && !isResourceId(activeProjectId)
              ? t("invalidProjectId")
              : t("projectIdHelp")}
          </p>
        </div>
        <button
          type="submit"
          className={secondaryButtonClassName}
          disabled={!isResourceId(projectDraft)}
        >
          {activeProjectId ? t("changeProject") : t("useProject")}
        </button>
        {activeProjectId && (
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onClearProject}
          >
            {t("cancel")}
          </button>
        )}
      </form>
    </section>
  );
}
