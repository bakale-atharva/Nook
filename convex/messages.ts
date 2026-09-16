import { v, ConvexError } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  requireOrgIdentity,
  requirePermission,
  requireSyncedUser,
  hasFeature,
  assertSameOrg,
  type OrgIdentity,
} from "./lib/auth";

const FREE_HISTORY_LIMIT = 30;
const MAX_BODY_LENGTH = 4000;

const messageItemValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  channelId: v.id("channels"),
  authorId: v.id("users"),
  authorName: v.string(),
  authorImageUrl: v.optional(v.string()),
  authorDeleted: v.boolean(),
  body: v.string(),
  editedAt: v.optional(v.number()),
});

async function hydrateAuthor(ctx: QueryCtx, message: Doc<"messages">) {
  const author = await ctx.db.get(message.authorId);
  return {
    _id: message._id,
    _creationTime: message._creationTime,
    channelId: message.channelId,
    authorId: message.authorId,
    authorName: author?.deletedAt ? "Deleted user" : (author?.name ?? "Unknown"),
    authorImageUrl: author?.deletedAt ? undefined : author?.imageUrl,
    authorDeleted: !!author?.deletedAt,
    body: message.body,
    editedAt: message.editedAt,
  };
}

/** Loads a channel and confirms the caller may view it (public, or a
 * private one they belong to / can manage). Throws NOT_FOUND otherwise —
 * private channels don't reveal their existence to non-members. */
async function assertCanViewChannel(
  ctx: QueryCtx,
  org: OrgIdentity,
  channelId: Doc<"channels">["_id"],
) {
  const channel = await ctx.db.get(channelId);
  if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
  assertSameOrg(org, channel.orgId);
  if (channel.isPrivate) {
    const user = await requireSyncedUser(ctx, org);
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channelId).eq("userId", user._id),
      )
      .unique();
    if (!membership && !org.permissions.has("org:private_channels:manage")) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
  }
  return channel;
}

/**
 * Messages in a channel, newest page first (standard reverse-infinite-
 * scroll pagination — the client concatenates pages and reverses once for
 * display). On the free plan, results are bounded to the latest
 * FREE_HISTORY_LIMIT messages by restricting the index range itself, so
 * pagination never surfaces anything older — see messages.historyHidden
 * for the "there's more, upgrade to see it" banner.
 */
export const list = query({
  args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(messageItemValidator),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const channel = await assertCanViewChannel(ctx, org, args.channelId);

    let cutoff: number | undefined;
    if (!hasFeature(org, "full_history")) {
      const latest = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .order("desc")
        .take(FREE_HISTORY_LIMIT);
      cutoff =
        latest.length === FREE_HISTORY_LIMIT
          ? latest[latest.length - 1]._creationTime
          : undefined;
    }

    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) =>
        cutoff !== undefined
          ? q.eq("channelId", channel._id).gte("_creationTime", cutoff)
          : q.eq("channelId", channel._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(result.page.map((m) => hydrateAuthor(ctx, m)));
    return { ...result, page };
  },
});

/** Whether this channel has messages older than the free-plan window. */
export const historyHidden = query({
  args: { channelId: v.id("channels") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    if (hasFeature(org, "full_history")) return false;
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return false;
    assertSameOrg(org, channel.orgId);
    const probe = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(FREE_HISTORY_LIMIT + 1);
    return probe.length > FREE_HISTORY_LIMIT;
  },
});

export const send = mutation({
  args: { channelId: v.id("channels"), body: v.string() },
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:messages:send");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, channel.orgId);
    const user = await requireSyncedUser(ctx, org);
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (!membership) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Join the channel before posting.",
      });
    }
    const body = args.body.trim();
    if (!body) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message can't be empty." });
    }
    if (body.length > MAX_BODY_LENGTH) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message is too long." });
    }
    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      orgId: channel.orgId,
      authorId: user._id,
      body,
    });
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, message.orgId);
    if (message.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You can only edit your own messages.",
      });
    }
    const body = args.body.trim();
    if (!body) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message can't be empty." });
    }
    if (body.length > MAX_BODY_LENGTH) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message is too long." });
    }
    await ctx.db.patch(args.messageId, { body, editedAt: Date.now() });
    return null;
  },
});

/** Deletes a message. The author can always delete their own; otherwise
 * requires org:messages:moderate. */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    assertSameOrg(org, message.orgId);
    if (message.authorId !== user._id) {
      requirePermission(org, "org:messages:moderate");
    }
    await ctx.db.delete(args.messageId);
    return null;
  },
});

export const markRead = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (!membership) return null;
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    return null;
  },
});
