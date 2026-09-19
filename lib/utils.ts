export { cn } from "cn";

export function initials(name: string) {
  return name
    .split(" ")
    // Spread so a leading emoji (a surrogate pair) isn't cut in half.
    .map((p) => [...p][0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** `singular` for exactly one, `plural` (default: `singular` + "s") otherwise. */
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
