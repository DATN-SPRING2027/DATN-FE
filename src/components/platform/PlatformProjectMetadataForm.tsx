"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import {
  usePlatformChangeProjectMetadataMutation,
  type PlatformProjectRecord,
} from "@/lib/queries/platform/usePlatformOperations";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { input } from "./PlatformOperationsUi";
import { platformProjectErrorKey } from "./platformProjectError";

type Props = {
  project: PlatformProjectRecord;
  canManage: boolean;
  reload: () => Promise<PlatformProjectRecord | undefined>;
};
export default function PlatformProjectMetadataForm({
  project,
  canManage,
  reload,
}: Props) {
  const t = useTranslations("platformProjectAdmin");
  const mutation = usePlatformChangeProjectMetadataMutation();
  const [baseline, setBaseline] = useState(project);
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code);
  const [visibility, setVisibility] = useState(project.visibility);
  const [reasonCode, setReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const pending = mutation.isPending || reloading;

  async function refresh() {
    setReloading(true);
    try {
      const latest = await reload();
      if (!latest) throw new Error("Project refresh failed");
      setBaseline(latest);
      setName(latest.name);
      setCode(latest.code);
      setVisibility(latest.visibility);
      setStale(false);
      setFailure(false);
      setMessage("");
    } catch (error) {
      setFailure(true);
      setMessage(t(`error.${platformProjectErrorKey(error)}`));
    } finally {
      setReloading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || pending || stale) return;
    const changes = {
      ...(name.trim() !== baseline.name ? { name: name.trim() } : {}),
      ...(code !== baseline.code ? { code } : {}),
      ...(visibility !== baseline.visibility ? { visibility } : {}),
    };
    if (!Object.keys(changes).length) {
      setFailure(false);
      setMessage(t("noChanges"));
      return;
    }
    setMessage("");
    try {
      const updated = await mutation.mutateAsync({
        projectId: project.id,
        ...changes,
        expectedUpdatedAt: baseline.updatedAt,
        reasonCode,
      });
      setBaseline(updated);
      setName(updated.name);
      setCode(updated.code);
      setVisibility(updated.visibility);
      setFailure(false);
      setMessage(t("saved"));
    } catch (error) {
      setFailure(true);
      setMessage(t(`error.${platformProjectErrorKey(error)}`));
      setStale(
        error instanceof ApiError &&
          error.status === 409 &&
          error.code !== "PROJECT_CODE_CONFLICT",
      );
    }
  }
  if (!canManage)
    return (
      <p
        role="status"
        className="mt-4 text-sm text-gray-600 dark:text-gray-300"
      >
        {t("readOnly")}
      </p>
    );
  return (
    <form
      onSubmit={submit}
      aria-label={t("metadata")}
      className="mt-5 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-800"
    >
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {t("metadata")}
      </h3>
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-4 sm:grid-cols-2"
      >
        <div>
          <Label htmlFor="platform-project-name">{t("name")}</Label>
          <Input
            id="platform-project-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            pattern=".*\S.*"
          />
        </div>
        <div>
          <Label htmlFor="platform-project-code">{t("code")}</Label>
          <Input
            id="platform-project-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            minLength={2}
            maxLength={32}
            pattern="[A-Z][A-Z0-9_\-]{1,31}"
            aria-describedby="platform-project-code-hint"
          />
          <p
            id="platform-project-code-hint"
            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
          >
            {t("codeHint")}
          </p>
        </div>
        <label className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
          {t("visibility")}
          <select
            className={`${input} focus-visible:ring-2 focus-visible:ring-brand-500`}
            name="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="PRIVATE">{t("private")}</option>
            <option value="PUBLIC">{t("public")}</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
          {t("reason")}
          <select
            className={`${input} focus-visible:ring-2 focus-visible:ring-brand-500`}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as typeof reasonCode)}
          >
            <option value="ACCESS_REVIEW">{t("accessReview")}</option>
            <option value="SECURITY_INCIDENT">{t("securityIncident")}</option>
          </select>
        </label>
      </fieldset>
      <p className="text-xs break-all text-gray-500 dark:text-gray-400">
        {t("version", { value: baseline.updatedAt })}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={pending || stale}>
          {mutation.isPending ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void refresh()}
        >
          {t("reload")}
        </Button>
      </div>
      {message && (
        <p
          role={failure ? "alert" : "status"}
          className={
            failure
              ? "text-sm text-error-600 dark:text-error-400"
              : "text-sm text-success-700 dark:text-success-400"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
