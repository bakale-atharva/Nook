import { UserAvatar } from "@/components/user-avatar";
import { formatTime, isoTime } from "@/lib/time";
import { pluralize } from "@/lib/utils";
import type { MessageItemData } from "./types";

/** "N replies" under a thread root: who replied, how many, and when last. */
export function MessageThreadSummary({
  replyCount,
  replyParticipants,
  lastReplyAt,
  onOpen,
}: {
  replyCount: number;
  replyParticipants: MessageItemData["replyParticipants"];
  lastReplyAt: number | undefined;
  onOpen: () => void;
}) {
  if (replyCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring mt-1.5 flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs hover:bg-muted"
    >
      <span className="flex -space-x-1.5">
        {replyParticipants.map((p) => (
          <UserAvatar
            key={p.userId}
            name={p.name}
            imageUrl={p.imageUrl}
            className="size-5 ring-2 ring-background"
            fallbackClassName="text-[0.5rem]"
          />
        ))}
      </span>
      <span className="font-medium text-primary">
        <span className="font-tabular">{replyCount}</span> {pluralize(replyCount, "reply", "replies")}
      </span>
      {lastReplyAt !== undefined && (
        <time dateTime={isoTime(lastReplyAt)} className="font-tabular text-muted-foreground">
          {formatTime(lastReplyAt)}
        </time>
      )}
    </button>
  );
}
