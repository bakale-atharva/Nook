import { describe, expect, test } from "vitest";
import { GROUP_WINDOW_MS, startsGroup } from "./messages";

const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m).getTime();
const msg = (authorId: string, time: number) => ({ authorId, _creationTime: time });

describe("startsGroup", () => {
  test("the first message always starts a group", () => {
    expect(startsGroup(undefined, msg("a", at(9)))).toBe(true);
  });

  test("the same author within the window continues the group", () => {
    expect(startsGroup(msg("a", at(9)), msg("a", at(9) + GROUP_WINDOW_MS))).toBe(false);
  });

  test("a different author, or a pause past the window, starts a new group", () => {
    expect(startsGroup(msg("a", at(9)), msg("b", at(9) + 1000))).toBe(true);
    expect(startsGroup(msg("a", at(9)), msg("a", at(9) + GROUP_WINDOW_MS + 1))).toBe(true);
  });

  test("a new calendar day only breaks the group when asked to", () => {
    const late = msg("a", new Date(2026, 0, 15, 23, 59, 30).getTime());
    const next = msg("a", new Date(2026, 0, 16, 0, 0, 10).getTime());
    expect(startsGroup(late, next)).toBe(false);
    expect(startsGroup(late, next, { breakOnDay: true })).toBe(true);
  });
});
