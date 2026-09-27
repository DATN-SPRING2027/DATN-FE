"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";
import { useUsersQuery, type RoleCode, type UserStatus } from "@/lib/queries/users/useUsers";
import UserEditor from "./UserEditor";

const cellClass = "px-5 py-3 text-start text-sm text-gray-700 dark:text-gray-300";
const headingClass = "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";

export default function UserDirectory() {
  const t = useTranslations("users");
  const currentUser = useCurrentUserQuery();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<UserStatus | undefined>();
  const [roleCode, setRoleCode] = useState<RoleCode | undefined>();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saved, setSaved] = useState(false);
  const organizationId = currentUser.data?.organizationId ?? "";
  const users = useUsersQuery(organizationId, { page, pageSize: 20, ...(status ? { status } : {}), ...(roleCode ? { roleCode } : {}) });
  const forbidden = users.error instanceof ApiError && users.error.status === 403;

  return (
    <ComponentCard title={t("title")}>
      <div className="space-y-5">
        {saved && <Alert variant="success" title={t("savedTitle")} message={t("savedMessage")} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user-filter-status">{t("status")}</Label>
            <Select id="user-filter-status" defaultValue="all" onChange={(value) => { setStatus(value === "all" ? undefined : value as UserStatus); setPage(1); }} options={[
              { value: "all", label: t("allStatuses") },
              { value: "ACTIVE", label: t("active") },
              { value: "SUSPENDED", label: t("suspended") },
              { value: "PENDING_INVITE", label: t("pendingInvite") },
            ]} />
          </div>
          <div>
            <Label htmlFor="user-filter-role">{t("role")}</Label>
            <Select id="user-filter-role" defaultValue="all" onChange={(value) => { setRoleCode(value === "all" ? undefined : value as RoleCode); setPage(1); }} options={[
              { value: "all", label: t("allRoles") },
              { value: "ADMIN", label: "ADMIN" },
              { value: "TEAM_LEADER", label: "TEAM_LEADER" },
              { value: "MEMBER", label: "MEMBER" },
            ]} />
          </div>
        </div>

        {users.isPending && <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>}
        {users.isError && <Alert variant="error" title={t("loadErrorTitle")} message={forbidden ? t("forbidden") : t("loadError")} />}
        {users.isSuccess && (
          <>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/5">
                    <TableRow>
                      <TableCell isHeader className={headingClass}>{t("fullName")}</TableCell>
                      <TableCell isHeader className={headingClass}>{t("email")}</TableCell>
                      <TableCell isHeader className={headingClass}>{t("role")}</TableCell>
                      <TableCell isHeader className={headingClass}>{t("status")}</TableCell>
                      <TableCell isHeader className={headingClass}>{t("actions")}</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.data.data.map((user) => (
                      <TableRow key={user.id} className="border-b border-gray-100 last:border-b-0 dark:border-white/5">
                        <TableCell className={cellClass}>{user.fullName}</TableCell>
                        <TableCell className={cellClass}>{user.email}</TableCell>
                        <TableCell className={cellClass}>{user.roleCodes.join(", ")}</TableCell>
                        <TableCell className={cellClass}><Badge size="sm" color={user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "error" : "warning"}>{t(user.status === "ACTIVE" ? "active" : user.status === "SUSPENDED" ? "suspended" : "pendingInvite")}</Badge></TableCell>
                        <TableCell className={cellClass}><button type="button" onClick={() => { setSaved(false); setSelectedUserId(user.id); }} className="font-medium text-brand-500 hover:text-brand-600">{t("viewEdit")}</button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {users.data.data.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t("pageOf", { page: users.data.pagination.page, total: Math.max(1, users.data.pagination.totalPages) })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("previous")}</Button>
                <Button size="sm" variant="outline" disabled={page >= users.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{t("next")}</Button>
              </div>
            </div>
          </>
        )}
        {selectedUserId && <UserEditor organizationId={organizationId} userId={selectedUserId} actorId={currentUser.data?.id ?? ""} onClose={() => setSelectedUserId("")} onSaved={() => { setSelectedUserId(""); setSaved(true); }} />}
      </div>
    </ComponentCard>
  );
}
