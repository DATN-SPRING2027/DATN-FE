"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import RoleLabel from "@/components/common/RoleLabel";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import { useCreateHandoverMutation } from "@/lib/queries/handovers/useHandovers";
import {
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
} from "./handover-ui.utils";

interface CreateHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentUserId?: string;
  members: readonly ProjectMembership[];
  onCreated: (handoverId: string) => void;
}

function defaultTargetDateInput(): string {
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function getMembershipRole(member: ProjectMembership): string | undefined {
  const maybeRole = (member as { role?: unknown }).role;
  return typeof maybeRole === "string" && maybeRole.trim().length > 0
    ? maybeRole.trim()
    : undefined;
}

export default function CreateHandoverModal({
  isOpen,
  onClose,
  projectId,
  currentUserId,
  members,
  onCreated,
}: CreateHandoverModalProps) {
  const t = useTranslations("handover.createModal");
  const createMutation = useCreateHandoverMutation(projectId);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "ACTIVE"),
    [members],
  );

  const leaderOptions = useMemo(() => {
    const explicitLeaders = activeMembers.filter((m) => {
      const role = getMembershipRole(m);
      return role === "TEAM_LEADER" || role === "LEADER";
    });
    return explicitLeaders.length > 0 ? explicitLeaders : activeMembers;
  }, [activeMembers]);

  const defaultCoordinator = useMemo(() => {
    if (
      currentUserId &&
      leaderOptions.some((m) => m.userId === currentUserId)
    ) {
      return currentUserId;
    }
    return leaderOptions[0]?.userId ?? "";
  }, [currentUserId, leaderOptions]);

  const [title, setTitle] = useState("");
  const [departingUserId, setDepartingUserId] = useState("");
  const [assignedLeaderId, setAssignedLeaderId] = useState("");
  const [successorUserId, setSuccessorUserId] = useState("");
  const [targetDate, setTargetDate] = useState(defaultTargetDateInput);
  const [validationError, setValidationError] = useState<string | null>(null);

  const effectiveCoordinator = assignedLeaderId || defaultCoordinator;
  const selectedCoordinatorRole = useMemo(() => {
    const selected = activeMembers.find(
      (m) => m.userId === effectiveCoordinator,
    );
    return selected ? getMembershipRole(selected) : undefined;
  }, [activeMembers, effectiveCoordinator]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    setValidationError(null);
    createMutation.reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      setValidationError(t("validationTitle"));
      return;
    }
    if (!departingUserId.trim()) {
      setValidationError(t("validationDeparting"));
      return;
    }
    if (!effectiveCoordinator.trim()) {
      setValidationError(t("validationCoordinator"));
      return;
    }
    const cleanSuccessor = successorUserId.trim() || null;
    if (
      cleanSuccessor &&
      (cleanSuccessor === departingUserId.trim() ||
        cleanSuccessor === effectiveCoordinator.trim())
    ) {
      setValidationError(t("validationSamePerson"));
      return;
    }
    const parsedDate = new Date(`${targetDate}T00:00:00.000Z`);
    if (!targetDate || Number.isNaN(parsedDate.getTime())) {
      setValidationError(t("validationTargetDate"));
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        title: trimmedTitle,
        departingUserId: departingUserId.trim(),
        assignedLeaderId: effectiveCoordinator.trim(),
        successorUserId: cleanSuccessor,
        teamId: null,
        targetCompletionDate: parsedDate.toISOString(),
      });
      setTitle("");
      setDepartingUserId("");
      setSuccessorUserId("");
      onCreated(result.data.handoverId);
    } catch {
      // Mutation error displayed below
    }
  };

  const serverError = createMutation.isError
    ? extractHandoverErrorMessage(
        createMutation.error,
        "Could not create knowledge handover.",
      )
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-xl p-6 sm:p-8"
    >
      <div className="pe-8">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {(validationError || serverError) && (
          <div
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            {validationError ?? serverError}
          </div>
        )}

        <div>
          <label
            htmlFor="handover-create-title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("titleLabel")} <span className="text-error-600">*</span>
          </label>
          <input
            id="handover-create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="handover-create-departing"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("departingLabel")} <span className="text-error-600">*</span>
            </label>
            {activeMembers.length > 0 ? (
              <select
                id="handover-create-departing"
                value={departingUserId}
                onChange={(e) => setDepartingUserId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">{t("selectDepartingPlaceholder")}</option>
                {activeMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {formatMemberOptionLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="handover-create-departing"
                type="text"
                value={departingUserId}
                onChange={(e) => setDepartingUserId(e.target.value)}
                placeholder="24-char user ID"
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
          </div>

          <div>
            <label
              htmlFor="handover-create-coordinator"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("coordinatorLabel")} <span className="text-error-600">*</span>
            </label>
            {leaderOptions.length > 0 ? (
              <select
                id="handover-create-coordinator"
                value={effectiveCoordinator}
                onChange={(e) => setAssignedLeaderId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">{t("selectCoordinatorPlaceholder")}</option>
                {leaderOptions.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {formatMemberOptionLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="handover-create-coordinator"
                type="text"
                value={assignedLeaderId}
                onChange={(e) => setAssignedLeaderId(e.target.value)}
                placeholder="24-char Leader user ID"
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
            {effectiveCoordinator && activeMembers.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selectedCoordinatorRole ? (
                  <RoleLabel roleCode={selectedCoordinatorRole} />
                ) : (
                  t("coordinatorRoleHint")
                )}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="handover-create-successor"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("successorLabel")}
            </label>
            {activeMembers.length > 0 ? (
              <select
                id="handover-create-successor"
                value={successorUserId}
                onChange={(e) => setSuccessorUserId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">{t("noSuccessorYet")}</option>
                {activeMembers
                  .filter(
                    (m) =>
                      m.userId !== departingUserId &&
                      m.userId !== effectiveCoordinator,
                  )
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {formatMemberOptionLabel(m)}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                id="handover-create-successor"
                type="text"
                value={successorUserId}
                onChange={(e) => setSuccessorUserId(e.target.value)}
                placeholder={t("noSuccessorYet")}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
          </div>

          <div>
            <label
              htmlFor="handover-create-target-date"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("targetDateLabel")} <span className="text-error-600">*</span>
            </label>
            <input
              id="handover-create-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 tabular-nums shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={createMutation.isPending}
          >
            {createMutation.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
