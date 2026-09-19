"use client";

import { useParams, useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

/** The slug of the workspace the current /org/[slug] route belongs to. */
export function useOrgSlug(): string {
  return useParams<{ slug: string }>().slug;
}

/** Returns a function that navigates to a channel or DM in the current workspace. */
export function useOpenChannel() {
  const router = useRouter();
  const slug = useOrgSlug();
  return (channelId: Id<"channels">) => router.push(`/org/${slug}/c/${channelId}`);
}
