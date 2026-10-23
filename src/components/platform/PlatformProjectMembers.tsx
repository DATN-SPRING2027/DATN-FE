"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePlatformProjectMembershipsQuery } from "@/lib/queries/platform/usePlatformOperations";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import PlatformPagination from "./PlatformPagination";
import StatusBadge from "./ui/StatusBadge";
import { DirectoryTable, cell, input } from "./PlatformOperationsUi";
import { platformProjectErrorKey } from "./platformProjectError";

type Props = { projectId: string; organizationId: string };
export default function PlatformProjectMembers({
  projectId,
  organizationId,
}: Props) {
  const t = useTranslations("platformProjectAdmin");
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");
  const query = usePlatformProjectMembershipsQuery(
    projectId,
    organizationId,
    { page, search: search || undefined, status: status || undefined },
    visible,
  );
  return (
    <section
      className="mt-6 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-800"
      aria-label={t("members")}
    >
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {t("members")}
      </h3>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setVisible(!visible)}
      >
        {visible ? t("hideMembers") : t("showMembers")}
      </Button>
      {visible && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(draft.trim());
              setPage(1);
            }}
          >
            <div>
              <Label htmlFor="platform-member-search">{t("search")}</Label>
              <Input
                id="platform-member-search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={100}
                placeholder={t("searchHint")}
              />
            </div>
            <label className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
              {t("status")}
              <select
                className={`${input} focus-visible:ring-2 focus-visible:ring-brand-500`}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  setPage(1);
                }}
              >
                <option value="">{t("all")}</option>
                <option value="ACTIVE">{t("active")}</option>
                <option value="INACTIVE">{t("inactive")}</option>
              </select>
            </label>
            <Button type="submit" size="sm">
              {t("searchButton")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t("refresh")}
            </Button>
          </form>
          {query.isPending ? (
            <p role="status">{t("loading")}</p>
          ) : query.isError ? (
            <div
              role="alert"
              className="space-y-2 text-sm text-error-600 dark:text-error-400"
            >
              <p>{t(`error.${platformProjectErrorKey(query.error)}`)}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void query.refetch()}
              >
                {t("retry")}
              </Button>
            </div>
          ) : query.data.data.length ? (
            <DirectoryTable
              headers={[
                t("memberName"),
                t("email"),
                t("status"),
                t("accountStatus"),
                t("joinedAt"),
              ]}
            >
              {query.data.data.map((member) => (
                <tr key={member.id}>
                  <td className={cell}>
                    {member.user?.fullName ?? t("unknownUser")}
                  </td>
                  <td className={`${cell} break-all`}>
                    {member.user?.email ?? member.userId}
                  </td>
                  <td className={cell}>
                    <StatusBadge
                      status={member.status}
                      label={
                        member.status === "ACTIVE" ? t("active") : t("inactive")
                      }
                    />
                  </td>
                  <td className={cell}>{member.user?.accountStatus ?? "—"}</td>
                  <td className={cell}>
                    <time dateTime={member.joinedAt}>{member.joinedAt}</time>
                  </td>
                </tr>
              ))}
            </DirectoryTable>
          ) : (
            <p
              role="status"
              className="text-sm text-gray-600 dark:text-gray-300"
            >
              {t("empty")}
            </p>
          )}
          {!query.isError && query.data && (
            <PlatformPagination
              alwaysShow
              ariaLabel={t("members")}
              page={query.data.pagination.page}
              pageSize={query.data.pagination.pageSize}
              returnedItems={query.data.data.length}
              totalPages={query.data.pagination.totalPages}
              totalItems={query.data.pagination.totalItems}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
