import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { MAX_REACTIONS_READ } from "./constants";
import { displayImage, displayName, userSummaryValidator } from "./users";
import { attachmentOutputValidator } from "./validators";

/** A message as the client renders it: author, reactions, files and mentions resolved. */
export const messageItemValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  channelId: v.id("channels"),
  authorId: v.id("users"),
  authorName: v.string(),
  authorImageUrl: v.optional(v.string()),
  authorDeleted: v.boolean(),
  body: v.string(),
  editedAt: v.optional(v.number()),
  threadRootId: v.optional(v.id("messages")),
  replyCount: v.number(),
  lastReplyAt: v.optional(v.number()),
  replyParticipants: v.array(userSummaryValidator),
  reactions: v.array(
    v.object({
      emoji: v.string(),
      count: v.number(),
      reactedByMe: v.boolean(),
    }),
  ),
  attachments: v.array(attachmentOutputValidator),
  mentionedUsers: v.array(v.object({ id: v.id("users"), name: v.string() })),
});

export async function hydrateMessage(
  ctx: QueryCtx,
  message: Doc<"messages">,
  viewerId: Id<"users">,
) {
  const [author, reactionRows, participants, mentioned, attachments] =
    await Promise.all([
      ctx.db.get(message.authorId),
      ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .take(MAX_REACTIONS_READ),
      Promise.all((message.replyParticipants ?? []).map((id) => ctx.db.get(id))),
      Promise.all((message.mentions ?? []).map((id) => ctx.db.get(id))),
      Promise.all(
        (message.attachments ?? []).map(async (a) => ({
          ...a,
          url: await ctx.storage.getUrl(a.storageId),
        })),
      ),
    ]);

  // Group in first-reacted order so chips don't reshuffle as counts change.
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of reactionRows) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
    entry.count += 1;
    if (r.userId === viewerId) entry.reactedByMe = true;
    byEmoji.set(r.emoji, entry);
  }

  return {
    _id: message._id,
    _creationTime: message._creationTime,
    channelId: message.channelId,
    authorId: message.authorId,
    authorName: displayName(author),
    authorImageUrl: displayImage(author),
    authorDeleted: !!author?.deletedAt,
    body: message.body,
    editedAt: message.editedAt,
    threadRootId: message.threadRootId,
    replyCount: message.replyCount ?? 0,
    lastReplyAt: message.lastReplyAt,
    replyParticipants: participants.flatMap((u) =>
      u ? [{ userId: u._id, name: displayName(u), imageUrl: displayImage(u) }] : [],
    ),
    reactions: [...byEmoji.entries()].map(([emoji, e]) => ({ emoji, ...e })),
    attachments,
    mentionedUsers: mentioned.flatMap((u) =>
      u ? [{ id: u._id, name: displayName(u) }] : [],
    ),
  };
}
