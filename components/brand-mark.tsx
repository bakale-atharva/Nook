import { cn } from "@/lib/utils";

/** The "N" tile and the Nook wordmark. Colors come from the surrounding text color. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-[5px] bg-hero-live font-mono text-xs font-bold text-hero-live-foreground">
        N
      </span>
      <span className="font-heading text-lg font-semibold">Nook</span>
    </span>
  );
}
