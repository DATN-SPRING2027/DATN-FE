"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import {
  useProjectLeaderActions,
  useProjectLeaderCandidatesQuery,
  useProjectLeadersQuery,
  type ProjectLeader,
  type ProjectLeaderCandidate,
} from "@/lib/queries/projects/useProjectLeaders";

export default function ProjectLeaders({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId: string;
}) {
  const t = useTranslations("projectLeaders");
  const leaders = useProjectLeadersQuery(organizationId, projectId);
  const actions = useProjectLeaderActions(organizationId, projectId);
  const [email, setEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [selected, setSelected] = useState<ProjectLeaderCandidate>();
  const [replacementFor, setReplacementFor] = useState<ProjectLeader>();
  const [revokeTarget, setRevokeTarget] = useState<ProjectLeader>();
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const value = email.trim();
    const timer = window.setTimeout(
      () => setDebouncedEmail(value),
      value ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [email]);

  const candidates = useProjectLeaderCandidatesQuery(
    organizationId,
    projectId,
    debouncedEmail || undefined,
  );
  const pending =
    actions.assign.isPending ||
    actions.change.isPending ||
    actions.revoke.isPending;
  const candidateResultsReady =
    debouncedEmail === email.trim() &&
    candidates.isSuccess &&
    !candidates.isFetching &&
    !candidates.isError;
  const actionError =
    actions.assign.error ?? actions.change.error ?? actions.revoke.error;
  const denied =
    (leaders.error instanceof ApiError && leaders.error.status === 403) ||
    (actionError instanceof ApiError && actionError.status === 403);

  function resetForm() {
    setFormOpen(false);
    setReplacementFor(undefined);
    setSelected(undefined);
    setEmail("");
    setDebouncedEmail("");
  }

  async function appoint() {
    if (!selected || !candidateResultsReady || pending) return;
    try {
      if (replacementFor) {
        await actions.change.mutateAsync({
          previousUserId: replacementFor.userId,
          nextUserId: selected.userId,
        });
      } else {
        await actions.assign.mutateAsync(selected.userId);
      }
      resetForm();
    } catch {
      // Mutation state below renders an actionable error and keeps the selection.
    }
  }

  async function revoke() {
    if (!revokeTarget || pending) return;
    try {
      await actions.revoke.mutateAsync(revokeTarget.userId);
      setRevokeTarget(undefined);
    } catch {
      // Mutation state below renders the failure without losing context.
    }
  }

  if (leaders.isPending) {
    return (
      <p role="status" className="text-sm text-gray-500">
        {t("loading")}
      </p>
    );
  }
  if (leaders.isError) {
    return (
      <section
        aria-labelledby="project-leaders-heading"
        className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <h2
            id="project-leaders-heading"
            className="font-semibold text-gray-900 dark:text-white/90"
          >
            {t("title")}
          </h2>
          <p
            role="alert"
            className="mt-2 text-sm text-gray-600 dark:text-gray-300"
          >
            {denied ? t("adminOnly") : t("loadFailed")}
          </p>
        </div>
        {!denied && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void leaders.refetch()}
          >
            {t("retry")}
          </Button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="project-leaders-heading"
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="project-leaders-heading"
            className="font-semibold text-gray-900 dark:text-white/90"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("description")}
          </p>
        </div>
        {!formOpen && !replacementFor && (
          <Button
            size="sm"
            onClick={() => {
              actions.assign.reset();
              actions.change.reset();
              actions.revoke.reset();
              setFormOpen(true);
            }}
          >
            {t("addLeader")}
          </Button>
        )}
      </header>

      {leaders.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <ul
          aria-label={t("listLabel")}
          className="divide-y divide-gray-100 dark:divide-gray-800"
        >
          {leaders.data.map((leader) => (
            <li
              key={leader.userId}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                >
                  {(leader.fullName || leader.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                    {leader.fullName || leader.email}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {leader.email}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${leader.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
                >
                  {t(leader.status === "ACTIVE" ? "active" : "inactive")}
                </span>
              </div>
              {leader.status === "ACTIVE" && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      actions.assign.reset();
                      actions.change.reset();
                      actions.revoke.reset();
                      setFormOpen(false);
                      setReplacementFor(leader);
                      setSelected(undefined);
                      setEmail("");
                      setDebouncedEmail("");
                    }}
                  >
                    {t("replace")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      actions.assign.reset();
                      actions.change.reset();
                      actions.revoke.reset();
                      setRevokeTarget(leader);
                    }}
                  >
                    {t("revoke")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(formOpen || replacementFor) && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
          <h3 className="font-medium text-gray-900 dark:text-white/90">
            {replacementFor
              ? t("replaceTitle", {
                  name: replacementFor.fullName || replacementFor.email,
                })
              : t("appointTitle")}
          </h3>
          <label
            htmlFor="project-leader-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("searchLabel")}
          </label>
          <input
            id="project-leader-email"
            type="email"
            autoComplete="off"
            maxLength={254}
            value={email}
            disabled={pending}
            onChange={(event) => {
              setEmail(event.target.value);
              setSelected(undefined);
            }}
            placeholder={t("searchPlaceholder")}
            className="block min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {debouncedEmail && candidates.isFetching && (
            <p role="status" className="text-sm text-gray-500">
              {t("searching")}
            </p>
          )}
          {debouncedEmail && candidates.isError && (
            <p
              role="alert"
              className="text-sm text-error-700 dark:text-error-300"
            >
              {t("searchFailed")}
            </p>
          )}
          {debouncedEmail &&
            candidateResultsReady &&
            candidates.data.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("noCandidates")}
              </p>
            )}
          {candidateResultsReady &&
            candidates.data &&
            candidates.data.length > 0 && (
              <ul
                aria-label={t("candidateList")}
                className="max-h-52 space-y-2 overflow-y-auto"
              >
                {candidates.data.map((candidate) => (
                  <li key={candidate.userId}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={selected?.userId === candidate.userId}
                      onClick={() => setSelected(candidate)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-start text-sm transition ${selected?.userId === candidate.userId ? "border-brand-500 bg-white ring-1 ring-brand-500 dark:bg-gray-900" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900 dark:text-white/90">
                          {candidate.fullName || candidate.email}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {candidate.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {t("select")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          {actionError && (
            <p
              role="alert"
              className="text-sm text-error-700 dark:text-error-300"
            >
              {denied ? t("adminOnly") : t("actionFailed")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={resetForm}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!selected || !candidateResultsReady || pending}
              onClick={() => void appoint()}
            >
              {pending
                ? t("saving")
                : replacementFor
                  ? t("confirmReplace")
                  : t("confirmAppoint")}
            </Button>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div
          role="alertdialog"
          aria-labelledby="revoke-leader-title"
          className="space-y-3 rounded-xl border border-error-200 bg-error-50/50 p-4 dark:border-error-500/20 dark:bg-error-500/5"
        >
          <h3
            id="revoke-leader-title"
            className="font-medium text-gray-900 dark:text-white/90"
          >
            {t("revokeTitle", {
              name: revokeTarget.fullName || revokeTarget.email,
            })}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("revokeDescription")}
          </p>
          {actions.revoke.isError && (
            <p
              role="alert"
              className="text-sm text-error-700 dark:text-error-300"
            >
              {denied ? t("adminOnly") : t("actionFailed")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setRevokeTarget(undefined)}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => void revoke()}
            >
              {pending ? t("saving") : t("confirmRevoke")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
