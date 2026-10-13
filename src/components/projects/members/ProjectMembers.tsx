"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
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
import MemberTable from "./MemberTable";
import MemberDirectory from "./MemberDirectory";
import MemberDetails from "./MemberDetails";
import MemberProfileHeader from "./MemberProfileHeader";
import MemberLifecycle from "./MemberLifecycle";
import MemberSafeguards from "./MemberSafeguards";
import MemberStatusFilter from "./MemberStatusFilter";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useModal } from "@/hooks/useModal";
import { CheckCircleIcon } from "@/icons";
import MemberRemoveConfirmation from "./MemberRemoveConfirmation";
import MemberError, { isMemberActionDenied } from "./MemberError";

function ScopedProjectMembers({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId: string;
}) {
  const t = useTranslations("projectMembers");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "">("ACTIVE");
  const confirmation = useModal();
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string>();
  const [selected, setSelected] = useState<ProjectMembership>();
  const [addFormVersion, setAddFormVersion] = useState(0);
  const mutationInFlight = useRef(false);
  const [notice, setNotice] = useState<"added" | "removed">();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const members = useProjectMembersQuery(organizationId, projectId, {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
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
  const focusedMember =
    listedMembers.find((member) => member.id === focusedId) ?? listedMembers[0];
  function requestRemoval(member: ProjectMembership) {
    remove.reset();
    setNotice(undefined);
    setSelected(member);
    confirmation.openModal();
  }
  // A successful list does not grant mutation permissions. Each action is sent
  // to BE for authorization; a 403 locks only that action until an explicit retry.
  return (
    <div className="@container min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      {notice && <MemberNotification message={t(notice)} />}
      {(members.isError || add.isError || remove.isError) && (
        <div className="px-5 py-4 sm:px-6">
          <Button
            variant="outline"
            disabled={busy || members.isFetching}
            onClick={checkAccess}
          >
            {t("checkAccess")}
          </Button>
        </div>
      )}
      <div className="@container grid min-w-0 items-start @3xl:grid-cols-4">
        <aside className="min-w-0 space-y-4 self-stretch border-b border-gray-100 bg-gray-50/70 p-4 @3xl:border-e @3xl:border-b-0 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("list")}
            </h2>
            {members.isSuccess && !members.isFetching && (
              <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                {members.data.pagination.totalItems}
              </span>
            )}
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
          <div>
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

          {members.isFetching || members.isPending ? (
            <p
              role="status"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              {t("loading")}
            </p>
          ) : members.isError ? (
            <MemberError error={members.error} action="list" />
          ) : (
            <>
              <MemberDirectory
                members={listedMembers}
                selectedId={focusedMember?.id}
                disabled={busy}
                onSelect={setFocusedId}
              />
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
            </>
          )}
        </aside>
        <div className="@container min-w-0 space-y-5 bg-gray-50/60 p-4 sm:p-6 @3xl:col-span-3 dark:bg-gray-800/20">
          {focusedMember && (
            <MemberProfileHeader
              member={focusedMember}
              disabled={busy || isMemberActionDenied(remove.error)}
              onRemove={requestRemoval}
            />
          )}
          <div className="grid min-w-0 gap-4 @2xl:grid-cols-3">
            {focusedMember ? (
              <>
                <MemberDetails member={focusedMember} />
                <MemberLifecycle member={focusedMember} />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 @2xl:col-span-2 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {t("memberDetails")}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("selectHint")}
                </p>
              </div>
            )}
            <div className="min-w-0 space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-theme-purple-500 via-brand-600 to-blue-500 p-5 text-white shadow-theme-xs dark:via-brand-700">
                <div
                  aria-hidden="true"
                  className="absolute -end-8 -bottom-8 size-32 rounded-full bg-white/10"
                />
                <p className="text-xs font-semibold tracking-wide text-white/80">
                  {t("membershipSummary")}
                </p>
                <div className="my-5 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/15">
                    <CheckCircleIcon aria-hidden="true" className="size-5" />
                  </span>
                  <p className="text-xl font-semibold">
                    {focusedMember ? t(focusedMember.status) : t("noSelection")}
                  </p>
                </div>
                <p className="border-t border-white/20 pt-3 text-xs leading-5 text-white/80">
                  {t("summaryHint")}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-brand-100 text-base font-semibold text-brand-600 dark:border-brand-500/20 dark:text-brand-300">
                  {listedMembers.length}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {t("pageCount")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("currentPageHint")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid items-start gap-4 @2xl:grid-cols-3">
            <ComponentCard
              title={t("add")}
              desc={t("addDescription")}
              className="@container shadow-theme-xs @2xl:col-span-2"
            >
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
            </ComponentCard>
            <MemberSafeguards />
          </div>
          {members.isSuccess &&
            !members.isFetching &&
            listedMembers.length > 0 && (
              <ComponentCard
                title={t("pageRecords")}
                desc={t("recordsHint")}
                className="shadow-theme-xs"
              >
                <MemberTable
                  members={listedMembers}
                  disabled={busy || isMemberActionDenied(remove.error)}
                  onRemove={requestRemoval}
                  showActions={false}
                />
              </ComponentCard>
            )}
        </div>
      </div>
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

export default function ProjectMembers({ projectId }: { projectId: string }) {
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
    />
  );
}
