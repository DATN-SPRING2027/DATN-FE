"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  useCreateOrganizationInvitationMutation,
  useOrganizationInvitationsQuery,
  useRevokeOrganizationInvitationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

type InvitationRole = "ADMIN" | "TEAM_LEADER" | "MEMBER";

export default function OrganizationInvitationManager({
  organizationId,
}: {
  organizationId: string;
}) {
  const t = useTranslations("users");
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState<InvitationRole>("MEMBER");
  const [createdEmail, setCreatedEmail] = useState("");
  const invitations = useOrganizationInvitationsQuery(organizationId, true);
  const create = useCreateOrganizationInvitationMutation();
  const revoke = useRevokeOrganizationInvitationMutation();

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedEmail("");
    try {
      const invitation = await create.mutateAsync({
        organizationId,
        email: email.trim(),
        roleCode,
      });
      setCreatedEmail(invitation.email);
      setEmail("");
    } catch {
      // The API error is announced below the form.
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 p-5 dark:border-gray-800" aria-labelledby="organization-invitations-heading">
      <div>
        <h2 id="organization-invitations-heading" className="font-medium text-gray-900 dark:text-white">{t("invitationsTitle")}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("invitationsDescription")}</p>
      </div>

      {createdEmail && <Alert variant="success" title={t("invitationCreatedTitle")} message={t("invitationCreatedMessage", { email: createdEmail })} />}

      <form className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]" onSubmit={(event) => void createInvitation(event)}>
        <div>
          <Label htmlFor="invitation-email">{t("email")}</Label>
          <Input id="invitation-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="invitation-role">{t("role")}</Label>
          <Select id="invitation-role" defaultValue="MEMBER" onChange={(value) => setRoleCode(value as InvitationRole)} options={[
            { value: "MEMBER", label: "MEMBER" },
            { value: "TEAM_LEADER", label: "TEAM_LEADER" },
            { value: "ADMIN", label: "ADMIN" },
          ]} />
        </div>
        <Button disabled={create.isPending}>{t("inviteAction")}</Button>
      </form>

      {create.isError && <Alert variant="error" title={t("invitationErrorTitle")} message={t("invitationError")} />}
      {invitations.isLoading && <p className="text-sm text-gray-500" aria-busy="true">{t("invitationsLoading")}</p>}
      {invitations.isError && <Alert variant="error" title={t("invitationErrorTitle")} message={t("invitationsLoadError")} />}
      {invitations.data && invitations.data.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t("invitationsEmpty")}</p>}
      {invitations.data && invitations.data.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {invitations.data.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{invitation.email}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("invitationRoleExpiry", { role: invitation.roleCode, date: new Date(invitation.expiresAt).toISOString().slice(0, 10) })}</p>
              </div>
              <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => void revoke.mutateAsync({ organizationId, invitationId: invitation.id }).catch(() => undefined)}>{t("revokeInvitation")}</Button>
            </li>
          ))}
        </ul>
      )}
      {revoke.isError && <Alert variant="error" title={t("invitationErrorTitle")} message={t("invitationRevokeError")} />}
    </section>
  );
}
