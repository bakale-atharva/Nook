import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOrgWith } from "./lib/auth";
import { assertChannelMember, requireMessageInOrg } from "./lib/channelAccess";
import {
  MAX_DISTINCT_EMOJI,
  MAX_EMOJI_LENGTH,
  MAX_REACTIONS_READ,
  PERMISSIONS,
} from "./lib/constants";
import { invalidArgument } from "./lib/errors";

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
    const org = await requireOrgWith(ctx, PERMISSIONS.MESSAGES_SEND);

    const emoji = args.emoji.trim();
    if (!emoji || emoji.length > MAX_EMOJI_LENGTH || !EMOJI.test(emoji)) {
      throw invalidArgument("That isn't an emoji.");
    }

    const message = await requireMessageInOrg(ctx, org, args.messageId);
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
      throw invalidArgument("This message has too many different reactions.");
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
