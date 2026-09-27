"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { ApiError } from "@/lib/api-client";
import { useUpdateUserMutation, useUserQuery, type DirectoryUser, type UserStatus, type UserUpdateInput } from "@/lib/queries/users/useUsers";

type Props = Readonly<{
  organizationId: string;
  userId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}>;

function EditorForm({ user, actorId, onClose, onSaved }: Readonly<{ user: DirectoryUser; actorId: string; onClose: () => void; onSaved: () => void }>) {
  const t = useTranslations("users");
  const [fullName, setFullName] = useState(user.fullName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [status, setStatus] = useState<UserStatus>(user.status);
  const update = useUpdateUserMutation();
  const canChangeStatus = user.id !== actorId;
  const changed = fullName.trim() !== user.fullName || avatarUrl !== (user.avatarUrl ?? "") || (canChangeStatus && status !== user.status);

  async function save() {
    if (!changed || !fullName.trim()) return;
    const changes: UserUpdateInput = {
      userId: user.id,
      ...(fullName.trim() === user.fullName ? {} : { fullName: fullName.trim() }),
      ...(avatarUrl === (user.avatarUrl ?? "") ? {} : { avatarUrl: avatarUrl.trim() || null }),
      ...(canChangeStatus && status !== user.status ? { status } : {}),
    };
    try {
      await update.mutateAsync(changes);
      onSaved();
    } catch {
      // The existing alert below keeps the edit form available for correction.
    }
  }

  const error = update.error instanceof ApiError ? update.error : null;
  const errorMessage = error?.status === 409 && error.code === "LAST_ACTIVE_ADMIN" ? t("lastAdmin") : error?.status === 422
    ? t("validationError") : error?.status === 403 ? t("forbidden") : update.error ? t("saveError") : null;

  return (
    <div className="space-y-5 p-6 lg:p-10">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{t("editUser")}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
      {errorMessage && <Alert variant="error" title={t("saveErrorTitle")} message={errorMessage} />}
      <div>
        <Label htmlFor="user-full-name">{t("fullName")}</Label>
        <Input id="user-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={200} required />
      </div>
      <div>
        <Label htmlFor="user-avatar-url">{t("avatarUrl")}</Label>
        <Input id="user-avatar-url" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://" />
      </div>
      {canChangeStatus && (
        <div>
          <Label htmlFor="user-status">{t("status")}</Label>
          <Select id="user-status" key={user.id} defaultValue={user.status} onChange={(value) => setStatus(value as UserStatus)} options={[
            { value: "ACTIVE", label: t("active") },
            { value: "SUSPENDED", label: t("suspended") },
            { value: "PENDING_INVITE", label: t("pendingInvite") },
          ]} />
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onClose}>{t("cancel")}</Button>
        <Button size="sm" disabled={!changed || !fullName.trim() || update.isPending} onClick={save}>{t("save")}</Button>
      </div>
    </div>
  );
}

export default function UserEditor({ organizationId, userId, actorId, onClose, onSaved }: Props) {
  const t = useTranslations("users");
  const user = useUserQuery(organizationId, userId);
  return (
    <Modal isOpen={Boolean(userId)} onClose={onClose} className="mx-4 max-w-xl">
      {user.isPending ? <div className="p-8 text-sm text-gray-500">{t("loading")}</div> : user.isError
        ? <div className="p-8"><Alert variant="error" title={t("loadErrorTitle")} message={t("loadError")} /></div>
        : <EditorForm key={user.data.id} user={user.data} actorId={actorId} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
