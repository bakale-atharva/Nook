// Formatters are built once; constructing an Intl formatter is far costlier
// than calling one, and a busy channel formats hundreds of timestamps.
const timeFormat = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat([], { month: "long", day: "numeric" });
const dayWithYearFormat = new Intl.DateTimeFormat([], {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatTime(ms: number) {
  return timeFormat.format(ms);
}

/** Machine-readable value for a <time dateTime> attribute. */
export function isoTime(ms: number) {
  return new Date(ms).toISOString();
}

export function sameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// "Today" is the only relative label. Every other day — including
// yesterday — shows its absolute date, with the year added once it's not
// the current year.
export function formatDayLabel(ms: number): string {
  const now = Date.now();
  if (sameDay(ms, now)) return "Today";
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayFormat : dayWithYearFormat).format(ms);
}
