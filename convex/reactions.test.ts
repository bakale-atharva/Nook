import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { errorCode, firstPage, setup } from "../tests/support/convex";

afterEach(() => {
  vi.useRealTimers();
});

describe("reactions and hearts", () => {
  test("toggling adds then removes, and counts per person", async () => {
    const { asAlice, asBob, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });

    await asAlice.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "🎉" });

    const seenByAlice = (await firstPage(asAlice, general)).page[0].reactions;
    expect(seenByAlice).toEqual([
      { emoji: "❤️", count: 2, reactedByMe: true },
      { emoji: "🎉", count: 1, reactedByMe: false },
    ]);

    await asAlice.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    const after = (await firstPage(asAlice, general)).page[0].reactions;
    expect(after[0]).toEqual({ emoji: "❤️", count: 1, reactedByMe: false });
  });

  test("only real emoji are accepted", async () => {
    const { asAlice, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });
    for (const emoji of ["", "hello", "a".repeat(40), "1"]) {
      expect(await errorCode(asAlice.mutation(api.reactions.toggle, { messageId: message, emoji }))).toBe(
        "INVALID_ARGUMENT",
      );
    }
  });

  test("deleting a message deletes its reactions", async () => {
    vi.useFakeTimers();
    const { t, asAlice, asBob, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "👍" });
    await asAlice.mutation(api.messages.remove, { messageId: message });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("reactions").collect())).toEqual([]);
  });
});
