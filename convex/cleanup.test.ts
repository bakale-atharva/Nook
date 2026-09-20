import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { ORG, errorData, setup } from "../tests/support/convex";

afterEach(() => {
  vi.useRealTimers();
});

describe("cleanup batching", () => {
  test("a message with more than one batch of reactions loses them all", async () => {
    vi.useFakeTimers();
    const { t, asAlice, alice, general } = await setup();
    const messageId = await asAlice.mutation(api.messages.send, { channelId: general, body: "hot take" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 230; i++) {
        await ctx.db.insert("reactions", {
          messageId,
          channelId: general,
          orgId: ORG,
          userId: alice,
          emoji: `e${i}`,
        });
      }
    });
    await asAlice.mutation(api.messages.remove, { messageId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("reactions").collect())).toEqual([]);
  });

  test("a thread root with more than one batch of replies loses them all", async () => {
    vi.useFakeTimers();
    const { t, asAlice, alice, general } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) {
        await ctx.db.insert("messages", {
          channelId: general,
          orgId: ORG,
          authorId: alice,
          body: `reply ${i}`,
          threadRootId: root,
        });
      }
      await ctx.db.patch(root, { replyCount: 30 });
    });
    await asAlice.mutation(api.messages.remove, { messageId: root });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
  });
});

describe("reactions", () => {
  test("a message can carry at most 20 different emoji", async () => {
    const { t, asAlice, alice, general } = await setup();
    const messageId = await asAlice.mutation(api.messages.send, { channelId: general, body: "x" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 20; i++) {
        await ctx.db.insert("reactions", {
          messageId,
          channelId: general,
          orgId: ORG,
          userId: alice,
          emoji: `e${i}`,
        });
      }
    });
    expect(await errorData(asAlice.mutation(api.reactions.toggle, { messageId, emoji: "🎉" }))).toEqual({
      code: "INVALID_ARGUMENT",
      message: "This message has too many different reactions.",
    });
    // An emoji already on the message can still be toggled.
    await t.run((ctx) => ctx.db.insert("reactions", { messageId, channelId: general, orgId: ORG, userId: alice, emoji: "🎉" }));
    await asAlice.mutation(api.reactions.toggle, { messageId, emoji: "🎉" });
  });
});

describe("small functions", () => {
  test("generateUploadUrl needs send permission and a synced user", async () => {
    const { asAlice, t } = await setup();
    expect(await asAlice.mutation(api.files.generateUploadUrl, {})).toEqual(expect.any(String));
    const stranger = t.withIdentity({ subject: "user_stranger" });
    expect(await errorData(stranger.mutation(api.files.generateUploadUrl, {}))).toEqual({
      code: "NO_ACTIVE_ORG",
    });
  });

  test("organizations.current returns the mirrored org row, or null", async () => {
    const { t, asAlice } = await setup();
    expect(await asAlice.query(api.organizations.current, {})).toBeNull();
    await t.run((ctx) =>
      ctx.db.insert("organizations", { clerkOrgId: ORG, name: "Nook", slug: "nook", plan: "pro", updatedAt: 1 }),
    );
    expect(await asAlice.query(api.organizations.current, {})).toMatchObject({ slug: "nook", plan: "pro" });
  });
});
