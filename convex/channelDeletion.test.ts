import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { setup, storeFile } from "../tests/support/convex";

afterEach(() => {
  vi.useRealTimers();
});

describe("channel deletion", () => {
  test("cascades to messages, replies, reactions and files", async () => {
    vi.useFakeTimers();
    const { t, asAlice, asBob, asCarolAdmin, general } = await setup();
    const storageId = await storeFile(t, "image/png", 10);
    const root = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "pic",
      attachments: [{ storageId, name: "a.png" }],
    });
    await asBob.mutation(api.messages.send, { channelId: general, body: "r", threadRootId: root });
    await asBob.mutation(api.reactions.toggle, { messageId: root, emoji: "👍" });

    await asCarolAdmin.mutation(api.channels.remove, { channelId: general });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.run(async (ctx) => {
      expect(await ctx.db.get(general)).toBeNull();
      const leftovers = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", general))
        .collect();
      expect(leftovers).toEqual([]);
      expect(await ctx.db.query("reactions").collect()).toEqual([]);
      expect(await ctx.storage.get(storageId)).toBeNull();
    });
  });
});
