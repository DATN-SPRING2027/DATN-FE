export function formatWorklogMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function parseWorklogMinutes(input: string): number {
  const raw = input.trim().toLowerCase();
  if (!raw) return 0;
  const numeric = /^\d+$/.test(raw) ? Number(raw) : null;
  const units = raw.match(/^(?:(\d+(?:\.\d+)?)\s*d\s*)?(?:(\d+(?:\.\d+)?)\s*h\s*)?(?:(\d+)\s*m\s*)?$/);
  const minutes = numeric ?? (units && units[0]
    ? Number(units[1] ?? 0) * 480 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0)
    : 0);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
    ? minutes
    : 0;
}
