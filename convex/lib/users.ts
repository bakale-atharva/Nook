import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { DELETED_USER_NAME, MAX_ROWS_LISTED } from "./constants";

/** How a person is named to others: deleted users are masked. */
export function displayName(user: Doc<"users"> | null, missing = "Unknown"): string {
  return user?.deletedAt ? DELETED_USER_NAME : (user?.name ?? missing);
}

/** Deleted users lose their avatar as well as their name. */
export function displayImage(user: Doc<"users"> | null): string | undefined {
  return user?.deletedAt ? undefined : user?.imageUrl;
}

export const userSummaryValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  imageUrl: v.optional(v.string()),
});

/**
 * Everyone in an org (optionally minus one person), deleted users left out,
 * as picker entries. The caps apply to the membership scan, before deleted
 * users are dropped.
 */
export async function listOrgUserSummaries(
  ctx: QueryCtx,
  orgId: string,
  { excludeUserId }: { excludeUserId?: Id<"users"> } = {},
) {
  const memberships = await ctx.db
    .query("orgMemberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_ROWS_LISTED);
  const users = await Promise.all(
    memberships
      .filter((m) => m.userId !== excludeUserId)
      .map((m) => ctx.db.get(m.userId)),
  );
  return users.flatMap((u) =>
    u && !u.deletedAt ? [{ userId: u._id, name: u.name, imageUrl: u.imageUrl }] : [],
  );
}
