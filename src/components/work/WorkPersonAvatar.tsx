import { MonoIcon } from "./WorkMonoIcons";

const AVATAR_TONES = [
  "bg-blue-light-700 text-white",
  "bg-brand-600 text-white",
  "bg-success-700 text-white",
  "bg-warning-700 text-white",
  "bg-brand-800 text-white",
  "bg-error-600 text-white",
  "bg-blue-light-800 text-white",
] as const;

function hashPersonTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function isUnassignedPerson(person: {
  id?: string;
  name: string;
  initials: string;
}): boolean {
  return (
    person.id === "unassigned" ||
    (person.initials === "UN" &&
      person.name.trim().toLowerCase() === "unassigned")
  );
}

const SIZE_CLASSES = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-[10px]",
} as const;

export function WorkPersonAvatar({
  person,
  size = "sm",
  className = "",
}: {
  person: { id?: string; name: string; initials: string };
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const unassigned = isUnassignedPerson(person);
  const sizeClass = SIZE_CLASSES[size];

  if (unassigned) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-500 ${sizeClass} ${className}`}
      >
        <MonoIcon name="user" size={size === "xs" ? 10 : 12} />
      </span>
    );
  }

  const toneClass = hashPersonTone(person.id || person.name || person.initials);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight tabular-nums shadow-theme-xs ${sizeClass} ${toneClass} ${className}`}
    >
      {person.initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function PersonLabel({
  person,
  size = "sm",
}: {
  person: { id?: string; name: string; initials: string };
  size?: "xs" | "sm";
}) {
  const unassigned = isUnassignedPerson(person);
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-xs font-medium ${
        unassigned
          ? "text-gray-400 dark:text-gray-500"
          : "text-gray-700 dark:text-gray-200"
      }`}
    >
      <WorkPersonAvatar person={person} size={size} />
      <span className="truncate">{person.name}</span>
    </span>
  );
}
