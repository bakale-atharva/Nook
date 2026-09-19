"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkeletonRows } from "@/components/skeleton-rows";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useOrgSlug } from "@/hooks/use-org-slug";
import { useChannels } from "@/hooks/use-workspace-data";
import { MessageSquare } from "lucide-react";

/**
 * /org/[slug]: sends you to a channel. It prefers one you're already in, then
 * any public channel, and a DM only when there is nothing else; with no
 * channels at all it explains how to make the first one.
 */
export function WorkspaceHome() {
  const router = useRouter();
  const slug = useOrgSlug();
  const { canManageChannels } = useOrgAccess();
  const channels = useChannels();

  const target = channels
    ? (channels.find((c) => !c.isDm && c.isMember) ?? channels.find((c) => !c.isDm) ?? channels[0])
    : undefined;
  const targetId = target?._id;

  useEffect(() => {
    if (targetId) router.replace(`/org/${slug}/c/${targetId}`);
  }, [targetId, slug, router]);

  if (channels === undefined || target) {
    // Loading, or about to redirect.
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <SkeletonRows count={3} className="h-10 w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <MessageSquare aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-medium">No channels yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {canManageChannels
          ? "Create the first channel with the + button next to Channels in the sidebar."
          : "An admin can create the first channel from the sidebar's + button."}
      </p>
    </div>
  );
}
