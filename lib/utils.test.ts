import { describe, expect, test } from "vitest";
import { initials, pluralize } from "./utils";

describe("initials", () => {
  test("takes up to two capitalised initials", () => {
    expect(initials("ada lovelace")).toBe("AL");
    expect(initials("Grace Brewster Murray Hopper")).toBe("GB");
    expect(initials("Plato")).toBe("P");
  });

  test("ignores extra spaces and handles an empty name", () => {
    expect(initials("  ada   lovelace ")).toBe("AL");
    expect(initials("")).toBe("");
  });

  test("keeps a leading emoji whole instead of splitting its surrogate pair", () => {
    expect(initials("😀 Smiley")).toBe("😀S");
  });
});

describe("pluralize", () => {
  test("uses the singular only for exactly one", () => {
    expect(pluralize(1, "reply", "replies")).toBe("reply");
    expect(pluralize(0, "reply", "replies")).toBe("replies");
    expect(pluralize(2, "reply", "replies")).toBe("replies");
  });

  test("defaults the plural to adding an s", () => {
    expect(pluralize(3, "reaction")).toBe("reactions");
  });
});
