import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { REPLY_DELETE_BATCH } from "./lib/constants";
import { deleteMessageCascade, deleteReactionsBatch } from "./lib/messageCleanup";

/** Deletes the reactions left over when a message had more than one batch. */
export const purgeReactions = internalMutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (await deleteReactionsBatch(ctx, args.messageId)) {
      await ctx.scheduler.runAfter(0, internal.cleanup.purgeReactions, args);
    }
    return null;
  },
});

/** Deletes a removed thread root's replies, one bounded batch at a time. */
export const purgeThreadReplies = internalMutation({
  args: { rootId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadRootId", args.rootId))
      .take(REPLY_DELETE_BATCH);
    for (const reply of replies) {
      await deleteMessageCascade(ctx, reply);
    }
    if (replies.length === REPLY_DELETE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.cleanup.purgeThreadReplies, args);
    }
    return null;
  },
});
