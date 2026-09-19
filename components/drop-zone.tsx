"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

function carriesFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}

/**
 * Makes its whole area a drop target for images, with a blueprint-grid
 * overlay while a file is dragged over. Only file drags count, so dragging
 * text around the page doesn't light it up. Dropped files go to `onFiles`.
 */
export function DropZone({
  onFiles,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  // dragenter/leave also fire for every child element crossed, so count them.
  const depth = useRef(0);

  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      onDragEnter={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!carriesFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setActive(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {active && (
        <div
          aria-hidden
          className="blueprint-grid pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/60 bg-background/90"
        >
          <ImagePlus className="size-6 text-primary" />
          <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-primary uppercase">
            Drop images to attach
          </span>
        </div>
      )}
    </div>
  );
}
