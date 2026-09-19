"use client";

import { useRef, useState } from "react";

function carriesFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}

/**
 * Drop-target behavior for files: `dropProps` go on the element, `active` is
 * true while a file is dragged over it. Only file drags count, so dragging
 * text around the page doesn't light it up.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  // dragenter/leave also fire for every child element crossed, so count them.
  const depth = useRef(0);

  const dropProps = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setActive(true);
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      onFiles(Array.from(e.dataTransfer.files));
    },
  };

  return { active, dropProps };
}
