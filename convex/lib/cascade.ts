import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MESSAGE_CASCADE_BATCH, ROW_DELETE_BATCH } from "./constants";
import { deleteMessageCascade } from "./messageCleanup";

/**
 * Deletes one bounded batch of everything under a channel (messages,
 * channelMembers, typing rows), and the channel itself once nothing is left.
 * Returns true when more rows may remain, so the caller should run it again
 * on the scheduler; a busy channel can't blow a single mutation's limits.
 */
export async function deleteChannelBatch(
  ctx: MutationCtx,
  channelId: Id<"channels">,
): Promise<boolean> {
  // Messages go in smaller batches than the other tables: each one can
  // carry reactions and uploaded files that are deleted with it.
  const [messages, members, typingRows] = await Promise.all([
    ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .take(MESSAGE_CASCADE_BATCH),
    ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => q.eq("channelId", channelId))
      .take(ROW_DELETE_BATCH),
    ctx.db
      .query("typing")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .take(ROW_DELETE_BATCH),
  ]);
  for (const message of messages) {
    // Thread replies are messages of this channel too, so they are picked
    // up by later batches; no separate reply purge is needed.
    await deleteMessageCascade(ctx, message, { skipReplyPurge: true });
  }
  for (const row of [...members, ...typingRows]) {
    await ctx.db.delete(row._id);
  }
  if (
    messages.length === MESSAGE_CASCADE_BATCH ||
    members.length === ROW_DELETE_BATCH ||
    typingRows.length === ROW_DELETE_BATCH
  ) {
    return true; // More rows may remain; keep going next tick.
  }
  const channel = await ctx.db.get(channelId);
  if (channel) await ctx.db.delete(channelId);
  return false;
}
