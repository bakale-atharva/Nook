import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  hasFeature,
  requireCaller,
  requireOrgWith,
  requireSyncedUser,
} from "./lib/auth";
import { addChannelMember } from "./lib/channelAccess";
import { FEATURES, MAX_DM_PARTICIPANTS, PERMISSIONS } from "./lib/constants";
import { invalidArgument, notFound, planLimit } from "./lib/errors";
import { getOrgMembership } from "./lib/lookups";
import { listOrgUserSummaries, userSummaryValidator } from "./lib/users";

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
    const org = await requireOrgWith(ctx, PERMISSIONS.MESSAGES_SEND);
    if (!hasFeature(org, FEATURES.DIRECT_MESSAGES)) {
      throw planLimit("direct_messages");
    }
    const me = await requireSyncedUser(ctx, org);

    const others = [...new Set(args.userIds)].filter((id) => id !== me._id);
    if (others.length === 0) {
      throw invalidArgument("Pick at least one person to message.");
    }
    if (others.length + 1 > MAX_DM_PARTICIPANTS) {
      throw invalidArgument(
        `Direct messages can include up to ${MAX_DM_PARTICIPANTS} people.`,
      );
    }

    // Everyone must belong to the caller's org and still exist.
    for (const userId of others) {
      const [membership, user] = await Promise.all([
        getOrgMembership(ctx, org.orgId, userId),
        ctx.db.get(userId),
      ]);
      if (!membership || !user || user.deletedAt) {
        throw notFound("That person isn't a member of this organization.");
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
      await addChannelMember(ctx, {
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
  returns: v.array(userSummaryValidator),
  handler: async (ctx) => {
    const { org, user } = await requireCaller(ctx, PERMISSIONS.CHANNELS_READ);
    return await listOrgUserSummaries(ctx, org.orgId, { excludeUserId: user._id });
  },
});
