import { afterEach, describe, expect, test, vi } from "vitest";
import { formatDayLabel, formatTime, isoTime, sameDay } from "./time";

afterEach(() => {
  vi.useRealTimers();
});

describe("time helpers", () => {
  test("sameDay compares calendar days in local time", () => {
    const morning = new Date(2026, 5, 1, 8).getTime();
    const night = new Date(2026, 5, 1, 23, 59).getTime();
    const nextDay = new Date(2026, 5, 2, 0, 1).getTime();
    expect(sameDay(morning, night)).toBe(true);
    expect(sameDay(night, nextDay)).toBe(false);
  });

  test("formatDayLabel says Today, else the date, adding the year only for other years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    expect(formatDayLabel(new Date(2026, 5, 15, 1).getTime())).toBe("Today");
    const sameYear = formatDayLabel(new Date(2026, 0, 3).getTime());
    expect(sameYear).toContain("3");
    expect(sameYear).not.toContain("2026");
    expect(formatDayLabel(new Date(2025, 0, 3).getTime())).toContain("2025");
  });

  test("formatTime shows the hour and minutes", () => {
    expect(formatTime(new Date(2026, 5, 1, 9, 5).getTime())).toMatch(/9.*05/);
  });

  test("isoTime is an ISO-8601 string for the same instant", () => {
    const ms = Date.UTC(2026, 5, 1, 9, 5, 7);
    expect(isoTime(ms)).toBe("2026-06-01T09:05:07.000Z");
  });
});
