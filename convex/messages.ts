import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  assertSameOrg,
  hasFeature,
  requireCaller,
  requireOrgIdentity,
  requireOrgWith,
  requirePermission,
  requireSyncedUser,
} from "./lib/auth";
import {
  assertCanViewChannel,
  assertChannelMember,
  findViewableMessage,
  getMembership,
  isDm,
} from "./lib/channelAccess";
import { FEATURES, FREE_HISTORY_LIMIT, MAX_THREAD_REPLIES, PERMISSIONS } from "./lib/constants";
import { forbidden, invalidArgument, notFound } from "./lib/errors";
import { resolveMentions } from "./lib/mentions";
import { hydrateMessage, messageItemValidator } from "./lib/messageHydrate";
import { deleteMessageCascade } from "./lib/messageCleanup";
import { validateAttachments, validateBody } from "./lib/messageValidation";
import { attachmentInputValidator } from "./lib/validators";

/**
 * Root messages in a channel, newest page first (standard reverse-infinite-
 * scroll pagination — the client concatenates pages and reverses once for
 * display). Thread replies are excluded; they load through listThread. On
 * the free plan, results are bounded to the latest FREE_HISTORY_LIMIT
 * messages by restricting the index range itself, so pagination never
 * surfaces anything older — see messages.historyHidden for the "there's
 * more, upgrade to see it" banner.
 */
export const list = query({
  args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(messageItemValidator),
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_READ);
    const channel = await assertCanViewChannel(ctx, org, args.channelId);
    const viewer = await requireSyncedUser(ctx, org);

    let cutoff: number | undefined;
    if (!hasFeature(org, FEATURES.FULL_HISTORY)) {
      const latest = await ctx.db
        .query("messages")
        .withIndex("by_channel_thread", (q) =>
          q.eq("channelId", channel._id).eq("threadRootId", undefined),
        )
        .order("desc")
        .take(FREE_HISTORY_LIMIT);
      cutoff =
        latest.length === FREE_HISTORY_LIMIT
          ? latest[latest.length - 1]._creationTime
          : undefined;
    }

    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel_thread", (q) =>
        cutoff !== undefined
          ? q
              .eq("channelId", channel._id)
              .eq("threadRootId", undefined)
              .gte("_creationTime", cutoff)
          : q.eq("channelId", channel._id).eq("threadRootId", undefined),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map((m) => hydrateMessage(ctx, m, viewer._id)),
    );
    return { ...result, page };
  },
});

/** A thread root plus its replies, oldest reply first. Null if the root is gone. */
export const listThread = query({
  args: { rootId: v.id("messages") },
  returns: v.union(
    v.null(),
    v.object({
      root: messageItemValidator,
      replies: v.array(messageItemValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_READ);
    const root = await ctx.db.get(args.rootId);
    // Missing roots and replies are "no thread" before any org check.
    if (!root || root.threadRootId !== undefined) return null;
    assertSameOrg(org, root.orgId);
    await assertCanViewChannel(ctx, org, root.channelId);
    const viewer = await requireSyncedUser(ctx, org);

    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadRootId", root._id))
      .order("asc")
      .take(MAX_THREAD_REPLIES);

    return {
      root: await hydrateMessage(ctx, root, viewer._id),
      replies: await Promise.all(
        replies.map((m) => hydrateMessage(ctx, m, viewer._id)),
      ),
    };
  },
});

/** Whether this channel has messages older than the free-plan window. */
export const historyHidden = query({
  args: { channelId: v.id("channels") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    if (hasFeature(org, FEATURES.FULL_HISTORY)) return false;
    try {
      await assertCanViewChannel(ctx, org, args.channelId);
    } catch {
      return false;
    }
    const probe = await ctx.db
      .query("messages")
      .withIndex("by_channel_thread", (q) =>
        q.eq("channelId", args.channelId).eq("threadRootId", undefined),
      )
      .order("desc")
      .take(FREE_HISTORY_LIMIT + 1);
    return probe.length > FREE_HISTORY_LIMIT;
  },
});

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
    threadRootId: v.optional(v.id("messages")),
    attachments: v.optional(v.array(attachmentInputValidator)),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.MESSAGES_SEND);
    const { channel, user } = await assertChannelMember(ctx, org, args.channelId);

    const attachments = await validateAttachments(ctx, args.attachments ?? []);
    const body = validateBody(args.body, attachments.length > 0);

    let root: Doc<"messages"> | null = null;
    if (args.threadRootId) {
      root = await ctx.db.get(args.threadRootId);
      if (!root || root.channelId !== channel._id) {
        throw notFound();
      }
      if (root.threadRootId !== undefined) {
        throw invalidArgument("Replies can't be nested.");
      }
    }

    const mentions = await resolveMentions(ctx, channel.orgId, body);
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      channelId: channel._id,
      orgId: channel.orgId,
      authorId: user._id,
      body,
      ...(root ? { threadRootId: root._id } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    });

    if (root) {
      const participants = [
        user._id,
        ...(root.replyParticipants ?? []).filter((id) => id !== user._id),
      ].slice(0, 3);
      await ctx.db.patch(root._id, {
        replyCount: (root.replyCount ?? 0) + 1,
        lastReplyAt: now,
        replyParticipants: participants,
      });
    }
    if (isDm(channel)) {
      await ctx.db.patch(channel._id, { lastMessageAt: now });
    }
    return messageId;
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, user } = await requireCaller(ctx);
    const message = await findViewableMessage(ctx, org, args.messageId);
    if (!message) throw notFound();
    if (message.authorId !== user._id) {
      throw forbidden("You can only edit your own messages.");
    }
    const body = validateBody(args.body, (message.attachments?.length ?? 0) > 0);
    const mentions = await resolveMentions(ctx, message.orgId, body);
    await ctx.db.patch(args.messageId, {
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
      editedAt: Date.now(),
    });
    return null;
  },
});

/** Deletes a message. The author can always delete their own; otherwise
 * requires org:messages:moderate. Deleting a thread root also deletes its
 * replies, and every message takes its reactions and images with it. */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, user } = await requireCaller(ctx);
    const message = await findViewableMessage(ctx, org, args.messageId);
    if (!message) return null;
    if (message.authorId !== user._id) {
      requirePermission(org, PERMISSIONS.MESSAGES_MODERATE);
    }

    if (message.threadRootId) {
      const root = await ctx.db.get(message.threadRootId);
      if (root) {
        await ctx.db.patch(root._id, {
          replyCount: Math.max(0, (root.replyCount ?? 1) - 1),
        });
      }
    }
    await deleteMessageCascade(ctx, message);
    return null;
  },
});

export const markRead = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireCaller(ctx);
    const membership = await getMembership(ctx, args.channelId, user._id);
    if (!membership) return null;
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    return null;
  },
});
