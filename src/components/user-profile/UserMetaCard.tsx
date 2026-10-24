"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { PencilIcon } from "@/icons";
import UserAvatar, { safeAvatarUrl } from "@/components/common/UserAvatar";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useUserQuery, useUpdateUserMutation } from "@/lib/queries/users/useUsers";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";
import { useModal } from "@/hooks/useModal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";

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
  const activeProjects = useActiveOrganizationProjects(
    organizationId,
    !currentUser?.roles?.includes("ADMIN"),
  );
  const directoryQuery = useUserQuery(organizationId, userId);
  const updateUser = useUpdateUserMutation();
  const directoryUser = directoryQuery.data?.id === currentUser?.id ? directoryQuery.data : undefined;
  const fullName = directoryUser?.fullName || currentUser?.name || "";
  const avatarUrl = safeAvatarUrl(directoryUser?.avatarUrl);
  const roleNames = currentUser?.roles?.includes("ADMIN")
    ? [roleLabel("ADMIN")]
    : activeProjects.isComplete && activeProjects.leaderUserIds.has(userId)
      ? [roleLabel("TEAM_LEADER")]
      : currentUser?.roles?.map(roleLabel).filter(Boolean) ?? [];
  const [avatarUrlError, setAvatarUrlError] = useState(false);
  const editButtonRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    closeModal();
    editButtonRef.current?.querySelector("button")?.focus();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])"));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

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
      handleClose();
      return;
    }

    updateUser.mutate(
      { userId: currentUser.id, ...changes },
      { onSuccess: handleClose },
    );
  };

  const profileHeader = (
    <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{t("accountLabel")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{t("pageDescription")}</p>
      </div>
      <div ref={editButtonRef}>
        <Button
          size="sm"
          type="button"
          className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
          disabled={!directoryUser || directoryQuery.isError || updateUser.isPending}
          onClick={() => {
            updateUser.reset();
            setAvatarUrlError(false);
            openModal();
          }}
          startIcon={<PencilIcon className="size-4" aria-hidden="true" />}
        >
          {t("editProfile")}
        </Button>
        {currentUser?.context === "ACCOUNT" ? <p className="mt-2 max-w-48 text-xs text-gray-500 dark:text-gray-400">{t("editUnavailable")}</p> : null}
      </div>
    </header>
  );

  if (currentUserQuery.isPending) {
    return (
      <>{profileHeader}<section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" aria-busy="true" aria-label={t("loading")}>
        <div className="flex animate-pulse items-center gap-4" aria-hidden="true"><span className="size-16 rounded-full bg-gray-200 dark:bg-gray-800" /><span className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" /></div>
        <p className="sr-only">{t("loading")}</p>
      </section></>
    );
  }

  if (currentUserQuery.isError || !currentUser) {
    return (
      <>{profileHeader}<section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" role="alert">
        <p className="mb-4 text-sm text-error-500">{t("loadError")}</p>
        <Button size="sm" variant="outline" onClick={() => void currentUserQuery.refetch()}>
          {t("retry")}
        </Button>
      </section></>
    );
  }

  const identityRole = roleNames.length ? roleNames.join(", ") : t("accountContext");

  return (
    <>
      {profileHeader}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="personal-information-heading">
        <h2 id="personal-information-heading" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("personalInformation")}</h2>
        <div className="mt-5 flex min-w-0 items-center gap-4 border-b border-gray-200 pb-5 dark:border-gray-800">
          <UserAvatar name={fullName} avatarUrl={avatarUrl} alt={t("avatarAlt", { name: fullName })} className="size-16 text-lg sm:size-18" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900 dark:text-white/90">{fullName || t("notProvided")}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{identityRole}</p>
          </div>
        </div>

        {directoryQuery.isError && organizationId ? (
          <p className="mt-4 text-sm text-error-600 dark:text-error-400" role="status">{t("detailsLoadError")}</p>
        ) : null}

        <dl className="mt-5 grid min-w-0 grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("fullName")}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">{fullName || t("notProvided")}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("email")}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white/90">{currentUser.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{currentUser.context === "ACCOUNT" ? t("accountLabel") : t("organizationRole")}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">{identityRole}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("phone")}</dt>
                <dd className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("notProvided")}</dd>
              </div>
              <div className="border-t border-gray-100 pt-4 dark:border-gray-800 sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("bio")}</dt>
                <dd className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("bioUnavailable")}</dd>
              </div>
            </dl>
      </section>

      <Modal isOpen={isOpen} onClose={handleClose} showCloseButton={false} className="m-4 max-w-[560px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          onKeyDown={handleDialogKeyDown}
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
                autoFocus
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
              <Button size="sm" type="button" variant="outline" onClick={handleClose} disabled={updateUser.isPending}>
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
