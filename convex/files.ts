import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOrgIdentity, requirePermission, requireSyncedUser } from "./lib/auth";

/**
 * Short-lived URL the browser POSTs an image to. The returned storage id is
 * then passed to messages.send, which re-checks the file's real type and
 * size from Convex's own metadata before attaching it.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const org = await requireOrgIdentity(ctx);
    requirePermission(org, "org:messages:send");
    await requireSyncedUser(ctx, org);
    return await ctx.storage.generateUploadUrl();
  },
});
