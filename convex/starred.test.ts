import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { errorCode, setup } from "../tests/support/convex";

describe("starred channels", () => {
  test("starring is per person and shows in the list", async () => {
    const { asAlice, asBob, general } = await setup();
    await asAlice.mutation(api.channels.setStarred, { channelId: general, starred: true });
    const star = async (client: typeof asAlice) =>
      (await client.query(api.channels.list, {})).find((c) => c._id === general)?.starred;
    expect(await star(asAlice)).toBe(true);
    expect(await star(asBob)).toBe(false);

    await asAlice.mutation(api.channels.setStarred, { channelId: general, starred: false });
    expect(await star(asAlice)).toBe(false);
  });

  test("you must be a member to star", async () => {
    const { t, asBob, general, bob } = await setup();
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", general).eq("userId", bob))
        .unique();
      if (row) await ctx.db.delete(row._id);
    });
    expect(await errorCode(asBob.mutation(api.channels.setStarred, { channelId: general, starred: true }))).toBe(
      "FORBIDDEN",
    );
  });
});
