import { v, ConvexError } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireOrgIdentity,
  requirePermission,
  requireSyncedUser,
  hasFeature,
  assertSameOrg,
} from "./lib/auth";
import {
  assertCanViewChannel,
  assertChannelMember,
  getMembership,
  isDm,
} from "./lib/channelAccess";
import { deleteMessageCascade } from "./lib/messageCleanup";
import { resolveMentions } from "./lib/mentions";

const FREE_HISTORY_LIMIT = 30;
const MAX_BODY_LENGTH = 4000;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 20000;
const MAX_REACTIONS_READ = 200;
const MAX_THREAD_REPLIES = 200;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const attachmentInputValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

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
  threadRootId: v.optional(v.id("messages")),
  replyCount: v.number(),
  lastReplyAt: v.optional(v.number()),
  replyParticipants: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      imageUrl: v.optional(v.string()),
    }),
  ),
  reactions: v.array(
    v.object({
      emoji: v.string(),
      count: v.number(),
      reactedByMe: v.boolean(),
    }),
  ),
  attachments: v.array(
    v.object({
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    }),
  ),
  mentionedUsers: v.array(
    v.object({ id: v.id("users"), name: v.string() }),
  ),
});

function displayName(user: Doc<"users"> | null): string {
  return user?.deletedAt ? "Deleted user" : (user?.name ?? "Unknown");
}

async function hydrateMessage(
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
    authorImageUrl: author?.deletedAt ? undefined : author?.imageUrl,
    authorDeleted: !!author?.deletedAt,
    body: message.body,
    editedAt: message.editedAt,
    threadRootId: message.threadRootId,
    replyCount: message.replyCount ?? 0,
    lastReplyAt: message.lastReplyAt,
    replyParticipants: participants.flatMap((u) =>
      u
        ? [
            {
              userId: u._id,
              name: displayName(u),
              imageUrl: u.deletedAt ? undefined : u.imageUrl,
            },
          ]
        : [],
    ),
    reactions: [...byEmoji.entries()].map(([emoji, e]) => ({ emoji, ...e })),
    attachments,
    mentionedUsers: mentioned.flatMap((u) =>
      u ? [{ id: u._id, name: displayName(u) }] : [],
    ),
  };
}

function validateBody(body: string, hasAttachments: boolean): string {
  const trimmed = body.trim();
  if (!trimmed && !hasAttachments) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message can't be empty." });
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Message is too long." });
  }
  return trimmed;
}

function cleanDimension(n: number | undefined): number | undefined {
  return n !== undefined && Number.isInteger(n) && n > 0 && n <= MAX_IMAGE_DIMENSION
    ? n
    : undefined;
}

/**
 * Checks the uploaded files against Convex's own storage metadata (never the
 * client's claim) and returns the attachment records to persist. Only images
 * up to MAX_ATTACHMENT_BYTES are accepted.
 */
async function validateAttachments(
  ctx: QueryCtx,
  inputs: {
    storageId: Id<"_storage">;
    name: string;
    width?: number;
    height?: number;
  }[],
) {
  if (inputs.length > MAX_ATTACHMENTS) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `You can attach up to ${MAX_ATTACHMENTS} images.`,
    });
  }
  if (new Set(inputs.map((a) => a.storageId)).size !== inputs.length) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Duplicate attachment." });
  }
  const out = [];
  for (const input of inputs) {
    const meta = await ctx.db.system.get("_storage", input.storageId);
    if (!meta || !meta.contentType || !ALLOWED_IMAGE_TYPES.has(meta.contentType)) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Only PNG, JPEG, GIF and WebP images can be attached.",
      });
    }
    if (meta.size > MAX_ATTACHMENT_BYTES) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Images can be at most 10 MB.",
      });
    }
    out.push({
      storageId: input.storageId,
      name: input.name.trim().slice(0, 200) || "image",
      contentType: meta.contentType,
      size: meta.size,
      width: cleanDimension(input.width),
      height: cleanDimension(input.height),
    });
  }
  return out;
}

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
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const channel = await assertCanViewChannel(ctx, org, args.channelId);
    const viewer = await requireSyncedUser(ctx, org);

    let cutoff: number | undefined;
    if (!hasFeature(org, "full_history")) {
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
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const root = await ctx.db.get(args.rootId);
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
    if (hasFeature(org, "full_history")) return false;
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
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:messages:send");
    const { channel, user } = await assertChannelMember(ctx, org, args.channelId);

    const attachments = await validateAttachments(ctx, args.attachments ?? []);
    const body = validateBody(args.body, attachments.length > 0);

    let root: Doc<"messages"> | null = null;
    if (args.threadRootId) {
      root = await ctx.db.get(args.threadRootId);
      if (!root || root.channelId !== channel._id) {
        throw new ConvexError({ code: "NOT_FOUND" });
      }
      if (root.threadRootId !== undefined) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Replies can't be nested.",
        });
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
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, message.orgId);
    await assertCanViewChannel(ctx, org, message.channelId);
    if (message.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You can only edit your own messages.",
      });
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
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    assertSameOrg(org, message.orgId);
    await assertCanViewChannel(ctx, org, message.channelId);
    if (message.authorId !== user._id) {
      requirePermission(org, "org:messages:moderate");
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
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, args.channelId, user._id);
    if (!membership) return null;
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    return null;
  },
});
