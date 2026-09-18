import { cn } from "@/lib/utils";

export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="hero-gradient scrollbar-hide flex h-dvh flex-col overflow-y-auto p-3 sm:p-6">
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-6xl flex-1 flex-col rounded-[2rem] border bg-card shadow-xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
