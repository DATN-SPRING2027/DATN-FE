"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FileText,
  Folder,
  Globe,
  Hash,
  Info,
  Lock,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import { apiClient, ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  useCreateProjectMutation,
  type Project,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";
import { getMemberInitials } from "./ProjectVisualIdentity";

type WizardStep = 1 | 2 | 3 | 4;

export type OrganizationMemberOption = Readonly<{
  userId: string;
  fullName: string;
  email: string;
  roleCode?: string | null;
  projectRole?: "MEMBER" | "TEAM_LEADER";
}>;

function suggestCodeFromName(rawName: string): string {
  const ascii = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!ascii) return "";
  const withLeadingLetter = /^[A-Z]/.test(ascii) ? ascii : `P_${ascii}`;
  const clamped = withLeadingLetter.slice(0, 32).replace(/_+$/g, "");
  if (clamped.length === 1) return `${clamped}1`;
  return clamped;
}

function validateProjectName(value: string): string | null {
  if (value.length > 0 && !value.trim()) {
    return "Project name cannot be blank.";
  }
  if (!value.trim()) {
    return "Project name is required.";
  }
  if (value.length > 200) {
    return `Max 200 characters (${value.length}/200).`;
  }
  return null;
}

function validateProjectCode(value: string): string | null {
  if (value.length > 0 && !value.trim()) {
    return "Project code cannot be blank.";
  }
  if (!value.trim()) {
    return "Project code is required.";
  }
  if (/[a-z]/.test(value)) {
    return "Use uppercase letters (A–Z) only.";
  }
  if (/\s/.test(value)) {
    return "Spaces are not allowed (use _ or -).";
  }
  if (!/^[A-Z]/.test(value)) {
    return "Must start with a letter (A–Z).";
  }
  if (value.length < 2) {
    return "Must be at least 2 characters.";
  }
  if (value.length > 32) {
    return `Max 32 characters (${value.length}/32).`;
  }
  if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(value)) {
    return "Only A–Z, 0–9, - and _ are allowed.";
  }
  return null;
}

function validateProjectDescription(value: string): string | null {
  if (value.length > 2000) {
    return `Max 2,000 characters (${value.length}/2000).`;
  }
  return null;
}

export default function ProjectCreateForm({
  organizationId,
  currentUserId,
  currentUserName,
  currentUserEmail,
  onCreated,
  onCancel,
}: {
  organizationId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  onCreated: (project: Project) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("projects");
  const common = useTranslations("common");
  const mutation = useCreateProjectMutation(organizationId);
  const [step, setStep] = useState<WizardStep>(1);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [selectedMembers, setSelectedMembers] = useState<
    OrganizationMemberOption[]
  >([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const [touchedCode, setTouchedCode] = useState(false);
  const [blurredCode, setBlurredCode] = useState(false);
  const [touchedDescription, setTouchedDescription] = useState(false);

  const isSubmitting = mutation.isPending;

  const trimmedMemberSearch = memberSearch.trim();
  const orgMembersQuery = useQuery({
    queryKey: trimmedMemberSearch
      ? ["organization-members-create-picker", organizationId, trimmedMemberSearch]
      : ["organization-members-create-picker", organizationId],
    enabled: Boolean(organizationId && currentUserId && step === 3),
    retry: false,
    staleTime: 10_000,
    queryFn: async ({ signal }) => {
      const endpoint = trimmedMemberSearch
        ? `/iam/projects/member-candidates?search=${encodeURIComponent(trimmedMemberSearch)}`
        : `/iam/projects/member-candidates`;
      const res = await apiClient<{
        data?: Array<{
          userId?: string;
          fullName?: string;
          email?: string;
          status?: string;
          roleCode?: string | null;
          user?: {
            id?: string;
            fullName?: string;
            email?: string;
          } | null;
        }>;
      }>(endpoint, { signal, cache: "no-store" });
      const items = Array.isArray(res?.data) ? res.data : [];
      return items
        .map((item) => {
          const email = item.email ?? item.user?.email ?? "";
          const fullName =
            item.fullName || item.user?.fullName || email || "Member";
          return {
            userId: item.userId ?? item.user?.id ?? "",
            fullName,
            email,
            roleCode: item.roleCode ?? null,
          };
        })
        .filter(
          (item) =>
            Boolean(item.userId) &&
            Boolean(item.email) &&
            item.userId !== currentUserId,
        );
    },
  });

  const orgMembersAccessLost = isAccessOrResourceUnavailableError(orgMembersQuery.error);
  const visibleOrgMembers = orgMembersAccessLost ? undefined : orgMembersQuery.data;
  const unselectedOrgMembers = (visibleOrgMembers ?? []).filter(
    (member) => !selectedMembers.some((m) => m.userId === member.userId),
  );

  const filteredAvailableMembers = unselectedOrgMembers.filter((member) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      member.fullName.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  function addMemberToTeam(member: OrganizationMemberOption) {
    setSelectedMembers((prev) =>
      prev.some((m) => m.userId === member.userId)
        ? prev
        : [...prev, { ...member, projectRole: "MEMBER" }],
    );
  }

  function removeMemberFromTeam(userId: string) {
    setSelectedMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  function cycleMemberRole(userId: string) {
    setSelectedMembers((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? {
              ...m,
              projectRole:
                m.projectRole === "TEAM_LEADER" ? "MEMBER" : "TEAM_LEADER",
            }
          : m,
      ),
    );
  }

  const nameError = validateProjectName(name);
  const rawCodeError = validateProjectCode(code);
  const descriptionError = validateProjectDescription(description);

  const serverCodeConflict =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 409;

  // Avoid flashing "must be at least 2 characters" on the very 1st valid uppercase keystroke before blur/submit
  const isTypingFirstValidLetter =
    !invalid && !blurredCode && /^[A-Z]$/.test(code);

  const codeError = serverCodeConflict
    ? t("conflict")
    : isTypingFirstValidLetter
      ? null
      : rawCodeError;

  const showNameError = (invalid || touchedName) && nameError !== null;
  const showCodeError =
    serverCodeConflict || ((invalid || touchedCode) && codeError !== null);
  const showDescriptionError =
    (invalid || touchedDescription) && descriptionError !== null;

  const isNameValid = name.trim().length > 0 && nameError === null;
  const isCodeValid =
    code.length >= 2 && rawCodeError === null && !serverCodeConflict;

  const suggestedCode = suggestCodeFromName(name);
  const fixableCode = suggestCodeFromName(code);

  function handleNextStep() {
    if (step === 1) {
      setTouchedName(true);
      setTouchedCode(true);
      setBlurredCode(true);
      setTouchedDescription(true);
      if (nameError || rawCodeError || descriptionError) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
    }
    setStep((prev) => (prev < 4 ? ((prev + 1) as WizardStep) : prev));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !organizationId) return;
    if (step < 4) {
      handleNextStep();
      return;
    }
    if (
      !name.trim() ||
      name.length > 200 ||
      !/^[A-Z][A-Z0-9_-]{1,31}$/.test(code) ||
      description.length > 2000
    ) {
      setInvalid(true);
      setTouchedName(true);
      setTouchedCode(true);
      setBlurredCode(true);
      setTouchedDescription(true);
      setStep(1);
      return;
    }
    setInvalid(false);
    const selectedLeaderIds = selectedMembers
      .filter((m) => m.projectRole === "TEAM_LEADER")
      .map((m) => m.userId);
    mutation.mutate(
      {
        name,
        code,
        ...(description ? { description } : {}),
        ...(visibility === "PUBLIC" ? { visibility: "PUBLIC" } : {}),
        ...(selectedMembers.length > 0
          ? { memberUserIds: selectedMembers.map((m) => m.userId) }
          : {}),
        ...(selectedLeaderIds.length > 0
          ? { leaderUserIds: selectedLeaderIds }
          : {}),
      },
      {
        onSuccess: (created) => {
          onCreated(created);
        },
        onError: (err) => {
          if (
            err instanceof ApiError &&
            (err.status === 409 || err.status === 422)
          ) {
            setStep(1);
          }
        },
      },
    );
  }

  const creatorInitials = getMemberInitials(currentUserName || "DD");

  const steps: readonly {
    id: WizardStep;
    title: string;
    subtitle: string;
  }[] = [
    {
      id: 1,
      title: t("detail"),
      subtitle: "Basic information",
    },
    {
      id: 2,
      title: "Access & visibility",
      subtitle: "Who can access",
    },
    {
      id: 3,
      title: "Team",
      subtitle: "Add members",
    },
    {
      id: 4,
      title: "Review",
      subtitle: "Confirm and create",
    },
  ];

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t("create")}
      className="w-full min-w-0"
    >
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 @4xl:grid-cols-12">
        {/* Left 8-Col: 4-Step Wizard Card */}
        <div className="min-w-0 @4xl:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col @2xl:flex-row">
              {/* Left Stepper Sidebar */}
              <aside
                aria-label="Project creation steps"
                className="w-full shrink-0 border-b border-gray-100 bg-gray-50/40 p-5 sm:p-6 @2xl:w-60 @2xl:border-r @2xl:border-b-0 dark:border-gray-800 dark:bg-gray-800/20"
              >
                <ol className="relative space-y-6">
                  {steps.map((item, idx) => {
                    const isActive = step === item.id;
                    const isCompleted =
                      step > item.id ||
                      (item.id === 1 && isNameValid && isCodeValid && step > 1);
                    const isLast = idx === steps.length - 1;

                    return (
                      <li key={item.id} className="relative">
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-8 left-4 -ml-px h-6 w-0.5 transition-colors ${
                              isCompleted
                                ? "bg-brand-500"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              item.id > 1 &&
                              (nameError || rawCodeError || descriptionError)
                            ) {
                              setTouchedName(true);
                              setTouchedCode(true);
                              setBlurredCode(true);
                              setTouchedDescription(true);
                              setInvalid(true);
                              setStep(1);
                              return;
                            }
                            setStep(item.id);
                          }}
                          className="group flex w-full cursor-pointer items-start gap-3 text-left"
                        >
                          <span
                            aria-hidden="true"
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                              isActive
                                ? "bg-brand-500 text-white shadow-theme-xs ring-4 ring-brand-500/15"
                                : isCompleted
                                  ? "border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/20 dark:text-brand-300"
                                  : "border border-gray-200 bg-white text-gray-500 group-hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {isCompleted && !isActive ? (
                              <Check className="size-4" />
                            ) : (
                              item.id
                            )}
                          </span>
                          <span className="min-w-0 pt-0.5">
                            <span
                              className={`block text-xs sm:text-sm font-semibold transition-colors ${
                                isActive
                                  ? "text-gray-900 dark:text-white"
                                  : "text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                              {item.subtitle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </aside>

              {/* Right Step Content Area */}
              <div className="flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6 @3xl:p-7">
                {/* STEP 1: Project details (kept mounted so inputs are always accessible) */}
                <section
                  aria-labelledby="project-details-heading"
                  className={step === 1 ? "space-y-5" : "hidden"}
                >
                  <div>
                    <h2
                      id="project-details-heading"
                      className="text-base font-bold text-gray-900 sm:text-lg dark:text-white/90"
                    >
                      {t("detail")}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {t("detailsHint")}
                    </p>
                  </div>

                  {/* Field 1: Project name */}
                  <div>
                    <Label htmlFor="project-name">
                      {t("name")}{" "}
                      <span aria-hidden="true" className="text-error-500">
                        *
                      </span>
                    </Label>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-gray-400"
                      >
                        <Folder className="size-4" />
                      </span>
                      <input
                        id="project-name"
                        type="text"
                        aria-label={t("name")}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setTouchedName(true);
                        }}
                        onBlur={() => setTouchedName(true)}
                        required
                        maxLength={200}
                        disabled={mutation.isPending}
                        placeholder="e.g. Customer onboarding"
                        aria-invalid={showNameError}
                        aria-describedby={
                          showNameError ? "project-name-error" : undefined
                        }
                        className={`h-11 w-full rounded-xl border bg-white ps-10 pe-10 text-sm text-gray-900 shadow-theme-xs transition outline-none placeholder:text-gray-400 disabled:opacity-50 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 ${
                          showNameError
                            ? "border-error-500 focus:border-error-500 focus:ring-3 focus:ring-error-500/15"
                            : isNameValid
                              ? "border-success-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-success-500/40"
                              : "border-gray-200/90 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700"
                        }`}
                      />
                      {showNameError ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5 text-error-500"
                        >
                          <AlertCircle className="size-4" />
                        </span>
                      ) : isNameValid ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5 text-success-500"
                        >
                          <CheckCircle2 className="size-4" />
                        </span>
                      ) : null}
                    </div>
                    {showNameError && (
                      <p
                        id="project-name-error"
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-error-600 dark:text-error-400"
                      >
                        <AlertCircle
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                        />
                        <span>{nameError}</span>
                      </p>
                    )}
                  </div>

                  {/* Field 2: Project code */}
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="project-code" className="mb-0">
                        {t("code")}{" "}
                        <span aria-hidden="true" className="text-error-500">
                          *
                        </span>
                      </Label>

                      {suggestedCode && code !== suggestedCode && (
                        <button
                          type="button"
                          onClick={() => {
                            setCode(suggestedCode);
                            setTouchedCode(true);
                            setBlurredCode(true);
                            if (mutation.isError) mutation.reset();
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-200 bg-brand-50/80 px-2 py-0.5 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                        >
                          <Sparkles aria-hidden="true" className="size-3" />
                          <span>Use suggested: {suggestedCode}</span>
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-gray-400"
                      >
                        <Hash className="size-4" />
                      </span>
                      <input
                        id="project-code"
                        type="text"
                        aria-label={t("code")}
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setTouchedCode(true);
                          if (mutation.isError) mutation.reset();
                        }}
                        onBlur={() => {
                          setTouchedCode(true);
                          setBlurredCode(true);
                        }}
                        required
                        maxLength={32}
                        disabled={mutation.isPending}
                        placeholder="e.g. CUSTOMER_ONBOARDING"
                        aria-invalid={showCodeError}
                        aria-describedby={
                          showCodeError
                            ? "project-code-error"
                            : "project-code-hint"
                        }
                        className={`h-11 w-full rounded-xl border bg-white ps-10 pe-10 font-mono text-sm text-gray-900 shadow-theme-xs transition outline-none placeholder:font-sans placeholder:text-gray-400 disabled:opacity-50 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 ${
                          showCodeError
                            ? "border-error-500 focus:border-error-500 focus:ring-3 focus:ring-error-500/15"
                            : isCodeValid
                              ? "border-success-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-success-500/40"
                              : "border-gray-200/90 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700"
                        }`}
                      />
                      {showCodeError ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5 text-error-500"
                        >
                          <AlertCircle className="size-4" />
                        </span>
                      ) : isCodeValid ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5 text-success-500"
                        >
                          <CheckCircle2 className="size-4" />
                        </span>
                      ) : null}
                    </div>

                    {showCodeError ? (
                      <div
                        id="project-code-error"
                        className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-error-600 dark:text-error-400"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <AlertCircle
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
                          <span>{codeError}</span>
                        </span>
                        {fixableCode && fixableCode !== code && (
                          <button
                            type="button"
                            onClick={() => {
                              setCode(fixableCode);
                              setBlurredCode(true);
                              if (mutation.isError) mutation.reset();
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-error-200 bg-error-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-error-700 transition hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300"
                          >
                            Fix to {fixableCode}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p
                        id="project-code-hint"
                        className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
                      >
                        2–32 characters · Letters, numbers, hyphens or
                        underscores
                      </p>
                    )}
                  </div>

                  {/* Field 3: Description */}
                  <div>
                    <Label htmlFor="project-description">
                      {t("description")}
                    </Label>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-3.5 start-0 flex items-center ps-3.5 text-gray-400"
                      >
                        <FileText className="size-4" />
                      </span>
                      <textarea
                        id="project-description"
                        rows={4}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setTouchedDescription(true);
                        }}
                        maxLength={2000}
                        disabled={mutation.isPending}
                        placeholder="What is this project for? Add goals, scope, or context..."
                        aria-invalid={showDescriptionError}
                        aria-describedby={
                          showDescriptionError
                            ? "project-description-error"
                            : undefined
                        }
                        className={`w-full rounded-xl border bg-white py-3 ps-10 pe-4 text-sm text-gray-900 shadow-theme-xs transition outline-none placeholder:text-gray-400 disabled:opacity-50 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 ${
                          showDescriptionError
                            ? "border-error-500 focus:border-error-500 focus:ring-3 focus:ring-error-500/15"
                            : "border-gray-200/90 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700"
                        }`}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      {showDescriptionError ? (
                        <p
                          id="project-description-error"
                          className="flex items-center gap-1.5 text-xs font-medium text-error-600 dark:text-error-400"
                        >
                          <AlertCircle
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
                          <span>{descriptionError}</span>
                        </p>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-gray-400 tabular-nums dark:text-gray-500">
                        {description.length} / 2000
                      </span>
                    </div>
                  </div>
                </section>

                {/* STEP 2: Access & visibility */}
                {step === 2 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 sm:text-lg dark:text-white/90">
                        Access &amp; visibility
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Choose who can view and access this workspace.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Option 1: Private (Default) */}
                      <button
                        type="button"
                        aria-pressed={visibility === "PRIVATE"}
                        onClick={() => setVisibility("PRIVATE")}
                        className={`flex w-full cursor-pointer items-start justify-between gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                          visibility === "PRIVATE"
                            ? "border-brand-500 bg-brand-50/40 ring-3 ring-brand-500/10 dark:border-brand-500 dark:bg-brand-500/10"
                            : "border-gray-200/90 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <span
                            aria-hidden="true"
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                              visibility === "PRIVATE"
                                ? "bg-brand-500 text-white"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            <Lock className="size-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {t("PRIVATE")}
                              </span>
                              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/25 dark:text-brand-300">
                                {t("defaultVisibility")}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Only invited project members can view and
                              collaborate.
                            </p>
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            visibility === "PRIVATE"
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
                          }`}
                        >
                          {visibility === "PRIVATE" && (
                            <Check className="size-3" />
                          )}
                        </span>
                      </button>

                      {/* Option 2: Public */}
                      <button
                        type="button"
                        aria-pressed={visibility === "PUBLIC"}
                        onClick={() => setVisibility("PUBLIC")}
                        className={`flex w-full cursor-pointer items-start justify-between gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                          visibility === "PUBLIC"
                            ? "border-brand-500 bg-brand-50/40 ring-3 ring-brand-500/10 dark:border-brand-500 dark:bg-brand-500/10"
                            : "border-gray-200/90 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <span
                            aria-hidden="true"
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                              visibility === "PUBLIC"
                                ? "bg-brand-500 text-white"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            <Globe className="size-4" />
                          </span>
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {t("PUBLIC")}
                            </span>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              All active members in your organization can view
                              this project.
                            </p>
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            visibility === "PUBLIC"
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
                          }`}
                        >
                          {visibility === "PUBLIC" && (
                            <Check className="size-3" />
                          )}
                        </span>
                      </button>
                    </div>
                  </section>
                )}

                {/* STEP 3: Team & leadership */}
                {step === 3 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 sm:text-lg dark:text-white/90">
                        Team &amp; leadership
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Choose who can work on this project.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Left Column: Available members */}
                      <div className="flex flex-col rounded-2xl border border-gray-200/90 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Available members
                          </h3>
                          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                            {unselectedOrgMembers.length}
                          </span>
                        </div>

                        <div className="relative mt-3">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400"
                          >
                            <Search className="size-3.5" />
                          </span>
                          <input
                            type="text"
                            aria-label="Search organization members"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                              }
                            }}
                            placeholder="Search organization members..."
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white ps-9 pe-3 text-xs text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="mt-3 max-h-64 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                          {visibleOrgMembers !== undefined && !orgMembersAccessLost &&
                            (orgMembersQuery.isFetching ||
                              orgMembersQuery.isRefetchError) && (
                              <div className="py-2">
                                {orgMembersQuery.isFetching && (
                                  <UpdatingStatus>
                                    {common("updating")}
                                  </UpdatingStatus>
                                )}
                                {orgMembersQuery.isRefetchError && (
                                  <BackgroundRefreshError
                                    retryLabel={common("retry")}
                                    onRetry={() =>
                                      void orgMembersQuery.refetch()
                                    }
                                  >
                                    {common("updateFailed")}
                                  </BackgroundRefreshError>
                                )}
                              </div>
                            )}
                          {orgMembersQuery.isPending &&
                          !visibleOrgMembers ? (
                            <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                              Loading organization members...
                            </p>
                          ) : orgMembersQuery.isError &&
                            !visibleOrgMembers ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                              <p className="text-xs text-error-600 dark:text-error-400">
                                Unable to load organization members.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  void orgMembersQuery.refetch();
                                }}
                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                              >
                                {t("retry")}
                              </button>
                            </div>
                          ) : filteredAvailableMembers.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                              No available members found.
                            </p>
                          ) : (
                            filteredAvailableMembers.map((member) => (
                              <div
                                key={member.userId}
                                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    aria-hidden="true"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {getMemberInitials(
                                      member.fullName || member.email,
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                                      {member.fullName}
                                    </p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  aria-label={`Add ${member.fullName}`}
                                  onClick={() => addMemberToTeam(member)}
                                  className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-brand-200/80 bg-brand-50/50 px-3 text-xs font-semibold text-brand-600 transition hover:border-brand-300 hover:bg-brand-100/70 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                                >
                                  <Plus
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                  <span>Add</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Right Column: Project team */}
                      <div className="flex flex-col rounded-2xl border border-gray-200/90 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Project team
                          </h3>
                          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                            {1 + selectedMembers.length}
                          </span>
                        </div>

                        {/* Creator Pinned Card */}
                        <div className="mt-3 rounded-xl border border-gray-200/90 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                          <div className="flex items-start gap-3">
                            <span
                              aria-hidden="true"
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              {creatorInitials}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                                {currentUserName || "Project Creator"}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {currentUserEmail || "Workspace owner"}
                              </p>
                              <span className="mt-2 inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                                You · Project lead
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Added Members List */}
                        {selectedMembers.length > 0 && (
                          <div className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                            {selectedMembers.map((member) => (
                              <div
                                key={member.userId}
                                className="flex items-center justify-between gap-2.5 py-3"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    aria-hidden="true"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {getMemberInitials(
                                      member.fullName || member.email,
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                                      {member.fullName}
                                    </p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      cycleMemberRole(member.userId)
                                    }
                                    aria-label={`Role for ${member.fullName}`}
                                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                  >
                                    <span>
                                      {member.projectRole === "TEAM_LEADER"
                                        ? "Project lead"
                                        : "Member"}
                                    </span>
                                    <ChevronDown
                                      aria-hidden="true"
                                      className="size-3.5 text-gray-400"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${member.fullName}`}
                                    onClick={() =>
                                      removeMemberFromTeam(member.userId)
                                    }
                                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                                  >
                                    <X aria-hidden="true" className="size-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 4: Review */}
                {step === 4 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 sm:text-lg dark:text-white/90">
                        Review &amp; Confirm
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Confirm details before creating your project.
                      </p>
                    </div>

                    <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-1.5 text-xs sm:text-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-800/40">
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          {t("name")}
                        </dt>
                        <dd className="font-semibold text-gray-900 dark:text-white">
                          {name.trim() || "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          {t("code")}
                        </dt>
                        <dd className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                          {code.trim() || "—"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4 py-2.5">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          {t("description")}
                        </dt>
                        <dd className="max-w-xs text-right text-gray-700 dark:text-gray-300">
                          {description.trim() || t("noDescription")}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          {t("visibility")}
                        </dt>
                        <dd className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                          {visibility === "PUBLIC" ? (
                            <Globe aria-hidden="true" className="size-3.5" />
                          ) : (
                            <Lock aria-hidden="true" className="size-3.5" />
                          )}
                          <span>{t(visibility)}</span>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          Team
                        </dt>
                        <dd className="font-semibold text-gray-800 dark:text-gray-200">
                          {1 + selectedMembers.length}{" "}
                          {selectedMembers.length === 0 ? "member" : "members"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}

                {/* Compact Validation Alert + Mutation Error */}
                <div className="mt-4 space-y-2.5">
                  {invalid &&
                    Boolean(nameError || rawCodeError || descriptionError) && (
                      <div
                        id="project-validation"
                        role="alert"
                        className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50/80 px-3.5 py-2.5 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                      >
                        <AlertCircle
                          aria-hidden="true"
                          className="size-4 shrink-0 text-error-500"
                        />
                        <span>
                          {nameError || rawCodeError || descriptionError}
                        </span>
                        <span className="sr-only">{t("validation")}</span>
                      </div>
                    )}
                  {mutation.isError && <ProjectState error={mutation.error} />}
                </div>

                {/* Bottom Step Navigation & Submit Bar */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
                  <div>
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setStep((prev) =>
                            prev > 1 ? ((prev - 1) as WizardStep) : prev,
                          )
                        }
                        className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 text-xs sm:text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <ArrowLeft aria-hidden="true" className="size-4" />
                        <span>Back</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {onCancel && (
                      <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-gray-200/90 bg-white px-4 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {t("cancel")}
                      </button>
                    )}

                    {step < 4 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        disabled={isSubmitting}
                        className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-5 text-xs sm:text-sm font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span>{t("next")}</span>
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </button>
                    ) : (
                      <Button
                        className="h-10 cursor-pointer rounded-xl bg-brand-500 px-5 text-xs sm:text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        disabled={isSubmitting || !organizationId}
                      >
                        {t(isSubmitting ? "creating" : "create")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4-Col: Project Preview + Default Settings + Info Callout */}
        <aside className="min-w-0 space-y-5 @4xl:col-span-4">
          {/* Card 1: Project Preview */}
          <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white/90">
              Project preview
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              This is how your project will appear after creation.
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
              {/* Top Decorative TailAdmin Wave Banner */}
              <div
                aria-hidden="true"
                className="h-12 bg-gradient-to-r from-brand-50 via-indigo-50/70 to-sky-50 dark:from-brand-500/15 dark:via-indigo-500/10 dark:to-sky-500/10"
              />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    <Folder className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-gray-900 dark:text-white">
                      {name.trim() || "Customer onboarding"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {code.trim() || "CUSTOMER_ONBOARDING"}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                  {description.trim() || "—"}
                </p>

                <div className="mt-3.5 flex items-center gap-3 border-y border-gray-100 py-2.5 text-xs dark:border-gray-800">
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-300">
                    {visibility === "PUBLIC" ? (
                      <Globe
                        aria-hidden="true"
                        className="size-3.5 text-gray-400"
                      />
                    ) : (
                      <Lock
                        aria-hidden="true"
                        className="size-3.5 text-gray-400"
                      />
                    )}
                    <span>{t(visibility)}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-px bg-gray-200 dark:bg-gray-700"
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-0.5 font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-success-500"
                    />
                    <span>{t("active")}</span>
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex -space-x-2">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[11px] font-bold text-gray-700 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {creatorInitials}
                    </span>
                    {selectedMembers.slice(0, 3).map((m) => (
                      <span
                        key={m.userId}
                        aria-hidden="true"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-50 text-[11px] font-bold text-brand-600 dark:border-gray-900 dark:bg-brand-500/20 dark:text-brand-300"
                      >
                        {getMemberInitials(m.fullName || m.email)}
                      </span>
                    ))}
                  </div>
                  <span>
                    {selectedMembers.length === 0
                      ? "No members yet"
                      : `${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} added`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Default Settings */}
          <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white/90">
              Default settings
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              You can change these later in project settings.
            </p>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 font-medium text-gray-600 dark:text-gray-300">
                  {visibility === "PUBLIC" ? (
                    <Globe aria-hidden="true" className="size-4 text-gray-400" />
                  ) : (
                    <Lock aria-hidden="true" className="size-4 text-gray-400" />
                  )}
                  <span>{t("visibility")}</span>
                </dt>
                <dd className="inline-flex h-8 min-w-[148px] items-center justify-between rounded-lg border border-gray-200/90 bg-gray-50/70 px-3 font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <span>{t(visibility)}</span>
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 font-medium text-gray-600 dark:text-gray-300">
                  <CircleDot
                    aria-hidden="true"
                    className="size-4 text-gray-400"
                  />
                  <span>{t("createBlueprintLifecycleLabel")}</span>
                </dt>
                <dd className="inline-flex h-8 min-w-[148px] items-center justify-between rounded-lg border border-gray-200/90 bg-gray-50/70 px-3 font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <span>{t("active")}</span>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-success-500"
                  />
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 font-medium text-gray-600 dark:text-gray-300">
                  <Users aria-hidden="true" className="size-4 text-gray-400" />
                  <span>{t("createBlueprintScopeLabel")}</span>
                </dt>
                <dd className="inline-flex h-8 min-w-[148px] items-center justify-between rounded-lg border border-gray-200/90 bg-gray-50/70 px-3 font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <span>Organization members</span>
                </dd>
              </div>
            </dl>
            <span className="sr-only">{t("privateHint")}</span>
          </div>

          {/* Card 3: Info Callout */}
          <div className="flex items-start gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/60 p-4 text-xs leading-relaxed text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <Info
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400"
            />
            <p>
              You can invite members and configure more settings after the
              project is created.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
