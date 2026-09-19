import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { convexErrorMessage } from "./convex-errors";

describe("convexErrorMessage", () => {
  test("uses the fallback for anything that isn't a ConvexError", () => {
    expect(convexErrorMessage(new Error("boom"), "Nope.")).toBe("Nope.");
    expect(convexErrorMessage("boom")).toBe("Something went wrong.");
  });

  test("survives payloads that aren't objects", () => {
    expect(convexErrorMessage(new ConvexError(null), "Nope.")).toBe("Nope.");
    expect(convexErrorMessage(new ConvexError("just text"), "Nope.")).toBe("Nope.");
  });

  test("explains plan limits, naming the channel cap", () => {
    expect(
      convexErrorMessage(new ConvexError({ code: "PLAN_LIMIT", limit: "channels", max: 5 })),
    ).toMatch(/limited to 5 channels/);
    expect(convexErrorMessage(new ConvexError({ code: "PLAN_LIMIT", limit: "channels" }))).toMatch(
      /limited to 5 channels/,
    );
    expect(
      convexErrorMessage(new ConvexError({ code: "PLAN_LIMIT", limit: "direct_messages" })),
    ).toMatch(/Direct messages are a Pro feature/);
    expect(convexErrorMessage(new ConvexError({ code: "PLAN_LIMIT" }))).toMatch(/plan limit/);
  });

  test("prefers the server's message where it has one", () => {
    expect(
      convexErrorMessage(new ConvexError({ code: "INVALID_ARGUMENT", message: "Too long." })),
    ).toBe("Too long.");
    expect(
      convexErrorMessage(new ConvexError({ code: "DUPLICATE_NAME", message: "Taken!" })),
    ).toBe("Taken!");
    expect(convexErrorMessage(new ConvexError({ code: "NOT_FOUND" }))).toBe("Not found.");
    expect(convexErrorMessage(new ConvexError({ code: "FORBIDDEN" }))).toMatch(/permission/);
  });
});
