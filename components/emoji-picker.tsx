"use client";

import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from "@/lib/emoji";

// Keep in step with the `grid-cols-8` class on the grids below.
const COLUMNS = 8;

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -COLUMNS,
  ArrowDown: COLUMNS,
};

function EmojiButton({ emoji, onChoose }: { emoji: string; onChoose: (emoji: string) => void }) {
  return (
    <button
      type="button"
      data-emoji
      aria-label={`React with ${emoji}`}
      className="focus-ring flex size-8 items-center justify-center rounded-md text-lg leading-none hover:bg-muted"
      onClick={() => onChoose(emoji)}
    >
      {emoji}
    </button>
  );
}

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
    const step = ARROW_STEPS[e.key];
    if (step === undefined) return;
    const cells = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>("button[data-emoji]") ?? [],
    );
    const index = cells.indexOf(e.target as HTMLButtonElement);
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
            <EmojiButton key={emoji} emoji={emoji} onChoose={choose} />
          ))}
        </div>
        <div
          ref={gridRef}
          onKeyDown={onKeyDown}
          className="scrollbar-hide max-h-64 overflow-y-auto"
        >
          {EMOJI_CATEGORIES.map((category) => (
            <section key={category.id} aria-label={category.label} className="pb-2">
              <h3 className="text-label sticky top-0 bg-popover py-1 font-normal">
                {category.label}
              </h3>
              <div className="grid grid-cols-8 gap-0.5">
                {category.emojis.map((emoji) => (
                  <EmojiButton key={emoji} emoji={emoji} onChoose={choose} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
