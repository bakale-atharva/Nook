import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getSyncedUser, requireOrgIdentity, requireOrgWith } from "./lib/auth";
import { PERMISSIONS } from "./lib/constants";
import { listOrgUserSummaries, userSummaryValidator } from "./lib/users";

/**
 * Upserts the caller's `users` row from their session token. Called once on
 * app load as a fallback for users who signed up before the Clerk webhook
 * (convex/clerkSync.ts) was wired up, or if an event was ever missed.
 *
 * The session token doesn't reliably carry profile fields (Clerk's compact
 * v2 claims don't include name/email/picture), so on every field we only
 * use the token's value when it's actually present, and otherwise keep
 * whatever the webhook already synced — never downgrade good data to
 * "Unknown" just because this particular token omitted it.
 */
export const store = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    const existing = await getSyncedUser(ctx, org);
    const learnedSomething =
      typeof org.identity.name === "string" ||
      typeof org.identity.email === "string";
    const name =
      org.identity.name ?? org.identity.email ?? existing?.name ?? "Unknown";
    const imageUrl =
      typeof org.identity.pictureUrl === "string"
        ? org.identity.pictureUrl
        : existing?.imageUrl;
    const email = org.identity.email ?? existing?.email;
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        imageUrl,
        email,
        // Only bump the clock when the token actually told us something new,
        // so a later webhook event (the authoritative source) can still win
        // its updatedAt >= check even if this ran first.
        updatedAt: learnedSomething ? Date.now() : existing.updatedAt,
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: org.identity.subject,
        name,
        imageUrl,
        email,
        updatedAt: learnedSomething ? Date.now() : 0,
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

/**
 * Everyone in the caller's org (not just one channel), for the @mention
 * picker. Deleted users are left out. The client filters as you type.
 */
export const listOrgMembers = query({
  args: {},
  returns: v.array(userSummaryValidator),
  handler: async (ctx) => {
    const org = await requireOrgWith(ctx, PERMISSIONS.CHANNELS_READ);
    return await listOrgUserSummaries(ctx, org.orgId);
  },
});
