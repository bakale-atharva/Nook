import { cn } from "@/lib/utils";

const rule = <span aria-hidden className="h-px flex-1 bg-border" />;

/**
 * A horizontal rule with a small label: centered between two rules (a date
 * divider), or at the start with one rule after it (a reply count).
 */
export function LabeledRule({
  label,
  align = "center",
  className,
}: {
  label: React.ReactNode;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4", className)}>
      {align === "center" && rule}
      <span className="text-label">{label}</span>
      {rule}
    </div>
  );
}
