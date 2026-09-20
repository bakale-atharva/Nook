"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/** A row of the caller's channel list (channels and DMs, with unread state). */
export type SidebarChannel = FunctionReturnType<typeof api.channels.list>[number];

/**
 * The caller's channels and DMs. Convex shares one subscription between every
 * component that asks, so use this wherever the list is needed.
 */
export function useChannels() {
  return useQuery(api.channels.list);
}

/** The caller's synced profile: undefined while loading, null before the first sync. */
export function useMe() {
  return useQuery(api.users.me);
}
