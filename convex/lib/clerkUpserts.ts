import { v, type ObjectType } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import {
  getMembershipByClerkId,
  getOrgByClerkId,
  getUserByClerkId,
} from "./lookups";

// The narrow, already-parsed shapes the sync mutations accept. Clerk's raw
// webhook payloads carry many more fields, and Convex object validators
// reject unknown ones, so convex/http.ts maps each event down to these first
// (see lib/clerkPayloads.ts).

export const userUpsertFields = {
  clerkUserId: v.string(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  email: v.optional(v.string()),
  updatedAt: v.number(),
};
export type UserUpsert = ObjectType<typeof userUpsertFields>;

export const orgUpsertFields = {
  clerkOrgId: v.string(),
  name: v.string(),
  slug: v.string(),
  imageUrl: v.optional(v.string()),
  updatedAt: v.number(),
};
export type OrgUpsert = ObjectType<typeof orgUpsertFields>;

export const membershipUpsertFields = {
  clerkMembershipId: v.string(),
  orgId: v.string(),
  clerkUserId: v.string(),
  role: v.string(),
  updatedAt: v.number(),
};
export type MembershipUpsert = ObjectType<typeof membershipUpsertFields>;

export const subscriptionFields = {
  clerkOrgId: v.string(),
  plan: v.optional(v.string()),
  status: v.string(),
};
export type SubscriptionUpdate = ObjectType<typeof subscriptionFields>;

// Svix delivers each event at-least-once and out of order, so every upsert
// is keyed by the Clerk id and dropped when a newer `updatedAt` is stored.

export async function upsertUserRecord(ctx: MutationCtx, user: UserUpsert): Promise<void> {
  const existing = await getUserByClerkId(ctx, user.clerkUserId);
  if (!existing) {
    await ctx.db.insert("users", user);
    return;
  }
  if (existing.updatedAt >= user.updatedAt) return; // out-of-order, drop
  await ctx.db.patch(existing._id, {
    name: user.name,
    imageUrl: user.imageUrl,
    email: user.email,
    updatedAt: user.updatedAt,
  });
}

export async function upsertOrgRecord(ctx: MutationCtx, org: OrgUpsert): Promise<void> {
  const existing = await getOrgByClerkId(ctx, org.clerkOrgId);
  if (!existing) {
    await ctx.db.insert("organizations", org);
    return;
  }
  if (existing.updatedAt >= org.updatedAt) return;
  await ctx.db.patch(existing._id, {
    name: org.name,
    slug: org.slug,
    imageUrl: org.imageUrl,
    updatedAt: org.updatedAt,
  });
}

/**
 * Returns false, writing nothing, when the membership's user isn't synced
 * yet; what to do about that is up to the caller (the webhook retries, the
 * backfill, which syncs users first, moves on).
 */
export async function upsertMembershipRecord(
  ctx: MutationCtx,
  membership: MembershipUpsert,
): Promise<boolean> {
  const user = await getUserByClerkId(ctx, membership.clerkUserId);
  if (!user) return false;
  const existing = await getMembershipByClerkId(ctx, membership.clerkMembershipId);
  if (!existing) {
    await ctx.db.insert("orgMemberships", {
      clerkMembershipId: membership.clerkMembershipId,
      orgId: membership.orgId,
      userId: user._id,
      role: membership.role,
      updatedAt: membership.updatedAt,
    });
  } else if (existing.updatedAt < membership.updatedAt) {
    await ctx.db.patch(existing._id, {
      role: membership.role,
      updatedAt: membership.updatedAt,
    });
  }
  return true;
}
