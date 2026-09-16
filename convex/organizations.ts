import { query } from "./_generated/server";
import { requireOrgIdentity } from "./lib/auth";

/**
 * The caller's active org as mirrored by the Clerk `organization.*` /
 * `subscription.*` webhooks (convex/clerkSync.ts) — display only (plan
 * badge, past-due banner). Never used for authorization; that always
 * reads the fresh session token, not this table.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkOrgId", org.orgId))
      .unique();
  },
});
