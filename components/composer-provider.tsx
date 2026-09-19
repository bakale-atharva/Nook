"use client";

import { createContext, use } from "react";
import { useAttachments } from "@/hooks/use-attachments";

type ComposerState = ReturnType<typeof useAttachments>;

const ComposerContext = createContext<ComposerState | null>(null);

/**
 * Owns the images being attached, so the drop zone, the composer input and
 * the preview list can be siblings that all see the same state (a file
 * dropped anywhere in the zone lands in the composer below).
 */
export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const attachments = useAttachments();
  return <ComposerContext value={attachments}>{children}</ComposerContext>;
}

export function useComposer(): ComposerState {
  const composer = use(ComposerContext);
  if (!composer) throw new Error("useComposer must be used inside <ComposerProvider>.");
  return composer;
}
