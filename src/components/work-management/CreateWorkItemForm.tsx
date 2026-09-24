import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import type {
  CreateWorkItemInput,
  WorkItemPriority,
} from "@/lib/queries/work-management/work-management.types";
import { controlClassName, priorities, secondaryButtonClassName } from "./work-management-ui";

type CreateWorkItemFormProps = Readonly<{
  isPending: boolean;
  onCancel: () => void;
  onCreate: (input: CreateWorkItemInput) => void;
}>;

export default function CreateWorkItemForm({
  isPending,
  onCancel,
  onCreate,
}: CreateWorkItemFormProps) {
  const t = useTranslations("workManagement");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const dueDate = String(form.get("dueDate") ?? "");
    const priority = String(
      form.get("priority") ?? "MEDIUM",
    ) as WorkItemPriority;

    if (!title) return;
    onCreate({
      title,
      ...(description ? { description } : {}),
      priority,
      ...(dueDate
        ? { dueDate: new Date(`${dueDate}T00:00:00.000Z`).toISOString() }
        : {}),
    });
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      onSubmit={submit}
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
        {t("newItem")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("titleField")}
          </span>
          <input
            required
            pattern=".*\\S.*"
            minLength={1}
            maxLength={200}
            name="title"
            className={controlClassName}
            placeholder={t("titlePlaceholder")}
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("description")}
          </span>
          <textarea
            name="description"
            rows={3}
            maxLength={20000}
            className={`${controlClassName} h-auto py-3`}
            placeholder={t("descriptionPlaceholder")}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("priority")}
          </span>
          <select
            name="priority"
            className={controlClassName}
            defaultValue="MEDIUM"
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priorities.${priority}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("dueDate")}
          </span>
          <input name="dueDate" type="date" className={controlClassName} />
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={onCancel}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
        >
          {t("createItem")}
        </button>
      </div>
    </form>
  );
}
