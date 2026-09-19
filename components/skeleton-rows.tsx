import { Skeleton } from "@/components/ui/skeleton";

/** A stack of placeholder rows while a list loads; `className` sizes each row. */
export function SkeletonRows({
  count = 3,
  className = "h-8 w-full",
}: {
  count?: number;
  className?: string;
}) {
  return Array.from({ length: count }, (_, i) => <Skeleton key={i} className={className} />);
}
