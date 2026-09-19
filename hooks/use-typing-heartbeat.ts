"use client";

import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const HEARTBEAT_INTERVAL_MS = 3000;

/**
 * Tells the channel you're typing. Call `ping(text)` on every change (it
 * sends at most one heartbeat per interval, and only for non-empty text) and
 * `stop()` when the message is sent. Does nothing when `enabled` is false,
 * e.g. in thread replies.
 */
export function useTypingHeartbeat(channelId: Id<"channels">, enabled: boolean) {
  const heartbeat = useMutation(api.typing.heartbeat);
  const clearTyping = useMutation(api.typing.clear);
  const lastHeartbeat = useRef(0);

  const ping = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return;
      const now = Date.now();
      if (now - lastHeartbeat.current > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat.current = now;
        heartbeat({ channelId }).catch(() => {});
      }
    },
    [enabled, heartbeat, channelId],
  );

  const stop = useCallback(() => {
    if (enabled) clearTyping({ channelId }).catch(() => {});
  }, [enabled, clearTyping, channelId]);

  return { ping, stop };
}
