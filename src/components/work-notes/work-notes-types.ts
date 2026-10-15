export type WorkNotesRole = "MEMBER" | "LEADER" | "ADMIN";
export type WorkNotesTab = "ACTIVITY" | "REPORTS" | "KNOWLEDGE" | "CONFIG";
export type WorkNotesIdentity = Readonly<{
  id: string;
  name: string;
  initials: string;
}>;

export function getWorkNotesInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "").join("") || "U";
}

export function resolveWorkNotesRole(
  organizationRoles: readonly string[],
): WorkNotesRole | undefined {
  if (organizationRoles.includes("ADMIN")) return "ADMIN";
  if (organizationRoles.includes("TEAM_LEADER")) return "LEADER";
  if (organizationRoles.includes("MEMBER")) return "MEMBER";
  return undefined;
}

export type WorkNoteKind =
  | "WORK_UPDATE"
  | "WEEKLY_SUMMARY"
  | "KNOWLEDGE"
  | "DECISION";
export type KnowledgeStatus = "PENDING" | "PUBLISHED" | "CHANGES_REQUESTED";
export type ReportStatus = "SUBMITTED" | "MISSING";
export type NotesWeek = "THIS_WEEK" | "LAST_WEEK" | "ALL";

export type WorkNote = Readonly<{
  id: string;
  author: string;
  initials: string;
  createdAt: string;
  kind: WorkNoteKind;
  title: string;
  body: string;
  taskKey?: string;
  nextStep?: string;
  blocker?: string;
  unfinished?: string;
  tags?: readonly string[];
  knowledgeStatus?: KnowledgeStatus;
  week: Exclude<NotesWeek, "ALL">;
  viewed: boolean;
}>;

export type WeeklyReport = Readonly<{
  id: string;
  member: string;
  initials: string;
  status: ReportStatus;
  completed: string;
  blockers: string;
  nextWeek: string;
  updatedAt: string;
  reviewed: boolean;
  week: Exclude<NotesWeek, "ALL">;
}>;

export type CreateWorkNoteInput = Omit<WorkNote, "id" | "createdAt" | "week" | "viewed">;
