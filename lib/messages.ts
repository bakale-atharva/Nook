import { sameDay } from "@/lib/time";

// Consecutive messages from the same author land in one visual group —
// avatar and name shown once — when they're this close together.
export const GROUP_WINDOW_MS = 60_000;

type Groupable = { authorId: string; _creationTime: number };

/**
 * Whether `message` opens a new visual group after `previous`: a different
 * author, a long pause, or (with `breakOnDay`) a new calendar day.
 */
export function startsGroup(
  previous: Groupable | undefined,
  message: Groupable,
  { breakOnDay = false }: { breakOnDay?: boolean } = {},
): boolean {
  if (!previous) return true;
  if (breakOnDay && !sameDay(previous._creationTime, message._creationTime)) return true;
  return (
    previous.authorId !== message.authorId ||
    message._creationTime - previous._creationTime > GROUP_WINDOW_MS
  );
}
