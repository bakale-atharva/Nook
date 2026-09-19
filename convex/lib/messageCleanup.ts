import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export const REACTION_DELETE_BATCH = 200;

/**
 * Deletes a message together with everything that hangs off it: its
 * reactions, its uploaded files, and (for a thread root) its replies.
 *
 * Reactions and replies are unbounded in principle, so anything past one
 * bounded batch is handed to the scheduler (see convex/cleanup.ts) instead
 * of risking a single oversized mutation.
 *
 * Callers that already delete every message in a channel (channel cascade)
 * pass `skipReplyPurge` because the replies are in their own batches.
 */
export async function deleteMessageCascade(
  ctx: MutationCtx,
  message: Doc<"messages">,
  opts: { skipReplyPurge?: boolean } = {},
): Promise<void> {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_message", (q) => q.eq("messageId", message._id))
    .take(REACTION_DELETE_BATCH);
  for (const reaction of reactions) {
    await ctx.db.delete(reaction._id);
  }
  if (reactions.length === REACTION_DELETE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.cleanup.purgeReactions, {
      messageId: message._id,
    });
  }

  for (const attachment of message.attachments ?? []) {
    try {
      await ctx.storage.delete(attachment.storageId);
    } catch {
      // Already gone; nothing to clean up.
    }
  }

  const isThreadRoot = message.threadRootId === undefined;
  if (isThreadRoot && (message.replyCount ?? 0) > 0 && !opts.skipReplyPurge) {
    await ctx.scheduler.runAfter(0, internal.cleanup.purgeThreadReplies, {
      rootId: message._id,
    });
  }

  await ctx.db.delete(message._id);
}
