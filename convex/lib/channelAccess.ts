import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertSameOrg,
  hasFeature,
  requireSyncedUser,
  type OrgIdentity,
} from "./auth";

/** Clerk plan feature that unlocks direct messages (Pro). */
export const DM_FEATURE = "direct_messages";

/** A DM is a private channel that carries a `dmKey`. */
export function isDm(channel: Doc<"channels">): boolean {
  return channel.dmKey !== undefined;
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId),
    )
    .unique();
}

/**
 * Loads a channel and confirms the caller may view it. Throws NOT_FOUND
 * otherwise, so private channels and DMs never reveal their existence.
 *
 * - Public channel: any org member.
 * - Private channel: members, plus admins with `org:private_channels:manage`.
 * - DM: members only. The admin bypass deliberately does NOT apply, and the
 *   org's plan must include the `direct_messages` feature.
 */
export async function assertCanViewChannel(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  channelId: Id<"channels">,
): Promise<Doc<"channels">> {
  const channel = await ctx.db.get(channelId);
  if (!channel) throw new ConvexError({ code: "NOT_FOUND" });
  assertSameOrg(org, channel.orgId);

  if (isDm(channel)) {
    if (!hasFeature(org, DM_FEATURE)) {
      throw new ConvexError({ code: "PLAN_LIMIT", limit: "direct_messages" });
    }
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, channel._id, user._id);
    if (!membership) throw new ConvexError({ code: "NOT_FOUND" });
    return channel;
  }

  if (channel.isPrivate) {
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, channel._id, user._id);
    if (!membership && !org.permissions.has("org:private_channels:manage")) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
  }
  return channel;
}

/**
 * assertCanViewChannel for read queries that prefer "nothing here" over an
 * error: returns null when the channel is hidden from the caller (missing,
 * other org, private/DM non-member, or a DM on a plan without DMs). Auth and
 * sync errors still throw.
 */
export async function viewChannelOrNull(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  channelId: Id<"channels">,
): Promise<Doc<"channels"> | null> {
  try {
    return await assertCanViewChannel(ctx, org, channelId);
  } catch (err) {
    if (err instanceof ConvexError) {
      const code = (err.data as { code?: string } | undefined)?.code;
      if (code === "NOT_FOUND" || code === "PLAN_LIMIT") return null;
    }
    throw err;
  }
}

/** Like assertCanViewChannel, but the caller must also be a channel member. */
export async function assertChannelMember(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  channelId: Id<"channels">,
) {
  const channel = await assertCanViewChannel(ctx, org, channelId);
  const user = await requireSyncedUser(ctx, org);
  const membership = await getMembership(ctx, channel._id, user._id);
  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Join the channel first.",
    });
  }
  return { channel, user, membership };
}
