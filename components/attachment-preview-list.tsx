"use client";

import { useComposer } from "@/components/composer-provider";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

/** Thumbnails of the images queued for the next message, each removable. */
export function AttachmentPreviewList() {
  const { items, remove } = useComposer();
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Attached images">
      {items.map((item) => (
        <li key={item.id} className="relative size-16 overflow-hidden rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={item.previewUrl}
            alt={item.name}
            width={64}
            height={64}
            className={cn("size-full object-cover", item.status === "uploading" && "opacity-40")}
          />
          {item.status === "uploading" && (
            <>
              <Loader2
                aria-hidden
                className="absolute inset-0 m-auto size-4 animate-spin text-foreground"
              />
              <span role="status" className="sr-only">
                Uploading {item.name}…
              </span>
            </>
          )}
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            onClick={() => remove(item.id)}
            className="focus-ring absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
          >
            <X aria-hidden className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
