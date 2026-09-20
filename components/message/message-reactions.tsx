import { cn, pluralize } from "@/lib/utils";
import { SmilePlus } from "lucide-react";
import type { MessageReaction } from "./types";

/** Reaction chips under a message: click one to add or remove your own. */
export function MessageReactions({
  reactions,
  onToggle,
  onAdd,
}: {
  reactions: MessageReaction[];
  onToggle: (emoji: string) => void;
  onAdd: () => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          aria-pressed={r.reactedByMe}
          aria-label={`${r.emoji}, ${r.count} ${pluralize(r.count, "reaction")}${
            r.reactedByMe ? ", including yours" : ""
          }`}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "focus-ring inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
            r.reactedByMe
              ? "border-primary/40 bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="font-tabular">{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        aria-label="Add reaction"
        onClick={onAdd}
        className="focus-ring inline-flex h-6 items-center rounded-full border bg-background px-1.5 text-muted-foreground hover:bg-muted"
      >
        <SmilePlus aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
