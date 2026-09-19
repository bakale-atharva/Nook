import { HeroStage } from "@/components/hero-stage";
import { cn } from "@/lib/utils";

export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <HeroStage>
      <div
        className={cn(
          "relative flex w-full max-w-lg flex-col rounded-[calc(var(--radius-lg)+6px)] bg-card p-8 shadow-sheet-lg sm:p-10",
          className
        )}
      >
        {children}
      </div>
    </HeroStage>
  );
}
