import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Mirrors Clerk users, kept in sync by convex/clerkSync.ts webhooks (with
  // convex/users.ts:store as a fallback for the first load before any
  // webhook has arrived). Never the source of truth for auth — that's
  // always the caller's session token (see convex/lib/auth.ts).
  users: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkUserId"]),

  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    plan: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  orgMemberships: defineTable({
    clerkMembershipId: v.string(),
    orgId: v.string(), // Clerk org id, matches identity's o.id claim
    userId: v.id("users"),
    role: v.string(), // e.g. "org:admin", "org:member"
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkMembershipId"])
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  channels: defineTable({
    orgId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    orgId: v.string(),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("by_channel_user", ["channelId", "userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_user", ["userId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    orgId: v.string(),
    authorId: v.id("users"),
    body: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_channel", ["channelId"]),

  typing: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),
});
