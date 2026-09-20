import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCaller } from "./lib/auth";
import { assertCanViewChannel } from "./lib/channelAccess";
import { MAX_TYPING_LISTED, TYPING_SWEEP_BATCH, TYPING_TTL_MS } from "./lib/constants";

/**
 * Upserts the caller's "typing" row for a channel, expiring TYPING_TTL_MS
 * from now. The client re-calls this every few seconds while the composer
 * has text; convex/typing.ts:list drops rows past their expiry, so a
 * closed tab or dropped connection self-heals without a cron job.
 */
export const heartbeat = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, user } = await requireCaller(ctx);
    await assertCanViewChannel(ctx, org, args.channelId);

    const existing = await ctx.db
      .query("typing")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    const expiresAt = Date.now() + TYPING_TTL_MS;
    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      await ctx.db.insert("typing", { channelId: args.channelId, userId: user._id, expiresAt });
    }

    // Opportunistic cleanup — bounded, so this stays cheap even if a lot
    // of stale rows built up.
    const stale = await ctx.db
      .query("typing")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .take(TYPING_SWEEP_BATCH);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

/** Clears the caller's typing state immediately (message sent, input cleared). */
export const clear = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireCaller(ctx);
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/**
 * Other users currently typing in the channel. `now` is passed by the
 * client (refreshed every few seconds) rather than read from the wall
 * clock here, so the query stays cache-friendly and expires reactively as
 * the client bumps it — see convex/_generated/ai/guidelines.md.
 */
export const list = query({
  args: { channelId: v.id("channels"), now: v.number() },
  returns: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  handler: async (ctx, args) => {
    const { org, user } = await requireCaller(ctx);
    await assertCanViewChannel(ctx, org, args.channelId);
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.gt(q.field("expiresAt"), args.now))
      .take(MAX_TYPING_LISTED);
    const others = rows.filter((r) => r.userId !== user._id);
    return await Promise.all(
      others.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return { userId: r.userId, name: u?.name ?? "Someone" };
      }),
    );
  },
});
