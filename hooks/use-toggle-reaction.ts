"use client";

import { useMutation, optimisticallyUpdateValueInPaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexErrorMessage } from "@/lib/convex-errors";

type Reactions = { emoji: string; count: number; reactedByMe: boolean }[];

function toggled(reactions: Reactions, emoji: string): Reactions {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, reactedByMe: true }];
  if (existing.reactedByMe) {
    return reactions.flatMap((r) =>
      r.emoji !== emoji ? [r] : r.count > 1 ? [{ ...r, count: r.count - 1, reactedByMe: false }] : [],
    );
  }
  return reactions.map((r) =>
    r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r,
  );
}

/**
 * Toggles the caller's reaction on a message. The chip updates instantly in
 * both the channel feed and the open thread; the server result then replaces
 * the guess, so a rejected toggle snaps back on its own.
 */
export function useToggleReaction(channelId: Id<"channels">, threadRootId?: Id<"messages">) {
  const toggle = useMutation(api.reactions.toggle).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateValueInPaginatedQuery(
        localStore,
        api.messages.list,
        { channelId },
        (m) =>
          m._id === args.messageId
            ? { ...m, reactions: toggled(m.reactions, args.emoji) }
            : m,
      );
      if (threadRootId) {
        const thread = localStore.getQuery(api.messages.listThread, { rootId: threadRootId });
        if (thread) {
          const apply = <T extends { _id: Id<"messages">; reactions: Reactions }>(m: T): T =>
            m._id === args.messageId ? { ...m, reactions: toggled(m.reactions, args.emoji) } : m;
          localStore.setQuery(
            api.messages.listThread,
            { rootId: threadRootId },
            { root: apply(thread.root), replies: thread.replies.map(apply) },
          );
        }
      }
    },
  );

  return async (messageId: Id<"messages">, emoji: string) => {
    try {
      await toggle({ messageId, emoji });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't update that reaction."));
    }
  };
}
