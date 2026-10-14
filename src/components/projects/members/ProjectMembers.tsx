"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { EyeIcon, GroupIcon, TimeIcon } from "@/icons";
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
        ?.querySelector<HTMLInputElement>("#project-member-user")
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
  const listedMembers = visibleMembers.filter((member) =>
    member.userId.toLowerCase().includes(search.toLowerCase().trim()),
  );
  const focusedMember = listedMembers.find((member) => member.id === focusedId);
  const metrics = [
    {
      label: "membersMetric",
      value: members.isSuccess
        ? String(members.data.pagination.totalItems)
        : "—",
      icon: GroupIcon,
      tone: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
    },
    {
      label: "fullAccess",
      value: "—",
      icon: GroupIcon,
      tone: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
    },
    {
      label: "limitedAccess",
      value: "—",
      icon: EyeIcon,
      tone: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
    },
    {
      label: "pendingInvitation",
      value: "—",
      icon: TimeIcon,
      tone: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    },
  ];
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
      {showAddButton && (
        <div className="flex justify-end">
          <Button ariaLabel={t("openAdd")} onClick={openAddModal}>
            {t("add")}
          </Button>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone}`}
            >
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <dt className="order-2 truncate text-sm text-gray-500 dark:text-gray-400">
                {t(label)}
              </dt>
              <dd className="order-1 text-xl font-semibold text-gray-900 dark:text-white/90">
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:max-w-md">
          <Label htmlFor="member-roster-search">{t("searchPage")}</Label>
          <Input
            id="member-roster-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(undefined);
              confirmation.closeModal();
            }}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="member-role-filter">{t("roleFilter")}</Label>
            <select
              id="member-role-filter"
              defaultValue="all"
              disabled
              aria-describedby="member-role-filter-hint"
              className="h-[42px] min-w-36 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:disabled:bg-gray-800"
            >
              <option value="all">{t("allRoles")}</option>
            </select>
            <span id="member-role-filter-hint" className="sr-only">
              {t("unsupportedStatic")}
            </span>
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
