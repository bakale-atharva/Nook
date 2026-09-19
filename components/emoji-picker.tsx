"use client";

import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from "@/lib/emoji";
import { cn } from "@/lib/utils";

const COLUMNS = 8;

const cellClass =
  "flex size-8 items-center justify-center rounded-md text-lg leading-none outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Curated emoji popover. `trigger` is the element that opens it (usually an
 * icon Button); selecting an emoji calls `onSelect` and closes the popover.
 * Arrow keys move between emoji, so it's fully keyboard-operable.
 */
export function EmojiPicker({
  trigger,
  onSelect,
  open,
  onOpenChange,
  side = "top",
  align = "end",
}: {
  trigger: React.ReactElement;
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  function choose(emoji: string) {
    onSelect(emoji);
    onOpenChange(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLUMNS,
      ArrowDown: COLUMNS,
    };
    const step = steps[e.key];
    if (step === undefined) return;
    const cells = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-emoji]") ?? [],
    );
    const index = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    e.preventDefault();
    cells[Math.min(cells.length - 1, Math.max(0, index + step))]?.focus();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent side={side} align={align} className="w-[19.5rem] gap-2 p-2">
        <div className="flex items-center gap-0.5 border-b pb-2">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              data-emoji
              aria-label={`React with ${emoji}`}
              className={cellClass}
              onClick={() => choose(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div
          ref={gridRef}
          onKeyDown={onKeyDown}
          className="scrollbar-hide max-h-64 overflow-y-auto"
        >
          {EMOJI_CATEGORIES.map((category) => (
            <section key={category.id} aria-label={category.label} className="pb-2">
              <h3 className="sticky top-0 bg-popover py-1 font-mono text-[0.6875rem] font-normal tracking-[0.06em] text-muted-foreground uppercase">
                {category.label}
              </h3>
              <div className={cn("grid gap-0.5")} style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
                {category.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    data-emoji
                    aria-label={emoji}
                    className={cellClass}
                    onClick={() => choose(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
