"use client";

import { useId } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ComposerProvider } from "@/components/composer-provider";
import { DropZone } from "@/components/drop-zone";
import { LabeledRule } from "@/components/labeled-rule";
import { MessageComposer } from "@/components/message-composer";
import { MessageItem } from "@/components/message/message-item";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollToNewest } from "@/hooks/use-scroll-to-newest";
import { startsGroup } from "@/lib/messages";
import { pluralize } from "@/lib/utils";
import { X } from "lucide-react";

type ThreadProps = {
  rootId: Id<"messages">;
  channelId: Id<"channels">;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
  onClose: () => void;
};

/** The title row of a thread; `children` is the title element itself. */
function ThreadHeader({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
      {children}
      <Button variant="ghost" size="icon-sm" aria-label="Close thread" onClick={onClose}>
        <X aria-hidden />
      </Button>
    </header>
  );
}

function ThreadBody({ rootId, channelId, currentUserId, canModerate, onClose }: ThreadProps) {
  const thread = useQuery(api.messages.listThread, { rootId });
  const bottomRef = useScrollToNewest(thread?.replies.at(-1)?._id);

  if (thread === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <p>This thread is no longer available.</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const replyCount = thread?.replies.length ?? 0;

  return (
    <ComposerProvider>
      <DropZone>
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
                threadRootId={rootId}
              />
              <LabeledRule
                align="start"
                className="my-2"
                label={
                  <>
                    <span className="font-tabular">{replyCount}</span>{" "}
                    {pluralize(replyCount, "reply", "replies")}
                  </>
                }
              />
              {thread.replies.map((reply, i) => (
                <MessageItem
                  key={reply._id}
                  message={reply}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  isGroupStart={startsGroup(thread.replies[i - 1], reply)}
                  threadRootId={rootId}
                />
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>
        <MessageComposer channelId={channelId} threadRootId={rootId} placeholder="Reply in thread…" />
      </DropZone>
    </ComposerProvider>
  );
}

/**
 * A thread: the root message plus its replies and a composer that posts into
 * it. Sits beside the channel on desktop and becomes a sheet on small
 * screens, taking the member list's place.
 */
export function ThreadPanel(props: ThreadProps) {
  const isMobile = useIsMobile();
  const titleId = useId();

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && props.onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 data-[side=right]:sm:max-w-none"
        >
          <ThreadHeader onClose={props.onClose}>
            <SheetTitle>Thread</SheetTitle>
          </ThreadHeader>
          <ThreadBody {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside aria-labelledby={titleId} className="flex w-96 shrink-0 flex-col border-l">
      <ThreadHeader onClose={props.onClose}>
        <h2 id={titleId} className="font-semibold">
          Thread
        </h2>
      </ThreadHeader>
      <ThreadBody {...props} />
    </aside>
  );
}
