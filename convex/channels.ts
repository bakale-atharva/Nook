import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  requireOrgIdentity,
  requirePermission,
  requireSyncedUser,
  hasFeature,
  assertSameOrg,
} from "./lib/auth";

const FREE_CHANNEL_LIMIT = 5;
const UNREAD_CAP = 99;
const MAX_CHANNELS_SCANNED = 500;

/**
 * Public channels in the org, plus private channels the caller belongs to,
 * each with the caller's membership state and an unread count (capped at
 * UNREAD_CAP+1 reads, shown by the client as "99+").
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const user = await requireSyncedUser(ctx, org);

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
      .take(MAX_CHANNELS_SCANNED);

    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", org.orgId).eq("userId", user._id),
      )
      .take(MAX_CHANNELS_SCANNED);
    const membershipByChannel = new Map(
      memberships.map((m) => [m.channelId, m]),
    );

    const visible = channels.filter(
      (c) => !c.isPrivate || membershipByChannel.has(c._id),
    );

    return await Promise.all(
      visible.map(async (channel) => {
        const membership = membershipByChannel.get(channel._id);
        let unreadCount = 0;
        let unreadCapped = false;
        if (membership) {
          const unread = await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) =>
              q
                .eq("channelId", channel._id)
                .gt("_creationTime", membership.lastReadAt),
            )
            .take(UNREAD_CAP + 1);
          unreadCount = Math.min(unread.length, UNREAD_CAP);
          unreadCapped = unread.length > UNREAD_CAP;
        }
        return {
          ...channel,
          isMember: !!membership,
          unreadCount,
          unreadCapped,
        };
      }),
    );
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return null;
    assertSameOrg(org, channel.orgId);
    if (channel.isPrivate) {
      const user = await requireSyncedUser(ctx, org);
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", channel._id).eq("userId", user._id),
        )
        .unique();
      if (!membership && !org.permissions.has("org:private_channels:manage")) {
        return null; // hide existence of private channels you're not in
      }
    }
    return channel;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:manage");
    const user = await requireSyncedUser(ctx, org);

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Channel name is required.",
      });
    }
    if (args.isPrivate) {
      requirePermission(org, "org:private_channels:manage");
    }
    if (!hasFeature(org, "unlimited_channels")) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
        .take(FREE_CHANNEL_LIMIT + 1);
      if (existing.length >= FREE_CHANNEL_LIMIT) {
        throw new ConvexError({
          code: "PLAN_LIMIT",
          limit: "channels",
          max: FREE_CHANNEL_LIMIT,
        });
      }
    }
    const duplicate = await ctx.db
      .query("channels")
      .withIndex("by_org_name", (q) => q.eq("orgId", org.orgId).eq("name", name))
      .unique();
    if (duplicate) {
      throw new ConvexError({
        code: "DUPLICATE_NAME",
        message: `A channel named "${name}" already exists.`,
      });
    }

    const channelId = await ctx.db.insert("channels", {
      orgId: org.orgId,
      name,
      description: args.description?.trim() || undefined,
      isPrivate: args.isPrivate,
      createdBy: user._id,
    });
    await ctx.db.insert("channelMembers", {
      channelId,
      orgId: org.orgId,
      userId: user._id,
      lastReadAt: Date.now(),
    });
    return channelId;
  },
});

/** Deletes a channel and schedules cleanup of its messages/members/typing rows. */
export const remove = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:manage");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, channel.orgId);
    await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteChannel, {
      channelId: args.channelId,
    });
    return null;
  },
});

export const join = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const user = await requireSyncedUser(ctx, org);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, channel.orgId);
    if (channel.isPrivate) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Private channels require an invite from an admin.",
      });
    }
    const existing = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      orgId: org.orgId,
      userId: user._id,
      lastReadAt: Date.now(),
    });
    return null;
  },
});

export const leave = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return null;
    assertSameOrg(org, channel.orgId);
    const existing = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Adds an org member to a private channel. Admins only. */
export const addMember = mutation({
  args: { channelId: v.id("channels"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:private_channels:manage");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
    assertSameOrg(org, channel.orgId);
    if (!channel.isPrivate) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "addMember is for private channels only; public channels use join.",
      });
    }
    const targetMembership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", org.orgId).eq("userId", args.userId),
      )
      .unique();
    if (!targetMembership) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "That user is not a member of this organization.",
      });
    }
    const existing = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      orgId: org.orgId,
      userId: args.userId,
      lastReadAt: Date.now(),
    });
    return null;
  },
});

/** Channel members with profile info, for the member list / "who's in here". */
export const listMembers = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return [];
    assertSameOrg(org, channel.orgId);
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
      .take(500);
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: user?.name ?? "Unknown",
          imageUrl: user?.imageUrl,
          deleted: !!user?.deletedAt,
        };
      }),
    );
  },
});

/** Org members not yet in this private channel. Admins only (for the invite picker). */
export const listAddable = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:private_channels:manage");
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return [];
    assertSameOrg(org, channel.orgId);

    const [orgMembers, channelMembers] = await Promise.all([
      ctx.db
        .query("orgMemberships")
        .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
        .take(500),
      ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
        .take(500),
    ]);
    const memberUserIds = new Set(channelMembers.map((m) => m.userId));
    const addable = orgMembers.filter((m) => !memberUserIds.has(m.userId));

    return await Promise.all(
      addable.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return { userId: m.userId, name: user?.name ?? "Unknown", imageUrl: user?.imageUrl };
      }),
    );
  },
});
