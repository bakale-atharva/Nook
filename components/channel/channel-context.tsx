"use client";

import { createContext, use } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/** The facts about the open channel and the viewer that everything inside it needs. */
export type ChannelPane = {
  channelId: Id<"channels">;
  orgSlug: string;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
};

const ChannelContext = createContext<ChannelPane | null>(null);

/**
 * Provides the open channel's identity to the message list, thread panel,
 * message rows and composer, so they read it instead of passing it down
 * through every layer.
 */
export function ChannelProvider({
  value,
  children,
}: {
  value: ChannelPane;
  children: React.ReactNode;
}) {
  return <ChannelContext value={value}>{children}</ChannelContext>;
}

export function useChannelPane(): ChannelPane {
  const pane = use(ChannelContext);
  if (!pane) throw new Error("useChannelPane must be used inside <ChannelProvider>.");
  return pane;
}
