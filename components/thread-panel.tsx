"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropZone } from "@/components/drop-zone";
import { MessageComposer, type ComposerHandle } from "@/components/message-composer";
import { MessageItem } from "@/components/message-item";
import { useIsMobile } from "@/hooks/use-mobile";
import { X } from "lucide-react";

// Same grouping window as the channel feed.
const GROUP_WINDOW_MS = 60_000;

type ThreadProps = {
  rootId: Id<"messages">;
  channelId: Id<"channels">;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
  onClose: () => void;
};

function ThreadBody({
  rootId,
  channelId,
  currentUserId,
  canModerate,
  onClose,
  title,
}: ThreadProps & { title: React.ReactNode }) {
  const thread = useQuery(api.messages.listThread, { rootId });
  const composer = useRef<ComposerHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const newestReplyId = thread?.replies.at(-1)?._id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestReplyId]);

  const replyCount = thread?.replies.length ?? 0;

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        {title}
        <Button variant="ghost" size="icon-sm" aria-label="Close thread" onClick={onClose}>
          <X />
        </Button>
      </header>
      {thread === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>This thread is no longer available.</p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <DropZone onFiles={(files) => composer.current?.addFiles(files)}>
          <div className="flex flex-1 flex-col overflow-y-auto py-2">
            {thread === undefined ? (
              <div className="space-y-3 px-4 py-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : (
              <>
                <MessageItem
                  message={thread.root}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  isGroupStart
                  variant="thread"
                  threadRootId={rootId}
                />
                <div className="my-2 flex items-center gap-3 px-4">
                  <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-muted-foreground uppercase">
                    <span className="font-tabular">{replyCount}</span>{" "}
                    {replyCount === 1 ? "reply" : "replies"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                {thread.replies.map((reply, i) => {
                  const prev = thread.replies[i - 1];
                  const isGroupStart =
                    !prev ||
                    prev.authorId !== reply.authorId ||
                    reply._creationTime - prev._creationTime > GROUP_WINDOW_MS;
                  return (
                    <MessageItem
                      key={reply._id}
                      message={reply}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      isGroupStart={isGroupStart}
                      variant="thread"
                      threadRootId={rootId}
                    />
                  );
                })}
              </>
            )}
            <div ref={bottomRef} />
          </div>
          <MessageComposer
            ref={composer}
            channelId={channelId}
            threadRootId={rootId}
            placeholder="Reply in thread"
          />
        </DropZone>
      )}
    </>
  );
}

/**
 * A thread: the root message plus its replies and a composer that posts into
 * it. Sits beside the channel on desktop and becomes a sheet on small
 * screens, taking the member list's place.
 */
export function ThreadPanel(props: ThreadProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && props.onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 data-[side=right]:sm:max-w-none"
        >
          <ThreadBody {...props} title={<SheetTitle>Thread</SheetTitle>} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label="Thread"
      className="flex w-96 shrink-0 flex-col border-l"
    >
      <ThreadBody {...props} title={<h2 className="font-semibold">Thread</h2>} />
    </aside>
  );
}
