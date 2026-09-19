import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { attachmentValidator } from "./lib/validators";

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
    // Direct messages are channels with a `dmKey` (sorted member ids joined
    // by ","), always private with an empty name. Regular channels leave it
    // undefined, so `eq("dmKey", undefined)` on by_org_dm_key lists exactly
    // the regular channels.
    dmKey: v.optional(v.string()),
    // DMs only: bumped on every new message, used to order the DM list.
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"])
    .index("by_org_dm_key", ["orgId", "dmKey"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    orgId: v.string(),
    userId: v.id("users"),
    lastReadAt: v.number(),
    // Per-user star, so each member decides what's pinned to their sidebar.
    starred: v.optional(v.boolean()),
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
    // Thread replies point at their root message (one level, no nesting).
    // Root messages leave this undefined, which is what keeps replies out of
    // the main feed via by_channel_thread.
    threadRootId: v.optional(v.id("messages")),
    // Denormalised onto the root so the feed can show "N replies" without
    // reading the thread.
    replyCount: v.optional(v.number()),
    lastReplyAt: v.optional(v.number()),
    replyParticipants: v.optional(v.array(v.id("users"))), // max 3, most recent
    // Max 4, image files only (validated in messages.send).
    attachments: v.optional(v.array(attachmentValidator)),
    // Derived server-side from `<@userId>` tokens in `body`; max 20.
    mentions: v.optional(v.array(v.id("users"))),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_thread", ["channelId", "threadRootId"])
    .index("by_thread", ["threadRootId"]),

  // One row per (message, user, emoji). A "heart" is the ❤️ emoji.
  reactions: defineTable({
    messageId: v.id("messages"),
    channelId: v.id("channels"),
    orgId: v.string(),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  typing: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),
});
