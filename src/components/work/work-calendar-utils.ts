export function toCalendarDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isCalendarToday(date: Date, today: Date = new Date()): boolean {
  return toCalendarDateKey(date) === toCalendarDateKey(today);
}

export function getCalendarDays(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - mondayOffset);

  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const lastOffset = (lastOfMonth.getDay() + 6) % 7;
  const dayCount = mondayOffset + lastOfMonth.getDate() + (6 - lastOffset);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function formatCalendarDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options }).format(date);
}
