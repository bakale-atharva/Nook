import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOrgIdentity, requirePermission, assertSameOrg } from "./lib/auth";
import { assertChannelMember } from "./lib/channelAccess";

const MAX_EMOJI_LENGTH = 16;
const MAX_DISTINCT_EMOJI = 20;
const MAX_REACTIONS_READ = 200;

// A reaction must actually be an emoji, so this can't be used to stash
// arbitrary text on a message.
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Adds the caller's reaction to a message, or removes it if they already
 * reacted with that emoji. A "heart" is just the ❤️ emoji.
 */
export const toggle = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:messages:send");

    const emoji = args.emoji.trim();
    if (!emoji || emoji.length > MAX_EMOJI_LENGTH || !EMOJI.test(emoji)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "That isn't an emoji.",
      });
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, message.orgId);
    const { user } = await assertChannelMember(ctx, org, message.channelId);

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_user_emoji", (q) =>
        q
          .eq("messageId", message._id)
          .eq("userId", user._id)
          .eq("emoji", emoji),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return null;
    }

    const current = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .take(MAX_REACTIONS_READ);
    const distinct = new Set(current.map((r) => r.emoji));
    if (!distinct.has(emoji) && distinct.size >= MAX_DISTINCT_EMOJI) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "This message has too many different reactions.",
      });
    }

    await ctx.db.insert("reactions", {
      messageId: message._id,
      channelId: message.channelId,
      orgId: message.orgId,
      userId: user._id,
      emoji,
    });
    return null;
  },
});
