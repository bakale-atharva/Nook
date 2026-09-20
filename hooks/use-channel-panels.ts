"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * The right-hand side of a channel: the member list or an open thread, never
 * both. Opening a thread hides the members; the members button then closes
 * the thread and brings the list back instead of doing nothing.
 */
export function useChannelPanels() {
  const [showMembers, setShowMembers] = useState(true);
  const [threadRootId, setThreadRootId] = useState<Id<"messages"> | null>(null);

  return {
    threadRootId,
    membersVisible: showMembers && !threadRootId,
    openThread: setThreadRootId,
    closeThread: () => setThreadRootId(null),
    toggleMembers: () => {
      if (threadRootId) {
        setThreadRootId(null);
        setShowMembers(true);
      } else {
        setShowMembers((visible) => !visible);
      }
    },
  };
}
