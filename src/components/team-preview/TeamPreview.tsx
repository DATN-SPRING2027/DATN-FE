"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import TeamDialogShell from "@/components/teams/TeamDialogShell";
import TeamPreviewList from "./TeamPreviewList";
import TeamPreviewState from "./TeamPreviewState";
import TeamPreviewForm from "./TeamPreviewForm";
import {
  teamFixtures,
  type PreviewScenario,
  type PreviewSaveResult,
  type TeamPreviewItem,
} from "./team-preview.model";

type Action = "view" | "edit" | "delete";
type View =
  { kind: "list" | "create" } | { kind: Action; team: TeamPreviewItem };

/** Isolated fixture UI. Do not import into production routes until gate approval. */
export default function TeamPreview({
  scenario = "success",
  embedded = false,
}: {
  scenario?: PreviewScenario;
  embedded?: boolean;
}) {
  return (
    <TeamPreviewSession
      key={scenario}
      scenario={scenario}
      embedded={embedded}
    />
  );
}

function TeamPreviewSession({
  scenario,
  embedded,
}: {
  scenario: PreviewScenario;
  embedded: boolean;
}) {
  const t = useTranslations("teamPreview");
  const [view, setView] = useState<View>({ kind: "list" });
  const [items, setItems] = useState<TeamPreviewItem[]>(() =>
    scenario === "empty" ? [] : [...teamFixtures],
  );
  const [recovered, setRecovered] = useState(false);
  const modal = useModal();
  const state = recovered ? "success" : scenario;
  const unavailable =
    state === "loading" || state === "denied" || state === "network";
  const saveResults: Partial<Record<PreviewScenario, PreviewSaveResult>> = {
    validation: "validation",
    "save-denied": "denied",
    "save-network": "network",
    "save-pending": "pending",
  };
  const saveResult = saveResults[scenario] ?? "success";
  const team = "team" in view ? view.team : undefined;
  const dialogOpen = view.kind !== "list" && modal.isOpen;

  function openCreate() {
    setView({ kind: "create" });
    modal.openModal();
  }

  function openAction(kind: Action, selected: TeamPreviewItem) {
    setView({ kind, team: selected });
    modal.openModal();
  }

  function closeDialog() {
    modal.closeModal();
    setView({ kind: "list" });
  }

  function saveTeam(
    value: Pick<TeamPreviewItem, "name" | "code" | "description">,
  ) {
    if (view.kind === "create") {
      setItems((current) => [
        {
          fixtureKey: `preview-${Date.now()}`,
          ...value,
          status: "ACTIVE",
        },
        ...current,
      ]);
    } else if (team && view.kind === "edit") {
      setItems((current) =>
        current.map((item) =>
          item.fixtureKey === team.fixtureKey ? { ...item, ...value } : item,
        ),
      );
    }
  }

  function deleteTeam() {
    if (!team || view.kind !== "delete") return;
    setItems((current) =>
      current.filter((item) => item.fixtureKey !== team.fixtureKey),
    );
    closeDialog();
  }

  const title =
    view.kind === "create"
      ? t("create")
      : view.kind === "view" || view.kind === "edit"
        ? (team?.name ?? t("title"))
        : view.kind === "delete"
          ? t("deleteTitle")
          : t("title");
  const description =
    view.kind === "create"
      ? t("createDescription")
      : view.kind === "edit"
        ? t("editDescription")
        : view.kind === "delete"
          ? t("deleteDescription", { name: team?.name ?? "" })
          : undefined;

  return (
    <section
      aria-label={t("title")}
      className={`w-full min-w-0 space-y-6 text-gray-900 dark:text-white ${embedded ? "" : "mx-auto max-w-screen-2xl"}`}
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 space-y-1">
          {!embedded && (
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              {t("eyebrow")}
            </p>
          )}
          {embedded ? (
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white/95">
              {t("title")}
            </h2>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white/95">
              {t("title")}
            </h1>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
      </header>
      {unavailable ? (
        <TeamPreviewState state={state} onRetry={() => setRecovered(true)} />
      ) : (
        <TeamPreviewList
          items={items}
          onAction={openAction}
          onCreate={openCreate}
          emptyMessage={state === "empty" ? t("empty") : undefined}
        />
      )}

      <TeamDialogShell
        isOpen={dialogOpen}
        onClose={closeDialog}
        title={title}
        description={description}
        destructive={view.kind === "delete"}
        focusField={view.kind === "create" || view.kind === "edit"}
      >
        {view.kind === "create" || view.kind === "edit" ? (
          <TeamPreviewForm
            key={`${view.kind}:${team?.fixtureKey ?? "new"}`}
            initial={view.kind === "edit" ? team : undefined}
            result={saveResult}
            onSave={saveTeam}
            onCancel={closeDialog}
          />
        ) : view.kind === "view" && team ? (
          <div className="space-y-6">
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {(["name", "code", "description"] as const).map((field) => (
                <div
                  key={field}
                  className={field === "description" ? "sm:col-span-2" : ""}
                >
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t(field)}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium break-words text-gray-900 dark:text-gray-100">
                    {team[field] || t("noDescription")}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t("status")}
                </dt>
                <dd className="mt-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${team.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                  >
                    {t(team.status)}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t("close")}
              </Button>
              {team.status === "ACTIVE" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openAction("edit", team)}
                >
                  {t("edit")}
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                onClick={() => openAction("delete", team)}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        ) : view.kind === "delete" && team ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={deleteTeam}>
              {t("delete")}
            </Button>
          </div>
        ) : null}
      </TeamDialogShell>
    </section>
  );
}
