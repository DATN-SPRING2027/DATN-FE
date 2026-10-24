import type {
  NotificationItem,
  NotificationTargetKind,
} from "@/lib/queries/notifications/useNotifications";

export function resolveNotificationCategory(
  item: NotificationItem,
): NotificationTargetKind {
  if (item.target?.kind) return item.target.kind;
  const type = item.type.toUpperCase();
  if (type.startsWith("ORGANIZATION_")) return "ORGANIZATION";
  if (type.startsWith("PROJECT_")) return "PROJECT";
  if (type.startsWith("TASK_")) return "TASK";
  if (type.startsWith("WORK_NOTE_")) return "WORK_NOTE";
  if (type.startsWith("CHAT_")) return "CHAT";
  return "ORGANIZATION";
}

export function formatRelativeNotificationTime(
  isoDate: string,
  t: {
    (key: "justNow"): string;
    (key: "minAgo" | "hrAgo" | "daysAgo", values: { count: number }): string;
  },
): string {
  const createdTime = Date.parse(isoDate);
  if (Number.isNaN(createdTime)) return "";
  const diffMs = Math.max(0, Date.now() - createdTime);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return t("justNow");
  if (diffMinutes < 60) return t("minAgo", { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t("hrAgo", { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t("daysAgo", { count: diffDays });
}

export function resolveDefaultTargetUrl(item: NotificationItem): string {
  if (item.target?.url) return item.target.url;
  const category = resolveNotificationCategory(item);
  if (category === "TASK" && item.projectId && item.taskId) {
    return `/projects/${item.projectId}/work?taskId=${encodeURIComponent(item.taskId)}`;
  }
  if (category === "WORK_NOTE" && item.projectId && item.noteId) {
    return `/projects/${item.projectId}/work-notes?noteId=${encodeURIComponent(item.noteId)}`;
  }
  if (category === "PROJECT" && item.projectId) {
    return `/projects/${item.projectId}`;
  }
  if (category === "CHAT" && item.conversationId) {
    return `/chat?conversation=${encodeURIComponent(item.conversationId)}`;
  }
  if (
    item.type === "ORGANIZATION_MEMBER_INVITED" ||
    item.type === "ORGANIZATION_MEMBER_REMOVED"
  ) {
    return "/select-organization";
  }
  return "/organization/members";
}
