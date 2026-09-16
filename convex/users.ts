import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgIdentity, getSyncedUser } from "./lib/auth";

/**
 * Upserts the caller's `users` row from their session token. Called once on
 * app load as a fallback for users who signed up before the Clerk webhook
 * (convex/clerkSync.ts) was wired up, or if an event was ever missed.
 */
export const store = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    const existing = await getSyncedUser(ctx, org);
    const name = org.identity.name ?? org.identity.email ?? "Unknown";
    const imageUrl =
      typeof org.identity.pictureUrl === "string"
        ? org.identity.pictureUrl
        : undefined;
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        imageUrl,
        email: org.identity.email,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: org.identity.subject,
        name,
        imageUrl,
        email: org.identity.email,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** Returns the caller's synced profile, or null before the first `store` call. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    return await getSyncedUser(ctx, org);
  },
});
