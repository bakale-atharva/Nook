// Client side of @mentions. On the wire a mention is a `<@userId>` token
// (validated by convex/lib/mentions.ts); in the composer it's plain `@Name`.
import { MENTION_TOKEN } from "@/convex/lib/mentionToken";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `@Name` -> `<@userId>` for every name in `nameToId`, longest name first. */
export function encodeMentions(text: string, nameToId: Map<string, string>): string {
  const names = [...nameToId.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])@(${names.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`,
    "gu",
  );
  return text.replace(pattern, (whole, name: string) => {
    const id = nameToId.get(name);
    return id ? `<@${id}>` : whole;
  });
}

/** `<@userId>` -> `@Name` so a stored body can be edited as readable text. */
export function decodeMentions(
  body: string,
  users: { id: string; name: string }[],
): string {
  const byId = new Map(users.map((u) => [u.id, u.name]));
  return body.replace(MENTION_TOKEN, (whole, id: string) => {
    const name = byId.get(id);
    return name ? `@${name}` : whole;
  });
}

export type MentionMember = { userId: string; name: string; imageUrl?: string };

const MAX_SUGGESTIONS = 6;
const MAX_QUERY_LENGTH = 30;

/** The `@query` being typed at the caret, if any. */
export function findMentionTrigger(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.length > MAX_QUERY_LENGTH) return null;
  return { start: at, query };
}

/** Members matching `query`, names that start with it first, then alphabetical. */
export function suggestMembers(members: MentionMember[], query: string): MentionMember[] {
  const q = query.toLowerCase();
  return members
    .filter((m) => m.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, MAX_SUGGESTIONS);
}

export type BodySegment =
  | { type: "text"; text: string }
  | { type: "mention"; id: string };

/** Splits a stored body into plain text and mention tokens for rendering. */
export function splitBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: body.slice(last, start) });
    segments.push({ type: "mention", id: match[1] });
    last = start + match[0].length;
  }
  if (last < body.length) segments.push({ type: "text", text: body.slice(last) });
  return segments;
}
