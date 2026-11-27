import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  AlertIcon,
  ArrowUpRightIcon,
  BarChartIcon,
  BoltIcon,
  BookmarkIcon,
  BugIcon,
  CalenderIcon,
  ChatIcon,
  CheckLineIcon,
  CopyIcon,
  EyeIcon,
  FileIcon,
  FlagIcon,
  FolderIcon,
  LinkChainIcon,
  LockIcon,
  MaximizeIcon,
  PencilIcon,
  PinIcon,
  RefreshIcon,
  SettingsIcon,
  SlidersIcon,
  SparkleIcon,
  SubtaskIcon,
  TagIcon,
  TaskCheckIcon,
  TimeIcon,
  TrashBinIcon,
  UserIcon,
  UsersOutlineIcon,
} from "@/icons";
import type { WorkIntakeFormType, WorkItemType } from "./work-types";

export type MonoIconName =
  | "sparkle"
  | "sliders"
  | "chart"
  | "calendar"
  | "user"
  | "users"
  | "link"
  | "copy"
  | "flag"
  | "clock"
  | "trash"
  | "eye"
  | "maximize"
  | "pin"
  | "lock"
  | "document"
  | "bolt"
  | "check"
  | "sync"
  | "comment"
  | "tag"
  | "folder"
  | "edit"
  | "alert"
  | "settings"
  | "arrowUpRight";

const MONO_ICON_MAP: Record<
  MonoIconName,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  sparkle: SparkleIcon,
  sliders: SlidersIcon,
  chart: BarChartIcon,
  calendar: CalenderIcon,
  user: UserIcon,
  users: UsersOutlineIcon,
  link: LinkChainIcon,
  copy: CopyIcon,
  flag: FlagIcon,
  clock: TimeIcon,
  trash: TrashBinIcon,
  eye: EyeIcon,
  maximize: MaximizeIcon,
  pin: PinIcon,
  lock: LockIcon,
  document: FileIcon,
  bolt: BoltIcon,
  check: CheckLineIcon,
  sync: RefreshIcon,
  comment: ChatIcon,
  tag: TagIcon,
  folder: FolderIcon,
  edit: PencilIcon,
  alert: AlertIcon,
  settings: SettingsIcon,
  arrowUpRight: ArrowUpRightIcon,
};

export function MonoIssueTypeIcon({
  type,
  size,
  className = "h-3.5 w-3.5",
}: {
  type: WorkItemType | WorkIntakeFormType | "SUBTASK" | "EPIC";
  size?: number;
  className?: string;
}): ReactNode {
  const normalized = type.toUpperCase();
  const dimensions = size ? { width: size, height: size } : undefined;
  if (normalized === "BUG") {
    return <BugIcon {...dimensions} className={className} aria-hidden="true" />;
  }
  if (normalized === "STORY") {
    return (
      <BookmarkIcon {...dimensions} className={className} aria-hidden="true" />
    );
  }
  if (normalized === "EPIC") {
    return (
      <BoltIcon {...dimensions} className={className} aria-hidden="true" />
    );
  }
  if (normalized === "SUBTASK") {
    return (
      <SubtaskIcon {...dimensions} className={className} aria-hidden="true" />
    );
  }
  return (
    <TaskCheckIcon {...dimensions} className={className} aria-hidden="true" />
  );
}

export function MonoIcon({
  name,
  size,
  className = "h-3.5 w-3.5 shrink-0",
}: {
  name: MonoIconName;
  size?: number;
  className?: string;
}): ReactNode {
  const dimensions = size ? { width: size, height: size } : undefined;
  const Icon = MONO_ICON_MAP[name];
  return <Icon {...dimensions} className={className} aria-hidden="true" />;
}
