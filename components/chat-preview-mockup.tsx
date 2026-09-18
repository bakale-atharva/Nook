import { cn } from "@/lib/utils";

const SHEETS = [
  {
    channel: "roadmap",
    rev: "REV A",
    rotate: "-rotate-6 translate-x-[-64px]",
    z: "z-10",
    delay: "0ms",
    author: "Priya",
    message: "Cut the Q3 scope doc, ready for review.",
    live: false,
  },
  {
    channel: "design",
    rev: "REV C",
    rotate: "rotate-2 translate-x-[48px]",
    z: "z-20",
    delay: "90ms",
    author: "Marcus",
    message: "Pushed the new empty-state spec to the sheet.",
    live: false,
  },
  {
    channel: "general",
    rev: "REV G",
    rotate: "rotate-0",
    z: "z-30",
    delay: "180ms",
    author: "Ada",
    message: "Standup moved to 9:15 — see you on the line.",
    live: true,
  },
] as const;

export function ChatPreviewMockup({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative isolate", className)}
    >
      {SHEETS.map((sheet) => (
        // Outer div holds the fanned rotation/offset (the resting position);
        // the inner div carries the one authored entrance, so the settle
        // animation never fights the fan's own transform.
        <div
          key={sheet.channel}
          className={cn("absolute inset-0 transition-transform", sheet.rotate, sheet.z)}
        >
          <div
            className="animate-fan-in flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+4px)] bg-card text-left shadow-sheet-lg"
            style={{ animationDelay: sheet.delay }}
          >
            <div className="title-block border-border px-4 py-2">
              <span>#{sheet.channel}</span>
              <span className="ml-auto font-tabular">{sheet.rev}</span>
              {sheet.live && (
                <span className="flex items-center gap-1 text-live">
                  <span className="size-1.5 rounded-full bg-live" />
                  live
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius-sm)-2px)] bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                  {sheet.author[0]}
                </span>
                <div>
                  <p className="text-xs font-semibold">{sheet.author}</p>
                  <p className="text-xs text-muted-foreground">{sheet.message}</p>
                </div>
              </div>
              {sheet.live && (
                <div className="mt-auto rounded-[calc(var(--radius-sm)-2px)] border border-dashed border-border px-3 py-2 font-mono text-[0.6875rem] tracking-[0.04em] text-muted-foreground uppercase">
                  typing&hellip;
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
