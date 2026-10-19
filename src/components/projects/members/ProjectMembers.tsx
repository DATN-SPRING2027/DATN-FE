"use client";

import { useState, useRef, useEffect } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import { isResourceId } from "@/lib/queries/projects/project-members.contract";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useAddProjectMember,
  useProjectMembersQuery,
  useRemoveProjectMember,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import ProjectState from "../ProjectState";
import MemberAddForm from "./MemberAddForm";
import MemberNotification from "./MemberNotification";
import MemberDirectory from "./MemberDirectory";
import MemberDetails from "./MemberDetails";
import MemberLifecycle from "./MemberLifecycle";
import MemberStatusFilter from "./MemberStatusFilter";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useModal } from "@/hooks/useModal";
import MemberRemoveConfirmation from "./MemberRemoveConfirmation";
import MemberError, { isMemberActionDenied } from "./MemberError";
import { GroupIcon, SearchIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";

function ScopedProjectMembers({
  organizationId,
  projectId,
  showAddButton,
  addModalOpen: controlledAddModalOpen,
  onCloseAdd,
}: {
  organizationId: string;
  projectId: string;
  showAddButton: boolean;
  addModalOpen?: boolean;
  onCloseAdd?: () => void;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const confirmation = useModal();
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string>();
  const [selected, setSelected] = useState<ProjectMembership>();
  const [addFormVersion, setAddFormVersion] = useState(0);
  const [localAddModalOpen, setLocalAddModalOpen] = useState(false);
  const addModalOpen = controlledAddModalOpen ?? localAddModalOpen;
  const mutationInFlight = useRef(false);
  const addDialog = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<"added" | "removed">();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!addModalOpen) return;
    const previouslyFocused = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      addDialog.current
        ?.querySelector<HTMLInputElement>("#project-member-email-search")
        ?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, [addModalOpen]);
  const members = useProjectMembersQuery(organizationId, projectId, {
    page,
    pageSize: 20,
    status,
  });
  const add = useAddProjectMember(organizationId, projectId);
  const remove = useRemoveProjectMember(organizationId, projectId);
  const busy = add.isPending || remove.isPending;
  function checkAccess() {
    if (busy) return;
    confirmation.closeModal();
    add.reset();
    remove.reset();
    setSelected(undefined);
    setNotice(undefined);
    void members.refetch();
  }
  const visibleMembers =
    members.isSuccess && !members.isFetching ? members.data.data : [];
  const listedMembers = visibleMembers.filter((member) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const matchEmail = member.user?.email.toLowerCase().includes(term);
    const matchName = member.user?.fullName?.toLowerCase().includes(term);
    const matchUserId = member.userId.toLowerCase().includes(term);
    return Boolean(matchEmail || matchName || matchUserId);
  });
  const focusedMember = listedMembers.find((member) => member.id === focusedId);
  function requestRemoval(member: ProjectMembership) {
    remove.reset();
    setNotice(undefined);
    setSelected(member);
    confirmation.openModal();
  }
  function openAddModal() {
    setLocalAddModalOpen(true);
  }
  function closeAddModal() {
    if (busy) return;
    setLocalAddModalOpen(false);
    onCloseAdd?.();
  }
  // A successful list does not grant mutation permissions. Each action is sent
  // to BE for authorization; a 403 locks only that action until an explicit retry.
  return (
    <div className="@container min-w-0 space-y-6">
      {notice && <MemberNotification message={t(notice)} />}
      {(members.isError || add.isError || remove.isError) && (
        <Button
          variant="outline"
          disabled={busy || members.isFetching}
          onClick={checkAccess}
        >
          {t("checkAccess")}
        </Button>
      )}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 xl:flex-row xl:items-center xl:justify-between dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <GroupIcon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                {t("title")}
              </h2>
              {members.isSuccess && !members.isFetching && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {format.number(members.data.pagination.totalItems)}{" "}
                  {t("membersMetric")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("directoryDescription")}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end xl:flex-1 xl:justify-end">
          <div className="min-w-0 flex-1 sm:min-w-56 xl:w-64 xl:flex-none">
            <Label htmlFor="member-roster-search" className="sr-only">
              {t("searchPage")}
            </Label>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400"
              />
              <Input
                id="member-roster-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelected(undefined);
                  confirmation.closeModal();
                }}
                placeholder={t("searchPlaceholder")}
                className="ps-10"
              />
            </div>
          </div>
          <MemberStatusFilter
            value={status}
            disabled={busy}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
              setSelected(undefined);
              setFocusedId(undefined);
              confirmation.closeModal();
            }}
          />
          {showAddButton && (
            <Button
              ariaLabel={t("openAdd")}
              onClick={openAddModal}
              className="shrink-0"
            >
              {t("add")}
            </Button>
          )}
        </div>
      </div>
      <section
        aria-label={t("list")}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        {members.isFetching || members.isPending ? (
          <p
            role="status"
            className="p-6 text-sm text-gray-600 dark:text-gray-400"
          >
            {t("loading")}
          </p>
        ) : members.isError ? (
          <div className="p-5">
            <MemberError error={members.error} action="list" />
          </div>
        ) : (
          <>
            <MemberDirectory
              members={listedMembers}
              selectedId={focusedMember?.id}
              disabled={busy}
              removeDisabled={busy || isMemberActionDenied(remove.error)}
              onSelect={setFocusedId}
              onRemove={requestRemoval}
            />
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("pageOf", {
                  page: members.data.pagination.page,
                  total: Math.max(1, members.data.pagination.totalPages),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || page <= 1}
                  onClick={() => {
                    setPage(page - 1);
                    setFocusedId(undefined);
                    setSelected(undefined);
                  }}
                >
                  {t("previous")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || page >= members.data.pagination.totalPages}
                  onClick={() => {
                    setPage(page + 1);
                    setFocusedId(undefined);
                    setSelected(undefined);
                  }}
                >
                  {t("next")}
                </Button>
              </div>
            </footer>
          </>
        )}
      </section>
      <div className="[&_.modal>div:first-child]:bg-gray-900/35 [&_.modal>div:first-child]:backdrop-blur-none">
        <Modal
          isOpen={addModalOpen}
          onClose={closeAddModal}
          showCloseButton={false}
          className="mx-4 max-w-2xl"
        >
          <div
            ref={addDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-add-heading"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                addDialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)',
                ) ?? [],
              );
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!first) {
                event.preventDefault();
                return;
              }
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:p-7 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <GroupIcon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2
                      id="member-add-heading"
                      tabIndex={-1}
                      className="text-lg font-semibold text-gray-900 outline-none dark:text-white/90"
                    >
                      {t("add")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("addDescription")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeAddModal}
                  className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("closeAdd")}
                </button>
              </div>
              <MemberAddForm
                key={addFormVersion}
                organizationId={organizationId}
                projectId={projectId}
                pending={add.isPending}
                disabled={busy || isMemberActionDenied(add.error)}
                onAdd={(userId) => {
                  if (
                    mutationInFlight.current ||
                    busy ||
                    isMemberActionDenied(add.error)
                  )
                    return;
                  mutationInFlight.current = true;
                  setNotice(undefined);
                  add.mutate(userId, {
                    onSuccess: () => {
                      setPage(1);
                      setAddFormVersion((version) => version + 1);
                      setNotice("added");
                    },
                    onSettled: () => {
                      mutationInFlight.current = false;
                    },
                  });
                }}
              />
              {add.isError && <MemberError error={add.error} action="add" />}
            </section>
          </div>
        </Modal>
      </div>
      {focusedMember && (
        <div className="grid gap-4 @2xl:grid-cols-2">
          <MemberDetails member={focusedMember} />
          <MemberLifecycle member={focusedMember} />
        </div>
      )}
      {((selected && members.isSuccess && !members.isFetching) ||
        remove.isError) && (
        <MemberRemoveConfirmation
          isOpen={confirmation.isOpen}
          member={members.isError || members.isFetching ? undefined : selected}
          error={remove.error}
          pending={busy}
          disabled={
            busy ||
            members.isError ||
            members.isFetching ||
            isMemberActionDenied(remove.error)
          }
          onCancel={() => {
            confirmation.closeModal();
            setSelected(undefined);
          }}
          onConfirm={() => {
            if (
              !selected ||
              mutationInFlight.current ||
              busy ||
              members.isError ||
              members.isFetching ||
              isMemberActionDenied(remove.error)
            )
              return;
            mutationInFlight.current = true;
            setNotice(undefined);
            remove.mutate(selected.id, {
              onSuccess: () => {
                setSelected(undefined);
                setNotice("removed");
                confirmation.closeModal();
              },
              onSettled: () => {
                mutationInFlight.current = false;
              },
            });
          }}
        />
      )}
    </div>
  );
}

export default function ProjectMembers({
  projectId,
  showAddButton = true,
  addModalOpen,
  onCloseAdd,
}: {
  projectId: string;
  showAddButton?: boolean;
  addModalOpen?: boolean;
  onCloseAdd?: () => void;
}) {
  const user = useCurrentUserQuery();
  if (user.isPending) return <ProjectState />;
  if (user.isError) return <ProjectState error={user.error} />;
  if (!user.data?.organizationId)
    return <ProjectState error={new Error("No trusted organization")} />;
  if (!isResourceId(projectId))
    return (
      <MemberError
        error={
          new ApiError(422, "VALIDATION_FAILED", "Invalid Project context")
        }
        action="list"
      />
    );
  return (
    <ScopedProjectMembers
      key={`${user.data.id}:${user.data.organizationId}:${projectId}`}
      organizationId={user.data.organizationId}
      projectId={projectId}
      showAddButton={showAddButton}
      addModalOpen={addModalOpen}
      onCloseAdd={onCloseAdd}
    />
  );
}
