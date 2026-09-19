import { v } from "convex/values";
import type { WebhookEvent, OrganizationMembershipJSON } from "@clerk/backend";
import { createClerkClient } from "@clerk/backend";

// `@clerk/backend`'s WebhookEvent groups organizationMembership.* and
// subscription.* events under one Webhook<union, Data> entry each, so
// TypeScript's `Extract` can't narrow to a strict subset of that union
// (it only matches when the extracted `type` union is exactly equal).
// These pick out just the `data` fields these handlers read.
type MembershipEventData = OrganizationMembershipJSON;
type SubscriptionEventData = {
  status: "abandoned" | "active" | "canceled" | "ended" | "expired" | "incomplete" | "past_due" | "upcoming";
  payer: { organization_id?: string };
  items: { plan?: { slug: string } | null }[];
};
import { internalMutation, internalAction } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { deleteMessageCascade } from "./lib/messageCleanup";

const MESSAGE_CASCADE_BATCH = 50;

/**
 * Handlers for Clerk webhook events (see convex/http.ts for the endpoint
 * that verifies and dispatches to these). All internal: clients can never
 * call these directly, only the Clerk-authenticated HTTP action can.
 *
 * Svix delivers each event at-least-once, so every handler here is an
 * idempotent upsert or delete keyed by the Clerk resource id, and
 * `updated` events are dropped if a newer `updatedAt` is already stored.
 */

async function upsertUserFields(
  ctx: MutationCtx,
  data: Extract<WebhookEvent, { type: "user.created" | "user.updated" }>["data"],
) {
  const updatedAt = data.updated_at ?? Date.now();
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    data.username ||
    "Unknown";
  const primaryEmail = data.email_addresses?.find(
    (e) => e.id === data.primary_email_address_id,
  )?.email_address;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", data.id))
    .unique();

  if (existing) {
    if (existing.updatedAt >= updatedAt) return; // out-of-order, drop
    await ctx.db.patch(existing._id, {
      name,
      imageUrl: data.image_url,
      email: primaryEmail,
      updatedAt,
    });
  } else {
    await ctx.db.insert("users", {
      clerkUserId: data.id,
      name,
      imageUrl: data.image_url,
      email: primaryEmail,
      updatedAt,
    });
  }
}

export const upsertUser = internalMutation({
  args: { data: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertUserFields(ctx, args.data);
    return null;
  },
});

export const deleteUser = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
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
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
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
  args: { data: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = args.data as Extract<
      WebhookEvent,
      { type: "organization.created" | "organization.updated" }
    >["data"];
    const updatedAt = data.updated_at ?? Date.now();
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", data.id))
      .unique();
    if (existing) {
      if (existing.updatedAt >= updatedAt) return null;
      await ctx.db.patch(existing._id, {
        name: data.name,
        slug: data.slug,
        imageUrl: data.image_url,
        updatedAt,
      });
    } else {
      await ctx.db.insert("organizations", {
        clerkOrgId: data.id,
        name: data.name,
        slug: data.slug,
        imageUrl: data.image_url,
        updatedAt,
      });
    }
    return null;
  },
});

export const deleteOrg = internalMutation({
  args: { clerkOrgId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
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
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
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
 * Deletes one channel and everything under it (messages, channelMembers,
 * typing rows), one bounded batch per invocation via the scheduler so a
 * busy channel can't blow a single mutation's read/write limits.
 */
export const cascadeDeleteChannel = internalMutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Messages go in smaller batches than the other tables: each one can
    // carry reactions and uploaded files that are deleted with it.
    const [messages, members, typingRows] = await Promise.all([
      ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
        .take(MESSAGE_CASCADE_BATCH),
      ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", args.channelId))
        .take(100),
      ctx.db
        .query("typing")
        .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
        .take(100),
    ]);
    for (const message of messages) {
      // Thread replies are messages of this channel too, so they are picked
      // up by later batches; no separate reply purge is needed.
      await deleteMessageCascade(ctx, message, { skipReplyPurge: true });
    }
    for (const row of [...members, ...typingRows]) {
      await ctx.db.delete(row._id);
    }
    if (
      messages.length === MESSAGE_CASCADE_BATCH ||
      members.length === 100 ||
      typingRows.length === 100
    ) {
      // More rows may remain; keep going next tick.
      await ctx.scheduler.runAfter(0, internal.clerkSync.cascadeDeleteChannel, args);
      return null;
    }
    const channel = await ctx.db.get(args.channelId);
    if (channel) await ctx.db.delete(args.channelId);
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
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
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
  args: { data: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = args.data as MembershipEventData;
    const updatedAt = data.updated_at ?? Date.now();
    const clerkUserId = data.public_user_data.user_id;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!user) {
      // user.created hasn't landed yet; retry shortly rather than drop the
      // membership event.
      await ctx.scheduler.runAfter(1000, internal.clerkSync.upsertMembership, args);
      return null;
    }
    const existing = await ctx.db
      .query("orgMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkMembershipId", data.id))
      .unique();
    if (existing) {
      if (existing.updatedAt >= updatedAt) return null;
      await ctx.db.patch(existing._id, { role: data.role, updatedAt });
    } else {
      await ctx.db.insert("orgMemberships", {
        clerkMembershipId: data.id,
        orgId: data.organization.id,
        userId: user._id,
        role: data.role,
        updatedAt,
      });
    }
    return null;
  },
});

export const deleteMembership = internalMutation({
  args: { clerkMembershipId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkMembershipId", args.clerkMembershipId))
      .unique();
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
  args: { data: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = args.data as SubscriptionEventData;
    const orgId = data.payer.organization_id;
    if (!orgId) return null; // user-level payer, not an org subscription
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", orgId))
      .unique();
    if (!org) return null;
    const plan = data.items[0]?.plan?.slug;
    await ctx.db.patch(org._id, {
      plan,
      subscriptionStatus: data.status,
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
// through the same idempotent upsert mutations as the webhook handlers.
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
        await ctx.runMutation(internal.clerkSync.upsertUserRow, {
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
        await ctx.runMutation(internal.clerkSync.upsertOrgRow, {
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

export const upsertUserRow = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (existing) {
      if (existing.updatedAt >= args.updatedAt) return null;
      await ctx.db.patch(existing._id, {
        name: args.name,
        imageUrl: args.imageUrl,
        email: args.email,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.insert("users", args);
    }
    return null;
  },
});

export const upsertOrgRow = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (existing) {
      if (existing.updatedAt >= args.updatedAt) return null;
      await ctx.db.patch(existing._id, {
        name: args.name,
        slug: args.slug,
        imageUrl: args.imageUrl,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.insert("organizations", args);
    }
    return null;
  },
});

export const upsertMembershipRow = internalMutation({
  args: {
    clerkMembershipId: v.string(),
    orgId: v.string(),
    clerkUserId: v.string(),
    role: v.string(),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return null; // backfill runs users first, so this shouldn't happen
    const existing = await ctx.db
      .query("orgMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkMembershipId", args.clerkMembershipId))
      .unique();
    if (existing) {
      if (existing.updatedAt >= args.updatedAt) return null;
      await ctx.db.patch(existing._id, { role: args.role, updatedAt: args.updatedAt });
    } else {
      await ctx.db.insert("orgMemberships", {
        clerkMembershipId: args.clerkMembershipId,
        orgId: args.orgId,
        userId: user._id,
        role: args.role,
        updatedAt: args.updatedAt,
      });
    }
    return null;
  },
});
