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

const VI_NOTIFICATION_TITLES: Record<string, string> = {
  "Organization invitation": "Lời mời tham gia Tổ chức",
  "Added to organization": "Đã được thêm vào Tổ chức",
  "Removed from organization": "Đã bị gỡ khỏi Tổ chức",
  "Added to project": "Đã được thêm vào Dự án",
  "Removed from project": "Đã bị gỡ khỏi Dự án",
  "Assigned as Project Leader": "Được bổ nhiệm làm Trưởng nhóm Dự án",
  "Project Leader updated": "Cập nhật Trưởng nhóm Dự án",
  "Project Leader role revoked": "Đã thu hồi vai trò Trưởng nhóm Dự án",
  "Task assigned": "Được giao công việc",
  "Task deadline approaching": "Công việc sắp đến hạn",
  "Task overdue": "Công việc quá hạn",
  "Mentioned in a work note": "Được nhắc đến trong ghi chú công việc",
  "Mentioned in chat": "Được nhắc đến trong trò chuyện",
  "Task Note awaiting review": "Ghi chú công việc chờ xét duyệt",
  "Task Note approved & queued for SAG":
    "Ghi chú công việc đã duyệt & đồng bộ SAG",
  "Changes requested on Task Note": "Yêu cầu chỉnh sửa ghi chú công việc",
  "Task Note rejected": "Ghi chú công việc bị từ chối",
  "Leader reporting cadence updated":
    "Đã cập nhật chu kỳ báo cáo của Trưởng nhóm",
  "Work report schedule updated": "Đã cập nhật lịch báo cáo công việc",
  "Leader work report submitted for review":
    "Báo cáo của Trưởng nhóm chờ xét duyệt",
  "Member work report submitted for review":
    "Báo cáo công việc của Thành viên chờ xét duyệt",
  "Leader work report approved": "Báo cáo của Trưởng nhóm đã được duyệt",
  "Work report approved": "Báo cáo công việc đã được duyệt",
  "Changes requested on Leader work report":
    "Yêu cầu chỉnh sửa báo cáo của Trưởng nhóm",
  "Changes requested on work report": "Yêu cầu chỉnh sửa báo cáo công việc",
  "Leader work report rejected": "Báo cáo của Trưởng nhóm bị từ chối",
  "Work report rejected": "Báo cáo công việc bị từ chối",
  "Leader work report overdue": "Báo cáo của Trưởng nhóm đã quá hạn",
  "Work report overdue": "Báo cáo công việc đã quá hạn",
  "Leader work report due to Manager":
    "Đến kỳ nộp báo cáo Trưởng nhóm cho Quản lý",
  "Periodic work report due": "Đến kỳ nộp báo cáo công việc định kỳ",
};

function translateReviewOutcomeVi(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "approved") return "đã được phê duyệt";
  if (normalized === "changes requested") return "cần chỉnh sửa bổ sung";
  if (normalized === "rejected") return "đã bị từ chối";
  return raw;
}

function translateActorVi(actor: string): string {
  return actor.trim() === "A team member" ? "Một thành viên" : actor;
}

const VI_NOTIFICATION_MESSAGE_RULES: ReadonlyArray<{
  pattern: RegExp;
  format: (...matches: string[]) => string;
}> = [
  {
    pattern: /^You have been invited to join Organization (.+)$/,
    format: (org) => `Bạn đã được mời tham gia Tổ chức ${org}`,
  },
  {
    pattern: /^You were added to Organization (.+)$/,
    format: (org) => `Bạn đã được thêm vào Tổ chức ${org}`,
  },
  {
    pattern: /^You were removed from Organization (.+)$/,
    format: (org) => `Bạn đã bị gỡ khỏi Tổ chức ${org}`,
  },
  {
    pattern: /^You were added to Project (.+)$/,
    format: (project) => `Bạn đã được thêm vào Dự án ${project}`,
  },
  {
    pattern: /^You were removed from Project (.+)$/,
    format: (project) => `Bạn đã bị gỡ khỏi Dự án ${project}`,
  },
  {
    pattern: /^You were (?:assigned as|appointed) Project Leader of Project (.+)$/,
    format: (project) =>
      `Bạn đã được bổ nhiệm làm Trưởng nhóm của Dự án ${project}`,
  },
  {
    pattern: /^You are no longer Project Leader of Project (.+)$/,
    format: (project) =>
      `Bạn không còn giữ vai trò Trưởng nhóm của Dự án ${project}`,
  },
  {
    pattern: /^Project Leader of Project (.+) was updated$/,
    format: (project) => `Trưởng nhóm của Dự án ${project} đã được cập nhật`,
  },
  {
    pattern: /^You were assigned to Task (.+)$/,
    format: (task) => `Bạn đã được giao công việc ${task}`,
  },
  {
    pattern: /^Task (.+) is approaching its deadline$/,
    format: (task) => `Công việc ${task} sắp đến hạn hoàn thành`,
  },
  {
    pattern: /^Task (.+) is overdue$/,
    format: (task) => `Công việc ${task} đã quá hạn`,
  },
  {
    pattern: /^You were mentioned in Work Note (.+)$/,
    format: (note) => `Bạn đã được nhắc đến trong ghi chú công việc ${note}`,
  },
  {
    pattern: /^You were mentioned in a chat$/,
    format: () => "Bạn đã được nhắc đến trong cuộc trò chuyện",
  },
  {
    pattern: /^(.+) submitted Task Note "(.+)" \(v(\d+)\) for approval\.$/,
    format: (actor, title, ver) =>
      `${translateActorVi(actor)} đã gửi ghi chú công việc "${title}" (v${ver}) chờ xét duyệt.`,
  },
  {
    pattern: /^Reviewer feedback on "(.+)": ([\s\S]+)$/,
    format: (title, comment) => `Phản hồi xét duyệt cho "${title}": ${comment}`,
  },
  {
    pattern: /^Your Task Note "(.+)" was (approved|changes requested|rejected)\.$/i,
    format: (title, outcome) =>
      `Ghi chú công việc "${title}" của bạn ${translateReviewOutcomeVi(outcome)}.`,
  },
  {
    pattern:
      /^Manager updated Leader work report schedule to every (\d+) days?\.$/,
    format: (days) =>
      `Quản lý đã cập nhật lịch báo cáo của Trưởng nhóm thành mỗi ${days} ngày.`,
  },
  {
    pattern: /^Project reporting cadence is now every (\d+) days?\.$/,
    format: (days) =>
      `Chu kỳ báo cáo định kỳ của dự án hiện là mỗi ${days} ngày.`,
  },
  {
    pattern: /^(.+) submitted a Leader work report awaiting Manager review\.$/,
    format: (actor) =>
      `${translateActorVi(actor)} đã nộp báo cáo Trưởng nhóm chờ Quản lý xét duyệt.`,
  },
  {
    pattern: /^(.+) submitted a periodic work report awaiting Leader review\.$/,
    format: (actor) =>
      `${translateActorVi(actor)} đã nộp báo cáo công việc định kỳ chờ Trưởng nhóm xét duyệt.`,
  },
  {
    pattern: /^Reviewer feedback: ([\s\S]+)$/,
    format: (comment) => `Phản hồi xét duyệt: ${comment}`,
  },
  {
    pattern:
      /^Your work report status was updated to (approved|changes requested|rejected)\.$/i,
    format: (outcome) =>
      `Báo cáo công việc của bạn ${translateReviewOutcomeVi(outcome)}.`,
  },
  {
    pattern:
      /^Your periodic work report has passed its due date\. Please complete and submit your report\.$/,
    format: () =>
      "Báo cáo công việc định kỳ của bạn đã quá hạn nộp. Vui lòng hoàn thành và nộp báo cáo.",
  },
  {
    pattern:
      /^Your Leader report \(every (\d+) days?\) is due by (\d{4}-\d{2}-\d{2})\.$/,
    format: (days, due) =>
      `Báo cáo Trưởng nhóm của bạn (chu kỳ ${days} ngày) có hạn nộp vào ${due}.`,
  },
  {
    pattern:
      /^Your periodic work report \(every (\d+) days?\) is due by (\d{4}-\d{2}-\d{2})\.$/,
    format: (days, due) =>
      `Báo cáo công việc định kỳ của bạn (chu kỳ ${days} ngày) có hạn nộp vào ${due}.`,
  },
];

export function localizeNotificationCopy(
  item: Pick<NotificationItem, "type" | "title" | "message">,
  locale: string,
): { title: string; message: string } {
  if (locale !== "vi") {
    return { title: item.title, message: item.message };
  }

  const localizedTitle = VI_NOTIFICATION_TITLES[item.title.trim()] ?? item.title;
  let localizedMessage = item.message;

  for (const rule of VI_NOTIFICATION_MESSAGE_RULES) {
    const match = item.message.match(rule.pattern);
    if (match) {
      localizedMessage = rule.format(...match.slice(1));
      break;
    }
  }

  return {
    title: localizedTitle,
    message: localizedMessage,
  };
}
