import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  assertSameOrg,
  hasFeature,
  requireCaller,
  requirePermission,
  requireOrgWith,
} from "./lib/auth";
import {
  addChannelMember,
  assertNotDm,
  findChannelInOrg,
  getMembership,
  isDm,
  requireChannelInOrg,
  viewChannelOrNull,
} from "./lib/channelAccess";
import {
  FEATURES,
  FREE_CHANNEL_LIMIT,
  MAX_ROWS_LISTED,
  PERMISSIONS,
} from "./lib/constants";
import { duplicateName, forbidden, invalidArgument, notFound, planLimit } from "./lib/errors";
import { getOrgMembership, regularChannels } from "./lib/lookups";
import { listSidebarChannels } from "./lib/sidebar";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org, user } = await requireCaller(ctx, PERMISSIONS.CHANNELS_READ);
    return await listSidebarChannels(ctx, org, user);
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_READ);
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
    const { org, user } = await requireCaller(ctx, PERMISSIONS.CHANNELS_MANAGE);

    const name = args.name.trim();
    if (!name) {
      throw invalidArgument("Channel name is required.");
    }
    if (args.isPrivate) {
      requirePermission(org, PERMISSIONS.PRIVATE_CHANNELS_MANAGE);
    }
    if (!hasFeature(org, FEATURES.UNLIMITED_CHANNELS)) {
      const existing = await regularChannels(ctx, org.orgId).take(FREE_CHANNEL_LIMIT + 1);
      if (existing.length >= FREE_CHANNEL_LIMIT) {
        throw planLimit("channels", FREE_CHANNEL_LIMIT);
      }
    }
    const duplicate = await ctx.db
      .query("channels")
      .withIndex("by_org_name", (q) => q.eq("orgId", org.orgId).eq("name", name))
      .unique();
    if (duplicate) {
      throw duplicateName(`A channel named "${name}" already exists.`);
    }

    const channelId = await ctx.db.insert("channels", {
      orgId: org.orgId,
      name,
      description: args.description?.trim() || undefined,
      isPrivate: args.isPrivate,
      createdBy: user._id,
    });
    await addChannelMember(ctx, { channelId, orgId: org.orgId, userId: user._id });
    return channelId;
  },
});

/** Deletes a channel and schedules cleanup of its messages/members/typing rows. */
export const remove = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_MANAGE);
    const channel = await requireChannelInOrg(ctx, org, args.channelId);
    assertNotDm(channel, "Direct messages can't be deleted.");
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
    const { org, user } = await requireCaller(ctx, PERMISSIONS.CHANNELS_READ);
    const channel = await requireChannelInOrg(ctx, org, args.channelId);
    assertNotDm(channel, "Direct messages can't be joined.");
    if (channel.isPrivate) {
      throw forbidden("Private channels require an invite from an admin.");
    }
    if (await getMembership(ctx, args.channelId, user._id)) return null;
    await addChannelMember(ctx, {
      channelId: args.channelId,
      orgId: org.orgId,
      userId: user._id,
    });
    return null;
  },
});

export const leave = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, user } = await requireCaller(ctx);
    const channel = await findChannelInOrg(ctx, org, args.channelId);
    if (!channel) return null;
    assertNotDm(channel, "You can't leave a direct message.");
    const existing = await getMembership(ctx, args.channelId, user._id);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Adds an org member to a private channel. Admins only. */
export const addMember = mutation({
  args: { channelId: v.id("channels"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.PRIVATE_CHANNELS_MANAGE);
    const channel = await requireChannelInOrg(ctx, org, args.channelId);
    assertNotDm(channel, "People can't be added to a direct message.");
    if (!channel.isPrivate) {
      throw invalidArgument("addMember is for private channels only; public channels use join.");
    }
    if (!(await getOrgMembership(ctx, org.orgId, args.userId))) {
      throw notFound("That user is not a member of this organization.");
    }
    if (await getMembership(ctx, args.channelId, args.userId)) return null;
    await addChannelMember(ctx, {
      channelId: args.channelId,
      orgId: org.orgId,
      userId: args.userId,
    });
    return null;
  },
});

/** Channel members with profile info, for the member list / "who's in here". */
export const listMembers = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_READ);
    const channel = await viewChannelOrNull(ctx, org, args.channelId);
    if (!channel) return [];
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
      .take(MAX_ROWS_LISTED);
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        // The stored name is returned as-is; the client masks deleted users
        // from the `deleted` flag.
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
    const org = await requireOrgWith(ctx, PERMISSIONS.PRIVATE_CHANNELS_MANAGE);
    // A missing channel or a DM yields an empty picker even across orgs, so
    // this checks the org only after those two.
    const channel = await ctx.db.get(args.channelId);
    if (!channel || isDm(channel)) return [];
    assertSameOrg(org, channel.orgId);

    const [orgMembers, channelMembers] = await Promise.all([
      ctx.db
        .query("orgMemberships")
        .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
        .take(MAX_ROWS_LISTED),
      ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
        .take(MAX_ROWS_LISTED),
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
    const { user } = await requireCaller(ctx);
    const membership = await getMembership(ctx, args.channelId, user._id);
    if (!membership) {
      throw forbidden("Join the channel to star it.");
    }
    await ctx.db.patch(membership._id, {
      starred: args.starred ? true : undefined,
    });
    return null;
  },
});
