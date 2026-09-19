"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageItem } from "@/components/message-item";
import { formatDayLabel, sameDay } from "@/lib/time";
import { Sparkles } from "lucide-react";

// Consecutive messages from the same author land in one visual group —
// avatar and name shown once — when they're this close together.
const GROUP_WINDOW_MS = 60_000;

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3 px-4">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevNewestId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // results[0] is the newest message (server order is newest-first, see
    // messages.list). Only auto-scroll when THAT changes — a new send —
    // not when "Load older" prepends more history further down.
    const newestId = results[0]?._id;
    if (newestId && newestId !== prevNewestId.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
    prevNewestId.current = newestId;
  }, [results]);

  useEffect(() => {
    // Mark caught-up whenever the newest page changes while this channel
    // is open (covers both the initial load and new incoming messages).
    if (currentUserId && status !== "LoadingFirstPage") {
      markRead({ channelId }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, currentUserId, results[0]?._id, status]);

  const chronological = [...results].reverse();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-2">
      {historyHidden && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 shrink-0" />
          <span className="flex-1">
            Free plan shows only the last 30 messages.
          </span>
          <Link href={`/org/${orgSlug}/upgrade`} className="font-medium text-foreground underline">
            Upgrade to Pro
          </Link>
        </div>
      )}
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
      {status === "LoadingFirstPage" && (
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
      )}
      {chronological.length === 0 && status !== "LoadingFirstPage" && (
        <p className="flex-1 px-4 py-8 text-center text-sm text-muted-foreground">
          No messages yet. Say hello!
        </p>
      )}
      {chronological.map((message, i) => {
        const prev = chronological[i - 1];
        const dayChanged = !prev || !sameDay(prev._creationTime, message._creationTime);
        const dayLabel = dayChanged ? formatDayLabel(message._creationTime) : null;
        const isGroupStart =
          dayChanged ||
          prev.authorId !== message.authorId ||
          message._creationTime - prev._creationTime > GROUP_WINDOW_MS;

        return (
          <div key={message._id}>
            {dayLabel && <DateDivider label={dayLabel} />}
            <MessageItem
              message={message}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isGroupStart={isGroupStart}
              onOpenThread={onOpenThread}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
