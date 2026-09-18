import { cn } from "@/lib/utils";

const CHANNELS = ["general", "design", "engineering"];

const MESSAGES = [
  { name: "Ari", text: "Shipped the new empty state 🎉" },
  { name: "Sam", text: "Looks great — pushing to prod now." },
];

export function ChatPreviewMockup({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-2xl",
        className
      )}
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-chart-1/60" />
        <span className="size-2.5 rounded-full bg-chart-2/60" />
        <span className="ml-3 text-xs font-medium text-muted-foreground">
          # design
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r p-3 sm:flex">
          {CHANNELS.map((name, i) => (
            <span
              key={name}
              className={cn(
                "truncate rounded-md px-2 py-1.5 text-left text-xs",
                i === 1
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              # {name}
            </span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 text-left">
          {MESSAGES.map((m) => (
            <div key={m.name} className="flex items-start gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {m.name[0]}
              </span>
              <div>
                <p className="text-xs font-semibold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.text}</p>
              </div>
            </div>
          ))}
          <div className="mt-1 rounded-full border bg-background px-3 py-2 text-xs text-muted-foreground">
            Message #design
          </div>
        </div>
      </div>
    </div>
  );
}
