"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutationState } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import { prepareTeamCommand } from "@/lib/queries/teams/team.service";
import {
  TeamRecoveryRequiredError,
  TeamValidationError,
  type TeamCommand,
  type TeamResource,
  type TeamScope,
} from "@/lib/queries/teams/team.contract";
import { teamKeys, useTeamCommand } from "@/lib/queries/teams/useTeams";
import TeamState, { ambiguousTeamFailure } from "./TeamState";

export default function TeamForm({
  scope,
  actor,
  resource,
  operation,
  onSuccess,
  onCancel,
}: {
  scope: TeamScope;
  actor: string;
  resource?: TeamResource;
  operation: "create" | "update" | "archive" | "restore";
  onSuccess: (resource: TeamResource) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("teamFoundation");
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const history = useMutationState({
    filters: {
      mutationKey: [
        ...teamKeys(scope, actor),
        "command",
        operation,
        resource?.team.id ?? "new",
      ],
    },
    select: (m) => ({
      status: m.state.status,
      error: m.state.error,
      command: m.state.variables as TeamCommand | undefined,
      data: m.state.data as TeamResource | undefined,
    }),
  });
  const latest = history.at(-1);
  const [resumed] = useState(() =>
    latest?.command &&
    (latest.status === "pending" ||
      (latest.status === "error" && ambiguousTeamFailure(latest.error)))
      ? latest.command
      : undefined,
  );
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const saved = resumed?.body;
  const [draft, setDraft] = useState({
    name:
      saved && "name" in saved
        ? (saved.name ?? resource?.team.name ?? "")
        : (resource?.team.name ?? ""),
    code: saved && "code" in saved ? saved.code : (resource?.team.code ?? ""),
    description:
      saved && "description" in saved
        ? (saved.description ?? "")
        : (resource?.team.description ?? ""),
    reason: saved && "reason" in saved ? saved.reason : "",
  });
  const [clear, setClear] = useState(
    Boolean(saved && "description" in saved && saved.description === null),
  );
  const [fieldError, setFieldError] = useState<string>();
  const mutation = useTeamCommand(
    scope,
    actor,
    operation,
    resource?.team.id ?? "new",
  );
  const command = useRef<TeamCommand | undefined>(resumed);
  const inFlight = useRef(false);
  const unresolved =
    !!resumed &&
    latest?.command?.key === resumed.key &&
    latest.status === "error" &&
    ambiguousTeamFailure(latest.error);
  const elsewherePending = latest?.status === "pending" && !mutation.isPending;
  const recovered =
    !!resumed &&
    latest?.command?.key === resumed.key &&
    latest.status === "success" &&
    !!latest.data;
  const uncertain =
    unresolved || (mutation.isError && ambiguousTeamFailure(mutation.error));
  const blocked =
    (mutation.isError &&
      mutation.error instanceof ApiError &&
      [401, 403, 404, 412, 428].includes(mutation.error.status)) ||
    mutation.error instanceof TeamRecoveryRequiredError ||
    latest?.error instanceof TeamRecoveryRequiredError;
  const lifecycle = operation === "archive" || operation === "restore";
  const frozen =
    mutation.isPending || elsewherePending || uncertain || blocked || recovered;
  async function send(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || blocked || elsewherePending || recovered) return;
    setFieldError(undefined);
    try {
      if (!command.current) {
        const description = clear ? null : draft.description;
        const input = lifecycle
          ? { reason: draft.reason }
          : operation === "create"
            ? { name: draft.name, code: draft.code, description }
            : {
                ...(draft.name !== resource!.team.name
                  ? { name: draft.name }
                  : {}),
                ...(clear || description !== (resource!.team.description ?? "")
                  ? { description }
                  : {}),
              };
        command.current = prepareTeamCommand(operation, scope, input, resource);
      }
      inFlight.current = true;
      const result = await mutation.mutateAsync(command.current);
      if (alive.current) onSuccess(result);
    } catch (error) {
      if (error instanceof TeamValidationError) {
        setFieldError(error.field);
        form.current
          ?.querySelector<HTMLElement>(`[name="${error.field}"]`)
          ?.focus();
      } else if (
        error instanceof Error &&
        error.message === "TEAM_EMPTY_UPDATE"
      )
        setFieldError("unchanged");
      else if (!ambiguousTeamFailure(error)) command.current = undefined;
    } finally {
      inFlight.current = false;
    }
  }
  return (
    <form
      ref={form}
      onSubmit={send}
      noValidate
      aria-busy={mutation.isPending || elsewherePending}
      className="space-y-5"
    >
      {lifecycle && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t(operation === "archive" ? "archiveHint" : "restoreHint")}
        </p>
      )}
      {fieldError && (
        <p
          role="alert"
          id={`${id}-error`}
          className="text-sm text-error-600 dark:text-error-400"
        >
          {t(fieldError === "unchanged" ? "unchanged" : "fieldValidation", {
            field: t(fieldError === "unchanged" ? "name" : fieldError),
          })}
        </p>
      )}
      {mutation.isError && <TeamState error={mutation.error} />}
      {uncertain && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("uncertain")}
        </p>
      )}
      <fieldset disabled={frozen} className="space-y-4">
        {!lifecycle &&
          (["name", "code"] as const).map((field) => (
            <div
              key={field}
              className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center"
            >
              <Label htmlFor={`${id}-${field}`} className="sm:mb-0">
                {t(field)}
              </Label>
              <Input
                id={`${id}-${field}`}
                name={field}
                data-dialog-autofocus-field={field === "name" ? "true" : undefined}
                className="text-base! sm:text-sm!"
                value={draft[field]}
                readOnly={field === "code" && operation === "update"}
                aria-invalid={fieldError === field}
                aria-describedby={
                  fieldError === field ? `${id}-error` : undefined
                }
                onChange={(e) => {
                  setDraft({ ...draft, [field]: e.target.value });
                  setFieldError(undefined);
                }}
              />
            </div>
          ))}
        <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
          <Label htmlFor={`${id}-text`} className="sm:pt-3 sm:mb-0">
            {t(lifecycle ? "reason" : "description")}
          </Label>
          <div>
            <textarea
              id={`${id}-text`}
              name={lifecycle ? "reason" : "description"}
              data-dialog-autofocus-field={lifecycle ? "true" : undefined}
              rows={4}
              value={lifecycle ? draft.reason : draft.description}
              disabled={!lifecycle && clear}
              aria-invalid={fieldError === (lifecycle ? "reason" : "description")}
              aria-describedby={
                fieldError === (lifecycle ? "reason" : "description")
                  ? `${id}-error`
                  : undefined
              }
              onChange={(e) => {
                setDraft({
                  ...draft,
                  [lifecycle ? "reason" : "description"]: e.target.value,
                });
                setFieldError(undefined);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:ring-3 focus:ring-brand-500/20 focus:outline-none sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
        {!lifecycle && (
          <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <span aria-hidden="true" />
            <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={clear}
                onChange={(e) => setClear(e.target.checked)}
              />
              {t("clearDescription")}
            </label>
          </div>
        )}
      </fieldset>
      {recovered ? (
        <>
          <p role="status">{t("completed")}</p>
          <Button type="button" onClick={() => onSuccess(latest!.data!)}>
            {t("view")}
          </Button>
        </>
      ) : (
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
          <Button
            type="submit"
            variant={operation === "archive" ? "danger" : "primary"}
            disabled={mutation.isPending || elsewherePending || blocked}
          >
            {t(
              mutation.isPending || elsewherePending
                ? "saving"
                : uncertain
                  ? "retrySame"
                  : operation === "create"
                    ? "create"
                    : operation === "update"
                      ? "save"
                      : operation === "archive"
                        ? "confirmArchive"
                        : "confirmRestore",
            )}
          </Button>
        </div>
      )}
      {(mutation.isPending || elsewherePending) && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          {t("saving")}
        </p>
      )}
    </form>
  );
}
