"use client";

import { ImagePlus } from "lucide-react";
import { useComposer } from "@/components/composer-provider";
import { useFileDrop } from "@/hooks/use-file-drop";
import { cn } from "@/lib/utils";

/**
 * Makes its whole area a drop target for images, with a blueprint-grid
 * overlay while a file is dragged over. Dropped files are added to the
 * surrounding <ComposerProvider>.
 */
export function DropZone({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { addFiles } = useComposer();
  const { active, dropProps } = useFileDrop((files) => void addFiles(files));

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)} {...dropProps}>
      {children}
      {active && (
        <div
          aria-hidden
          className="blueprint-grid pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/60 bg-background/90"
        >
          <ImagePlus className="size-6 text-primary" />
          <span className="text-label text-primary!">Drop images to attach</span>
        </div>
      )}
    </div>
  );
}
