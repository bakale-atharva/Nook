import { MAX_MENTIONS } from "./constants";

// Mentions travel in the message body as `<@userId>` tokens so a rename never
// leaves stale text behind. The client renders the name from `mentionedUsers`.
// Pure (no Convex runtime imports) so the client can share the exact pattern.
export const MENTION_TOKEN = /<@([a-z0-9]{16,64})>/g;

/** Distinct raw ids found in `<@id>` tokens, capped at MAX_MENTIONS. */
export function extractMentionTokens(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_TOKEN)) {
    seen.add(match[1]);
    if (seen.size >= MAX_MENTIONS) break;
  }
  return [...seen];
}
