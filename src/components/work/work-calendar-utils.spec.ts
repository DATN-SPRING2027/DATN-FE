import { describe, expect, it } from "vitest";
import {
  getCalendarDays,
  getCalendarMonthStart,
  isCalendarToday,
  toCalendarDateKey,
} from "./work-calendar-utils";

describe("work calendar date helpers", () => {
  it("starts the calendar on the first day of the requested month", () => {
    expect(getCalendarMonthStart(new Date(2026, 9, 15))).toEqual(
      new Date(2026, 9, 1),
    );
  });

  it("builds a Monday-first grid with complete weeks", () => {
    const days = getCalendarDays(new Date(2026, 9, 1));

    expect(days[0]).toEqual(new Date(2026, 8, 28));
    expect(days[0].getDay()).toBe(1);
    expect(days.length % 7).toBe(0);
    expect(days.at(-1)?.getDay()).toBe(0);
  });

  it("compares calendar dates without considering the time", () => {
    expect(isCalendarToday(new Date(2026, 9, 15, 0), new Date(2026, 9, 15, 23))).toBe(true);
    expect(isCalendarToday(new Date(2026, 9, 14), new Date(2026, 9, 15))).toBe(false);
    expect(toCalendarDateKey(new Date(2026, 9, 15))).toBe("2026-10-15");
  });
});
