import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const MAX_MENTIONS = 20;

// Mentions travel in the message body as `<@userId>` tokens so a rename never
// leaves stale text behind. The client renders the name from `mentionedUsers`.
const MENTION_TOKEN = /<@([a-z0-9]{16,64})>/g;

/** Distinct raw ids found in `<@id>` tokens, capped at MAX_MENTIONS. */
export function extractMentionTokens(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_TOKEN)) {
    seen.add(match[1]);
    if (seen.size >= MAX_MENTIONS) break;
  }
  return [...seen];
}

/**
 * Turns the `<@id>` tokens in `body` into validated user ids. The client is
 * never trusted: an id only counts when it is a real `users` row that
 * belongs to `orgId`. Anything else is ignored and stays literal text.
 */
export async function resolveMentions(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  body: string,
): Promise<Id<"users">[]> {
  const resolved: Id<"users">[] = [];
  for (const raw of extractMentionTokens(body)) {
    const userId = ctx.db.normalizeId("users", raw);
    if (!userId) continue;
    const membership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .unique();
    if (membership) resolved.push(userId);
  }
  return resolved;
}
