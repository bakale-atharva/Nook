"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LabeledRule } from "@/components/labeled-rule";
import { MessageItem } from "@/components/message/message-item";
import { useScrollToNewest } from "@/hooks/use-scroll-to-newest";
import { startsGroup } from "@/lib/messages";
import { formatDayLabel, sameDay } from "@/lib/time";
import { Sparkles } from "lucide-react";

function HistoryHiddenBanner({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <Sparkles aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">Free plan shows only the last 30 messages.</span>
      <Link
        href={`/org/${orgSlug}/upgrade`}
        className="focus-ring rounded-sm font-medium text-foreground underline"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="space-y-3 px-4 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  channelId,
  currentUserId,
  canModerate,
  orgSlug,
  onOpenThread,
}: {
  channelId: Id<"channels">;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
  orgSlug: string;
  onOpenThread: (rootId: Id<"messages">) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 30 },
  );
  const historyHidden = useQuery(api.messages.historyHidden, { channelId });
  const markRead = useMutation(api.messages.markRead);
  // results[0] is the newest message (server order is newest-first, see
  // messages.list). Scroll only when THAT changes — a new send — not when
  // "Load older" prepends more history further up.
  const newestId = results[0]?._id;
  const bottomRef = useScrollToNewest(newestId);

  useEffect(() => {
    // Mark caught-up whenever the newest message changes while this channel
    // is open (covers both the initial load and new incoming messages).
    if (currentUserId && status !== "LoadingFirstPage") {
      markRead({ channelId }).catch(() => {});
    }
  }, [channelId, currentUserId, newestId, status, markRead]);

  const chronological = results.toReversed();

  return (
    <div
      role="log"
      aria-label="Messages"
      aria-relevant="additions"
      className="flex flex-1 flex-col overflow-y-auto py-2"
    >
      {historyHidden && <HistoryHiddenBanner orgSlug={orgSlug} />}
      {status === "CanLoadMore" && (
        <div className="flex justify-center pb-2">
          <Button variant="outline" size="sm" onClick={() => loadMore(30)}>
            Load older messages
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <p className="pb-2 text-center text-xs text-muted-foreground">Loading…</p>
      )}
      {status === "LoadingFirstPage" && <MessageListSkeleton />}
      {chronological.length === 0 && status !== "LoadingFirstPage" && (
        <p className="flex-1 px-4 py-8 text-center text-sm text-muted-foreground">
          No messages yet. Say hello!
        </p>
      )}
      {chronological.map((message, i) => {
        const prev = chronological[i - 1];
        const dayChanged = !prev || !sameDay(prev._creationTime, message._creationTime);
        return (
          <Fragment key={message._id}>
            {dayChanged && (
              <LabeledRule label={formatDayLabel(message._creationTime)} className="my-3" />
            )}
            <MessageItem
              message={message}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isGroupStart={startsGroup(prev, message, { breakOnDay: true })}
              onOpenThread={onOpenThread}
            />
          </Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
