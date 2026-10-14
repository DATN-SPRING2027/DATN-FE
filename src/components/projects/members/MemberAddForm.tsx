"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

export default function MemberAddForm({
  onAdd,
  disabled,
  pending,
}: {
  onAdd: (userId: string) => void;
  disabled: boolean;
  pending: boolean;
}) {
  const t = useTranslations("projectMembers");
  const [userId, setUserId] = useState("");
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    if (!userId.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onAdd(userId.trim());
  }
  return (
    <form
      aria-label={t("add")}
      onSubmit={submit}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-col items-start gap-3 @xl:flex-row @xl:items-end">
        <div className="w-full min-w-0 sm:max-w-md">
          <Label htmlFor="project-member-user">{t("userId")}</Label>
          <Input
            id="project-member-user"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setInvalid(false);
            }}
            required
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={
              invalid ? "member-input-error" : "member-add-hint"
            }
          />
        </div>
        <Button
          disabled={disabled}
          className="shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {t(pending ? "adding" : "add")}
        </Button>
      </div>
      {invalid && (
        <p
          id="member-input-error"
          role="alert"
          className="text-sm text-error-600 dark:text-error-400"
        >
          {t("requiredId")}
        </p>
      )}
      <p
        id="member-add-hint"
        className="text-sm text-gray-600 dark:text-gray-400"
      >
        {t("addHint")}
      </p>
    </form>
  );
}
