"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PencilIcon } from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useUserQuery, useUpdateUserMutation } from "@/lib/queries/users/useUsers";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import { useModal } from "@/hooks/useModal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function safeAvatarUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function parseAvatarUrl(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;

  return safeAvatarUrl(trimmed);
}

export default function UserMetaCard() {
  const t = useTranslations("profile");
  const roleLabel = useRoleDisplayLabel();
  const { isOpen, openModal, closeModal } = useModal();
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data;
  const organizationId = currentUser?.context === "ACCOUNT" ? "" : currentUser?.organizationId ?? "";
  const userId = currentUser?.id ?? "";
  const directoryQuery = useUserQuery(organizationId, userId);
  const updateUser = useUpdateUserMutation();
  const directoryUser = directoryQuery.data?.id === currentUser?.id ? directoryQuery.data : undefined;
  const fullName = directoryUser?.fullName || currentUser?.name || "";
  const avatarUrl = safeAvatarUrl(directoryUser?.avatarUrl);
  const roleNames = currentUser?.roles?.map(roleLabel).filter(Boolean) ?? [];
  const [avatarUrlError, setAvatarUrlError] = useState(false);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !directoryUser || directoryUser.id !== currentUser.id || !organizationId) return;

    const formData = new FormData(event.currentTarget);
    const normalizedName = String(formData.get("fullName") ?? "").trim();
    if (!normalizedName) return;

    const changes: { fullName?: string; avatarUrl?: string | null } = {};
    if (normalizedName !== directoryUser.fullName) changes.fullName = normalizedName;
    const submittedAvatarUrl = String(formData.get("avatarUrl") ?? "").trim();
    const currentAvatarUrl = directoryUser.avatarUrl ?? "";
    if (submittedAvatarUrl !== currentAvatarUrl) {
      const nextAvatarUrl = parseAvatarUrl(submittedAvatarUrl);
      if (nextAvatarUrl === undefined) {
        setAvatarUrlError(true);
        return;
      }
      changes.avatarUrl = nextAvatarUrl;
    }

    if (Object.keys(changes).length === 0) {
      closeModal();
      return;
    }

    updateUser.mutate(
      { userId: currentUser.id, ...changes },
      { onSuccess: closeModal },
    );
  };

  if (currentUserQuery.isPending) {
    return (
      <section className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800" aria-live="polite">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>
      </section>
    );
  }

  if (currentUserQuery.isError || !currentUser) {
    return (
      <section className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800" role="alert">
        <p className="mb-4 text-sm text-error-500">{t("loadError")}</p>
        <Button size="sm" variant="outline" onClick={() => void currentUserQuery.refetch()}>
          {t("retry")}
        </Button>
      </section>
    );
  }

  const initials = getInitials(fullName) || "?";

  return (
    <>
      <section className="mb-6 rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
        <div className="flex flex-col gap-5 sm:flex-row xl:gap-10">
          <div className="flex-1">
            <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-lg font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={t("avatarAlt", { name: fullName })}
                    className="size-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span aria-label={t("avatarInitials", { initials })}>{initials}</span>
                )}
              </div>
              <div className="text-start">
                <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {fullName || t("notProvided")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {roleNames.length ? roleNames.join(", ") : t("notProvided")}
                </p>
              </div>
            </div>

            {directoryQuery.isError && organizationId ? (
              <p className="mb-4 text-sm text-error-500" role="status">{t("detailsLoadError")}</p>
            ) : null}

            <dl className="grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-11 xl:gap-y-7">
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{t("fullName")}</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">{fullName || t("notProvided")}</dd>
              </div>
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{t("email")}</dt>
                <dd className="break-words text-sm font-medium text-gray-800 dark:text-white/90">{currentUser.email}</dd>
              </div>
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{t("role")}</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {roleNames.length ? roleNames.join(", ") : t("notProvided")}
                </dd>
              </div>
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{t("phone")}</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">{t("notProvided")}</dd>
              </div>
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{t("bio")}</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">{t("notProvided")}</dd>
              </div>
            </dl>
          </div>

          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                updateUser.reset();
                setAvatarUrlError(false);
                openModal();
              }}
              disabled={!directoryUser || directoryQuery.isError || updateUser.isPending}
              startIcon={<PencilIcon className="size-5" />}
            >
              {t("editProfile")}
            </Button>
          </div>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[560px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          className="w-full rounded-3xl bg-white p-6 lg:p-9 dark:bg-gray-900"
        >
          <div className="pe-12">
            <h3 id="profile-edit-title" className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{t("editTitle")}</h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{t("editDescription")}</p>
          </div>

          <form key={currentUser.id} onSubmit={handleSave} className="space-y-5">
            <div>
              <Label htmlFor="profile-full-name">{t("fullName")}</Label>
              <Input
                id="profile-full-name"
                type="text"
                name="fullName"
                autoComplete="name"
                maxLength={120}
                required
                defaultValue={directoryUser?.fullName ?? currentUser.name}
              />
            </div>

            <div>
              <Label htmlFor="profile-avatar-url">{t("avatarUrl")}</Label>
              <Input
                id="profile-avatar-url"
                type="text"
                name="avatarUrl"
                autoComplete="url"
                maxLength={2048}
                placeholder="https://"
                defaultValue={directoryUser?.avatarUrl ?? ""}
                onChange={() => setAvatarUrlError(false)}
              />
              {avatarUrlError ? <p className="mt-1.5 text-xs text-error-500" role="alert">{t("avatarUrlError")}</p> : null}
            </div>

            {updateUser.isError ? <p className="text-sm text-error-500" role="alert">{t("saveError")}</p> : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button size="sm" type="button" variant="outline" onClick={closeModal} disabled={updateUser.isPending}>
                {t("cancel")}
              </Button>
              <Button size="sm" type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
