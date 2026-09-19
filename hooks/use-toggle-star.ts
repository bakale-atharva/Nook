"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toastConvexError } from "@/lib/convex-errors";

/** Stars or unstars a channel for the caller, toasting if it fails. */
export function useToggleStar() {
  const setStarred = useMutation(api.channels.setStarred);

  return async (channelId: Id<"channels">, starred: boolean) => {
    try {
      await setStarred({ channelId, starred });
    } catch (err) {
      toastConvexError(err, "Couldn't update your starred list.");
    }
  };
}
