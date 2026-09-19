import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  hasFeature,
  requireOrgIdentity,
  requirePermission,
  requireSyncedUser,
} from "./lib/auth";
import { DM_FEATURE } from "./lib/channelAccess";

const MAX_DM_PARTICIPANTS = 8;
const MAX_CANDIDATES = 500;

/**
 * Opens (or creates) the direct message with exactly this set of people.
 * The caller is always included. The same set always resolves to the same
 * channel, so "message Sam" twice lands in one conversation.
 *
 * DMs are a Pro feature (`direct_messages` on the plan).
 */
export const getOrCreate = mutation({
  args: { userIds: v.array(v.id("users")) },
  returns: v.id("channels"),
  handler: async (ctx, args): Promise<Id<"channels">> => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:messages:send");
    if (!hasFeature(org, DM_FEATURE)) {
      throw new ConvexError({ code: "PLAN_LIMIT", limit: "direct_messages" });
    }
    const me = await requireSyncedUser(ctx, org);

    const others = [...new Set(args.userIds)].filter((id) => id !== me._id);
    if (others.length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Pick at least one person to message.",
      });
    }
    if (others.length + 1 > MAX_DM_PARTICIPANTS) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `Direct messages can include up to ${MAX_DM_PARTICIPANTS} people.`,
      });
    }

    // Everyone must belong to the caller's org and still exist.
    for (const userId of others) {
      const [membership, user] = await Promise.all([
        ctx.db
          .query("orgMemberships")
          .withIndex("by_org_user", (q) =>
            q.eq("orgId", org.orgId).eq("userId", userId),
          )
          .unique(),
        ctx.db.get(userId),
      ]);
      if (!membership || !user || user.deletedAt) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "That person isn't a member of this organization.",
        });
      }
    }

    const memberIds = [me._id, ...others].sort();
    const dmKey = memberIds.join(",");
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_org_dm_key", (q) =>
        q.eq("orgId", org.orgId).eq("dmKey", dmKey),
      )
      .unique();
    if (existing) return existing._id;

    const now = Date.now();
    const channelId = await ctx.db.insert("channels", {
      orgId: org.orgId,
      name: "",
      isPrivate: true,
      createdBy: me._id,
      dmKey,
      lastMessageAt: now,
    });
    for (const userId of memberIds) {
      await ctx.db.insert("channelMembers", {
        channelId,
        orgId: org.orgId,
        userId,
        lastReadAt: now,
      });
    }
    return channelId;
  },
});

/** Org members the caller can start a DM with (everyone except themselves). */
export const listCandidates = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      imageUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:channels:read");
    const me = await requireSyncedUser(ctx, org);
    const memberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org", (q) => q.eq("orgId", org.orgId))
      .take(MAX_CANDIDATES);
    const users = await Promise.all(
      memberships
        .filter((m) => m.userId !== me._id)
        .map((m) => ctx.db.get(m.userId)),
    );
    return users.flatMap((u) =>
      u && !u.deletedAt
        ? [{ userId: u._id, name: u.name, imageUrl: u.imageUrl }]
        : [],
    );
  },
});
