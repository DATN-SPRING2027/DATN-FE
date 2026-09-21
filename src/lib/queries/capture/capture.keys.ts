export const captureKeys = {
  all: ["capture"] as const,
  workNotes: () => [...captureKeys.all, "work-notes"] as const,
  daily: (date: string) => [...captureKeys.workNotes(), "daily", date] as const,
  drafts: () => [...captureKeys.all, "drafts"] as const,
};
