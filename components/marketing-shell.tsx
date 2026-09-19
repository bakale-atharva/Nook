import { cn } from "@/lib/utils";

export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="blueprint-grid scrollbar-hide flex h-dvh flex-col items-center justify-center overflow-y-auto bg-hero p-4 sm:p-8">
      <div
        className={cn(
          "relative flex w-full max-w-lg flex-col rounded-[calc(var(--radius-lg)+6px)] bg-card p-8 shadow-sheet-lg sm:p-10",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
