"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { MessageAttachment } from "./types";

/** A message's images as thumbnails; clicking one opens it full size. */
export function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // An attachment whose file has been removed from storage has no URL.
  const images = attachments.flatMap((a) => (a.url ? [{ ...a, url: a.url }] : []));
  if (images.length === 0) return null;
  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {images.map((a, i) => (
          <button
            key={a.storageId}
            type="button"
            aria-label={`View ${a.name}`}
            onClick={() => setOpenIndex(i)}
            className="focus-ring overflow-hidden rounded-md border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL */}
            <img
              src={a.url}
              alt={a.name}
              width={a.width}
              height={a.height}
              loading="lazy"
              className="h-auto max-h-72 w-auto max-w-full object-cover"
            />
          </button>
        ))}
      </div>
      <Dialog open={current !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="w-fit max-w-[calc(100%-2rem)] gap-2 p-2 sm:max-w-[min(64rem,calc(100%-2rem))]">
          <DialogTitle className="sr-only">{current?.name ?? "Image"}</DialogTitle>
          {current && (
            // eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL
            <img
              src={current.url}
              alt={current.name}
              width={current.width}
              height={current.height}
              className="h-auto max-h-[80vh] w-auto max-w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
