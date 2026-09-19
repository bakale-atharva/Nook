import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  requireOrgIdentity,
  requirePermission,
  requireSyncedUser,
  hasFeature,
  assertSameOrg,
} from "./lib/auth";
import {
  DM_FEATURE,
  getMembership,
  isDm,
  viewChannelOrNull,
} from "./lib/channelAccess";

const FREE_CHANNEL_LIMIT = 5;
const UNREAD_CAP = 99;
const MAX_CHANNELS_SCANNED = 500;
const MAX_DM_MEMBERS_SHOWN = 8;

function rejectDm(channel: { dmKey?: string }, message: string): void {
  if (channel.dmKey !== undefined) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", message });
  }
}

/**
 * The caller's sidebar: public channels, private channels they belong to and,
 * on plans with direct messages, their DMs. Each carries the caller's
 * membership state, an unread count (capped at UNREAD_CAP+1 reads, shown by
 * the client as "99+"), and how many of those unread messages @mention them.
 * Thread replies never count toward unread.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const user = await requireSyncedUser(ctx, org);

    // dmKey === undefined selects regular channels only, so a busy org's
    // DMs never crowd this scan or get read by people outside them.
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_org_dm_key", (q) =>
        q.eq("orgId", org.orgId).eq("dmKey", undefined),
      )
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

    // Memberships that aren't a regular channel are DMs (or dangling rows).
    let dms: Doc<"channels">[] = [];
    if (hasFeature(org, DM_FEATURE)) {
      const regularIds = new Set(channels.map((c) => c._id));
      const candidates = await Promise.all(
        memberships
          .filter((m) => !regularIds.has(m.channelId))
          .map((m) => ctx.db.get(m.channelId)),
      );
      dms = candidates
        .filter((c): c is Doc<"channels"> => !!c && isDm(c))
        .sort(
          (a, b) =>
            (b.lastMessageAt ?? b._creationTime) -
            (a.lastMessageAt ?? a._creationTime),
        );
    }

    return await Promise.all(
      [...visible, ...dms].map(async (channel) => {
        const membership = membershipByChannel.get(channel._id);
        let unreadCount = 0;
        let unreadCapped = false;
        let mentionCount = 0;
        if (membership) {
          const unread = await ctx.db
            .query("messages")
            .withIndex("by_channel_thread", (q) =>
              q
                .eq("channelId", channel._id)
                .eq("threadRootId", undefined)
                .gt("_creationTime", membership.lastReadAt),
            )
            .take(UNREAD_CAP + 1);
          unreadCount = Math.min(unread.length, UNREAD_CAP);
          unreadCapped = unread.length > UNREAD_CAP;
          mentionCount = unread.filter((m) =>
            m.mentions?.includes(user._id),
          ).length;
        }

        let dmMembers: {
          userId: Id<"users">;
          name: string;
          imageUrl: string | undefined;
        }[] = [];
        if (isDm(channel)) {
          const rows = await ctx.db
            .query("channelMembers")
            .withIndex("by_channel_user", (q) => q.eq("channelId", channel._id))
            .take(MAX_DM_MEMBERS_SHOWN);
          dmMembers = await Promise.all(
            rows.map(async (row) => {
              const u = await ctx.db.get(row.userId);
              return {
                userId: row.userId,
                name: u?.deletedAt ? "Deleted user" : (u?.name ?? "Unknown"),
                imageUrl: u?.deletedAt ? undefined : u?.imageUrl,
              };
            }),
          );
        }

        return {
          ...channel,
          isDm: isDm(channel),
          isMember: !!membership,
          starred: membership?.starred ?? false,
          unreadCount,
          unreadCapped,
          mentionCount,
          dmMembers,
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
    // Null hides private channels and DMs from people who aren't in them.
    return await viewChannelOrNull(ctx, org, args.channelId);
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
        .withIndex("by_org_dm_key", (q) =>
          q.eq("orgId", org.orgId).eq("dmKey", undefined),
        )
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
    rejectDm(channel, "Direct messages can't be deleted.");
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
    rejectDm(channel, "Direct messages can't be joined.");
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
    rejectDm(channel, "You can't leave a direct message.");
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
    rejectDm(channel, "People can't be added to a direct message.");
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
    const channel = await viewChannelOrNull(ctx, org, args.channelId);
    if (!channel) return [];
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
    if (!channel || isDm(channel)) return [];
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

/** Stars or unstars a channel or DM for the caller only. Members only. */
export const setStarred = mutation({
  args: { channelId: v.id("channels"), starred: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgIdentity(ctx);
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, args.channelId, user._id);
    if (!membership) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Join the channel to star it.",
      });
    }
    await ctx.db.patch(membership._id, {
      starred: args.starred ? true : undefined,
    });
    return null;
  },
});
