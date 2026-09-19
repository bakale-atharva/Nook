"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a ref for a sentinel at the bottom of a scroll container, and
 * scrolls it into view whenever `newestId` changes (a new message arrived),
 * but not when older history is prepended above.
 */
export function useScrollToNewest(newestId: string | undefined) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (newestId) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  return bottomRef;
}
