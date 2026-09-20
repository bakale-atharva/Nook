"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toastConvexError } from "@/lib/convex-errors";

/** Placeholder for the whole channel while it loads. */
export function ChannelSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Skeleton className="h-5 w-32" />
      </header>
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-3/5" />
      </div>
    </div>
  );
}

/** Shown for a channel that doesn't exist or that the viewer can't see. */
export function ChannelNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
      Channel not found.
    </div>
  );
}

/** Stands in for the messages when the viewer isn't in the channel. */
export function JoinChannelPrompt({ channel }: { channel: Doc<"channels"> }) {
  const join = useMutation(api.channels.join);

  async function handleJoin() {
    try {
      await join({ channelId: channel._id });
    } catch (err) {
      toastConvexError(err, "Couldn't join channel.");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <p>
        {channel.isPrivate
          ? "You're not a member of this private channel."
          : `Join #${channel.name} to see and send messages.`}
      </p>
      {!channel.isPrivate && (
        <Button variant="cta" size="sm" onClick={handleJoin}>
          Join channel
        </Button>
      )}
    </div>
  );
}
