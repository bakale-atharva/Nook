import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { extractMentionTokens } from "./mentionToken";
import { getOrgMembership } from "./lookups";

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
    if (await getOrgMembership(ctx, orgId, userId)) resolved.push(userId);
  }
  return resolved;
}
