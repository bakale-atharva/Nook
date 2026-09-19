export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  return new Date(ms).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}
