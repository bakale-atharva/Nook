import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { setup } from "../tests/support/convex";

const typingRows = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run((ctx) => ctx.db.query("typing").collect());

describe("typing indicators", () => {
  test("heartbeat upserts one row per person; clear removes it", async () => {
    const { t, asAlice, alice, general } = await setup();
    await asAlice.mutation(api.typing.heartbeat, { channelId: general });
    await asAlice.mutation(api.typing.heartbeat, { channelId: general });
    expect(await typingRows(t)).toMatchObject([{ channelId: general, userId: alice }]);

    await asAlice.mutation(api.typing.clear, { channelId: general });
    expect(await typingRows(t)).toEqual([]);
    await asAlice.mutation(api.typing.clear, { channelId: general }); // no-op
  });

  test("list shows other people who haven't expired, never yourself", async () => {
    const { asAlice, asBob, general, bob } = await setup();
    await asAlice.mutation(api.typing.heartbeat, { channelId: general });
    await asBob.mutation(api.typing.heartbeat, { channelId: general });

    const now = Date.now();
    expect(await asAlice.query(api.typing.list, { channelId: general, now })).toEqual([
      { userId: bob, name: "bob" },
    ]);
    // A moment past the TTL nobody is still typing.
    expect(await asAlice.query(api.typing.list, { channelId: general, now: now + 60_000 })).toEqual([]);
  });

  test("heartbeat sweeps a few expired rows for the channel", async () => {
    const { t, asAlice, bob, carol, general } = await setup();
    await t.run(async (ctx) => {
      for (const userId of [bob, carol]) {
        await ctx.db.insert("typing", { channelId: general, userId, expiresAt: 1 });
      }
    });
    await asAlice.mutation(api.typing.heartbeat, { channelId: general });
    const rows = await typingRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt).toBeGreaterThan(1);
  });

  test("you can only type in a channel you can see", async () => {
    const { asDave, general } = await setup();
    await expect(asDave.mutation(api.typing.heartbeat, { channelId: general })).rejects.toThrow();
  });
});
