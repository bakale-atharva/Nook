import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  assertSameOrg,
  hasFeature,
  requireSyncedUser,
  type OrgIdentity,
} from "./auth";
import { FEATURES, PERMISSIONS } from "./constants";
import {
  errorCodeOf,
  forbidden,
  invalidArgument,
  notFound,
  planLimit,
} from "./errors";

/** A DM is a private channel that carries a `dmKey`. */
export function isDm(channel: { dmKey?: string }): boolean {
  return channel.dmKey !== undefined;
}

/** Throws INVALID_ARGUMENT if `channel` is a DM (they can't be joined, left, ...). */
export function assertNotDm(channel: { dmKey?: string }, message: string): void {
  if (isDm(channel)) throw invalidArgument(message);
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

/** Adds `userId` to a channel, reading up to now by default. */
export async function addChannelMember(
  ctx: MutationCtx,
  member: {
    channelId: Id<"channels">;
    orgId: string;
    userId: Id<"users">;
    lastReadAt?: number;
  },
): Promise<void> {
  await ctx.db.insert("channelMembers", {
    channelId: member.channelId,
    orgId: member.orgId,
    userId: member.userId,
    lastReadAt: member.lastReadAt ?? Date.now(),
  });
}

/** Passes `doc` through, but throws NOT_FOUND if it belongs to another org. */
function inCallerOrg<D extends { orgId: string }>(org: OrgIdentity, doc: D | null): D | null {
  if (doc) assertSameOrg(org, doc.orgId);
  return doc;
}

/** The channel, or null if it doesn't exist. NOT_FOUND if it's another org's. */
export async function findChannelInOrg(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  channelId: Id<"channels">,
): Promise<Doc<"channels"> | null> {
  return inCallerOrg(org, await ctx.db.get(channelId));
}

/** Like findChannelInOrg, but a missing channel is NOT_FOUND too. */
export async function requireChannelInOrg(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  channelId: Id<"channels">,
): Promise<Doc<"channels">> {
  const channel = await findChannelInOrg(ctx, org, channelId);
  if (!channel) throw notFound();
  return channel;
}

/** The message, or null if it doesn't exist. NOT_FOUND if it's another org's. */
export async function findMessageInOrg(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  messageId: Id<"messages">,
): Promise<Doc<"messages"> | null> {
  return inCallerOrg(org, await ctx.db.get(messageId));
}

/** Like findMessageInOrg, but a missing message is NOT_FOUND too. */
export async function requireMessageInOrg(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  messageId: Id<"messages">,
): Promise<Doc<"messages">> {
  const message = await findMessageInOrg(ctx, org, messageId);
  if (!message) throw notFound();
  return message;
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
  const channel = await requireChannelInOrg(ctx, org, channelId);

  if (isDm(channel)) {
    if (!hasFeature(org, FEATURES.DIRECT_MESSAGES)) {
      throw planLimit("direct_messages");
    }
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, channel._id, user._id);
    if (!membership) throw notFound();
    return channel;
  }

  if (channel.isPrivate) {
    const user = await requireSyncedUser(ctx, org);
    const membership = await getMembership(ctx, channel._id, user._id);
    if (!membership && !org.permissions.has(PERMISSIONS.PRIVATE_CHANNELS_MANAGE)) {
      throw notFound();
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
    const code = errorCodeOf(err);
    if (code === "NOT_FOUND" || code === "PLAN_LIMIT") return null;
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
    throw forbidden("Join the channel first.");
  }
  return { channel, user, membership };
}

/**
 * The message plus the confirmation that the caller may see its channel, or
 * null if the message is gone. NOT_FOUND if it's another org's or its
 * channel is hidden from the caller.
 */
export async function findViewableMessage(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
  messageId: Id<"messages">,
): Promise<Doc<"messages"> | null> {
  const message = await findMessageInOrg(ctx, org, messageId);
  if (message) await assertCanViewChannel(ctx, org, message.channelId);
  return message;
}
