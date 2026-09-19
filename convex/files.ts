import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCaller } from "./lib/auth";
import { PERMISSIONS } from "./lib/constants";

/**
 * Short-lived URL the browser POSTs an image to. The returned storage id is
 * then passed to messages.send, which re-checks the file's real type and
 * size from Convex's own metadata before attaching it.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireCaller(ctx, PERMISSIONS.MESSAGES_SEND);
    return await ctx.storage.generateUploadUrl();
  },
});
