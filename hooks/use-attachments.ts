"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
} from "@/convex/lib/constants";
import { toastConvexError } from "@/lib/convex-errors";

export const ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(",");

export type PendingAttachment = {
  id: string;
  name: string;
  previewUrl: string;
  status: "uploading" | "ready";
  storageId?: Id<"_storage">;
  width?: number;
  height?: number;
};

function readDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Client-side state for images being attached to a message: validates each
 * file, uploads it straight to Convex storage, and tracks progress. The
 * server re-validates type and size when the message is sent.
 */
export function useAttachments() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [items, setItems] = useState<PendingAttachment[]>([]);
  // Mirrors `items` so addFiles can count synchronously across rapid drops.
  const itemsRef = useRef<PendingAttachment[]>([]);

  const commit = useCallback((next: PendingAttachment[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  // Preview URLs are revoked as items go away; this covers what's left on unmount.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, []);

  const addFiles = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input);
      if (files.length === 0) return;

      const accepted: File[] = [];
      let skipped = 0;
      for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          toast.error(`${file.name} isn't a supported image (PNG, JPEG, GIF or WebP).`);
        } else if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is larger than ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`);
        } else if (itemsRef.current.length + accepted.length >= MAX_ATTACHMENTS) {
          skipped += 1;
        } else {
          accepted.push(file);
        }
      }
      if (skipped > 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} images per message.`);
      }
      if (accepted.length === 0) return;

      const pending = accepted.map((file) => {
        const item: PendingAttachment = {
          id: crypto.randomUUID(),
          name: file.name || "image",
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
        };
        return { file, item };
      });
      commit([...itemsRef.current, ...pending.map((p) => p.item)]);

      await Promise.all(
        pending.map(async ({ file, item }) => {
          try {
            const [dims, uploadUrl] = await Promise.all([
              readDimensions(item.previewUrl),
              generateUploadUrl(),
            ]);
            const res = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (!res.ok) throw new Error("upload failed");
            const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
            // The user may have removed it while it uploaded.
            if (!itemsRef.current.some((i) => i.id === item.id)) return;
            commit(
              itemsRef.current.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "ready" as const,
                      storageId,
                      width: dims?.width,
                      height: dims?.height,
                    }
                  : i,
              ),
            );
          } catch (err) {
            toastConvexError(err, `Couldn't upload ${item.name}.`);
            commit(itemsRef.current.filter((i) => i.id !== item.id));
            URL.revokeObjectURL(item.previewUrl);
          }
        }),
      );
    },
    [commit, generateUploadUrl],
  );

  const remove = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id);
      commit(itemsRef.current.filter((i) => i.id !== id));
      if (target) URL.revokeObjectURL(target.previewUrl);
    },
    [commit],
  );

  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    commit([]);
  }, [commit]);

  const uploading = items.some((i) => i.status === "uploading");
  const ready = items.flatMap((i) =>
    i.status === "ready" && i.storageId
      ? [{ storageId: i.storageId, name: i.name, width: i.width, height: i.height }]
      : [],
  );

  return { items, addFiles, remove, clear, uploading, ready };
}
