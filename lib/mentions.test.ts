import { describe, expect, test } from "vitest";
import {
  decodeMentions,
  encodeMentions,
  findMentionTrigger,
  splitBody,
  suggestMembers,
} from "./mentions";

const ALICE = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const BOB = "b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d7";

describe("mention tokens", () => {
  test("encode turns @Name into a token, longest name first, on word boundaries", () => {
    const names = new Map([
      ["Al", "short"],
      ["Alice Liddell", ALICE],
    ]);
    expect(encodeMentions("hi @Alice Liddell and @Al", names)).toBe(`hi <@${ALICE}> and <@short>`);
    expect(encodeMentions("mail@Al.example", names)).toBe("mail@Al.example");
    expect(encodeMentions("@Alice Liddellson", names)).toBe("@Alice Liddellson");
  });

  test("encode leaves text alone when nothing was picked", () => {
    expect(encodeMentions("hi @someone", new Map())).toBe("hi @someone");
  });

  test("names with regex characters are matched literally", () => {
    const names = new Map([["A.B (dev)", ALICE]]);
    expect(encodeMentions("ping @A.B (dev)!", names)).toBe(`ping <@${ALICE}>!`);
  });

  test("decode restores @Name for known ids and keeps unknown tokens", () => {
    const users = [{ id: ALICE, name: "Alice" }];
    expect(decodeMentions(`<@${ALICE}> and <@${BOB}>`, users)).toBe(`@Alice and <@${BOB}>`);
  });

  test("splitBody separates text from mention tokens, in order", () => {
    expect(splitBody(`hey <@${ALICE}>, meet <@${BOB}>`)).toEqual([
      { type: "text", text: "hey " },
      { type: "mention", id: ALICE },
      { type: "text", text: ", meet " },
      { type: "mention", id: BOB },
    ]);
    expect(splitBody("no mentions")).toEqual([{ type: "text", text: "no mentions" }]);
    expect(splitBody("")).toEqual([]);
  });
});

describe("findMentionTrigger", () => {
  test("finds the @query before the caret", () => {
    expect(findMentionTrigger("hello @al", 9)).toEqual({ start: 6, query: "al" });
    expect(findMentionTrigger("@", 1)).toEqual({ start: 0, query: "" });
  });

  test("only triggers at the start of a word", () => {
    expect(findMentionTrigger("mail@al", 7)).toBeNull();
    expect(findMentionTrigger("a\n@al", 5)).toEqual({ start: 2, query: "al" });
  });

  test("ignores a query that spans a line break or runs too long", () => {
    expect(findMentionTrigger("@al\nice", 7)).toBeNull();
    expect(findMentionTrigger(`@${"x".repeat(31)}`, 32)).toBeNull();
  });

  test("uses only the text before the caret", () => {
    expect(findMentionTrigger("@alice bob", 3)).toEqual({ start: 0, query: "al" });
    expect(findMentionTrigger("hello", 5)).toBeNull();
  });
});

describe("suggestMembers", () => {
  const members = [
    { userId: "1", name: "Bianca" },
    { userId: "2", name: "Abigail" },
    { userId: "3", name: "Ana" },
    { userId: "4", name: "Cabral" },
  ];

  test("prefix matches come first, then the rest alphabetically", () => {
    expect(suggestMembers(members, "a").map((m) => m.name)).toEqual([
      "Abigail",
      "Ana",
      "Bianca",
      "Cabral",
    ]);
    expect(suggestMembers(members, "ab").map((m) => m.name)).toEqual(["Abigail", "Cabral"]);
  });

  test("is case-insensitive, and an empty query lists people", () => {
    expect(suggestMembers(members, "ANA").map((m) => m.name)).toEqual(["Ana"]);
    expect(suggestMembers(members, "")).toHaveLength(4);
  });

  test("caps the list at six", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ userId: String(i), name: `Person ${i}` }));
    expect(suggestMembers(many, "person")).toHaveLength(6);
  });

  test("does not reorder the caller's array", () => {
    const input = [...members];
    suggestMembers(input, "a");
    expect(input).toEqual(members);
  });
});
