import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend";
import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { CHANNEL_CASCADE_PAGE, ROW_DELETE_BATCH } from "./lib/constants";
import { deleteChannelBatch } from "./lib/cascade";
import {
  membershipUpsertFields,
  orgUpsertFields,
  subscriptionFields,
  upsertMembershipRecord,
  upsertOrgRecord,
  upsertUserRecord,
  userUpsertFields,
} from "./lib/clerkUpserts";
import {
  getMembershipByClerkId,
  getOrgByClerkId,
  getUserByClerkId,
} from "./lib/lookups";

/**
 * Handlers for Clerk webhook events (see convex/http.ts for the endpoint
 * that verifies, maps and dispatches to these). All internal: clients can
 * never call these directly, only the Clerk-authenticated HTTP action can.
 *
 * Svix delivers each event at-least-once, so every handler here is an
 * idempotent upsert or delete keyed by the Clerk resource id, and
 * `updated` events are dropped if a newer `updatedAt` is already stored.
 */

export const upsertUser = internalMutation({
  args: userUpsertFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertUserRecord(ctx, args);
    return null;
  },
});

export const deleteUser = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await getUserByClerkId(ctx, args.clerkUserId);
    if (!existing) return null;
    // Soft delete: messages keep their authorId and render as "Deleted user".
    await ctx.db.patch(existing._id, { deletedAt: Date.now() });
    // Drop their channel memberships in every org via the scheduler, since a
    // user can belong to several orgs and this must not block the webhook.
    await ctx.scheduler.runAfter(0, internal.clerkSync.removeUserMemberships, {
      userId: existing._id,
    });
    return null;
  },
});

export const removeUserMemberships = internalMutation({
  args: { userId: v.id("users"), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .paginate({ numItems: ROW_DELETE_BATCH, cursor: args.cursor ?? null });
    for (const row of page.page) {
      await ctx.db.delete(row._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.clerkSync.removeUserMemberships, {
        userId: args.userId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

export const upsertOrg = internalMutation({
  args: orgUpsertFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertOrgRecord(ctx, args);
    return null;
  },
});

export const deleteOrg = internalMutation({
  args: { clerkOrgId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await getOrgByClerkId(ctx, args.clerkOrgId);
    if (existing) await ctx.db.delete(existing._id);
    await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteOrgChannels, {
      orgId: args.clerkOrgId,
    });
    await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteOrgMemberships, {
      orgId: args.clerkOrgId,
    });
    return null;
  },
});

export const cascadeDeleteOrgChannels = internalMutation({
  args: { orgId: v.string(), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("channels")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .paginate({ numItems: CHANNEL_CASCADE_PAGE, cursor: args.cursor ?? null });
    for (const channel of page.page) {
      await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteChannel, {
        channelId: channel._id,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteOrgChannels, {
        orgId: args.orgId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

/**
 * Deletes one channel and everything under it, one bounded batch per
 * invocation via the scheduler (see lib/cascade.ts). Also scheduled by
 * channels.remove, so keep this path stable.
 */
export const cascadeDeleteChannel = internalMutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await deleteChannelBatch(ctx, args.channelId)) {
      await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteChannel, args);
    }
    return null;
  },
});

export const cascadeDeleteOrgMemberships = internalMutation({
  args: { orgId: v.string(), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .paginate({ numItems: ROW_DELETE_BATCH, cursor: args.cursor ?? null });
    for (const row of page.page) {
      await ctx.db.delete(row._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteOrgMemberships, {
        orgId: args.orgId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

export const upsertMembership = internalMutation({
  args: membershipUpsertFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await upsertMembershipRecord(ctx, args))) {
      // user.created hasn't landed yet; retry shortly rather than drop the
      // membership event.
      await ctx.scheduler.runAfter(1000, internal.clerkSync.upsertMembership, args);
    }
    return null;
  },
});

export const deleteMembership = internalMutation({
  args: { clerkMembershipId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await getMembershipByClerkId(ctx, args.clerkMembershipId);
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    await ctx.db
      .query("channelMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", existing.orgId).eq("userId", existing.userId),
      )
      .collect()
      .then((rows) => Promise.all(rows.map((r) => ctx.db.delete(r._id))));
    return null;
  },
});

export const upsertSubscription = internalMutation({
  args: subscriptionFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await getOrgByClerkId(ctx, args.clerkOrgId);
    if (!org) return null;
    await ctx.db.patch(org._id, {
      plan: args.plan,
      subscriptionStatus: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// --- One-off backfill (Step 8 of the Clerk setup guide) ---------------
//
// Webhooks only cover events from the moment the endpoint is registered.
// This pages through the Backend API once to seed users, organizations and
// memberships that already existed. Safe to re-run: every write below goes
// through the same idempotent upserts as the webhook handlers.
// Run from the Convex dashboard (Functions -> clerkSync:backfill -> Run),
// not from the client — it's internal only.

export const backfill = internalAction({
  args: {},
  returns: v.object({ users: v.number(), orgs: v.number(), memberships: v.number() }),
  handler: async (ctx) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        "CLERK_SECRET_KEY is not set in the Convex environment (Settings -> Environment Variables).",
      );
    }
    const clerk = createClerkClient({ secretKey });
    let users = 0;
    let orgs = 0;
    let memberships = 0;

    for (let offset = 0; ; offset += 100) {
      const page = await clerk.users.getUserList({ limit: 100, offset });
      for (const user of page.data) {
        const primaryEmail = user.emailAddresses.find(
          (e) => e.id === user.primaryEmailAddressId,
        )?.emailAddress;
        await ctx.runMutation(internal.clerkSync.upsertUser, {
          clerkUserId: user.id,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
            "Unknown",
          imageUrl: user.imageUrl,
          email: primaryEmail,
          updatedAt: user.updatedAt,
        });
        users++;
      }
      if (page.data.length < 100) break;
    }

    for (let offset = 0; ; offset += 100) {
      const page = await clerk.organizations.getOrganizationList({
        limit: 100,
        offset,
      });
      for (const org of page.data) {
        await ctx.runMutation(internal.clerkSync.upsertOrg, {
          clerkOrgId: org.id,
          name: org.name,
          slug: org.slug,
          imageUrl: org.imageUrl,
          updatedAt: org.updatedAt,
        });
        orgs++;

        for (let mOffset = 0; ; mOffset += 100) {
          const mPage = await clerk.organizations.getOrganizationMembershipList({
            organizationId: org.id,
            limit: 100,
            offset: mOffset,
          });
          for (const membership of mPage.data) {
            const userId = membership.publicUserData?.userId;
            if (!userId) continue;
            await ctx.runMutation(internal.clerkSync.upsertMembershipRow, {
              clerkMembershipId: membership.id,
              orgId: org.id,
              clerkUserId: userId,
              role: membership.role,
              updatedAt: membership.updatedAt,
            });
            memberships++;
          }
          if (mPage.data.length < 100) break;
        }
      }
      if (page.data.length < 100) break;
    }

    return { users, orgs, memberships };
  },
});

/**
 * Backfill variant of upsertMembership: users are synced first, so a
 * membership whose user is missing is skipped instead of retried.
 */
export const upsertMembershipRow = internalMutation({
  args: membershipUpsertFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertMembershipRecord(ctx, args);
    return null;
  },
});
