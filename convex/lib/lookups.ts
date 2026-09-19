import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// One place for each index lookup that several functions repeat.

export async function getUserByClerkId(ctx: Ctx, clerkUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export async function getOrgByClerkId(ctx: Ctx, clerkOrgId: string) {
  return await ctx.db
    .query("organizations")
    .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
}

export async function getMembershipByClerkId(ctx: Ctx, clerkMembershipId: string) {
  return await ctx.db
    .query("orgMemberships")
    .withIndex("by_clerk_id", (q) => q.eq("clerkMembershipId", clerkMembershipId))
    .unique();
}

/** The user's membership in an org (Clerk org id), if any. */
export async function getOrgMembership(ctx: Ctx, orgId: string, userId: Id<"users">) {
  return await ctx.db
    .query("orgMemberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
}

/**
 * Regular channels of an org (everything but DMs). `dmKey === undefined`
 * selects exactly those, so a busy org's DMs never crowd the read.
 */
export function regularChannels(ctx: Ctx, orgId: string) {
  return ctx.db
    .query("channels")
    .withIndex("by_org_dm_key", (q) => q.eq("orgId", orgId).eq("dmKey", undefined));
}
