"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChannelPane } from "@/components/channel/channel-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useToggleReaction } from "@/hooks/use-toggle-reaction";
import { toastConvexError } from "@/lib/convex-errors";
import { HEART_EMOJI } from "@/lib/emoji";
import { formatTime, isoTime } from "@/lib/time";
import { cn, pluralize } from "@/lib/utils";
import { MessageActions } from "./message-actions";
import { MessageAttachments } from "./message-attachments";
import { EditedTag, MessageBody } from "./message-body";
import { MessageEditForm } from "./message-edit-form";
import { MessageReactions } from "./message-reactions";
import { MessageThreadSummary } from "./message-thread-summary";
import type { MessageItemData } from "./types";

export type { MessageItemData };

/**
 * One message: author, body with @mention chips, images, reactions, the
 * thread summary, and a hover/focus action bar. Passing `onOpenThread` turns
 * on the thread summary and the "reply in thread" action; the rows inside the
 * thread panel itself leave it out.
 *
 * The row is focusable (Tab, or a tap on touch screens) so the action bar,
 * which appears while anything in the row has focus, is reachable without a
 * pointer.
 */
export function MessageItem({
  message,
  isGroupStart,
  threadRootId,
  onOpenThread,
}: {
  message: MessageItemData;
  isGroupStart: boolean;
  /** The open thread's root, so reaction updates reach the thread panel too. */
  threadRootId?: Id<"messages">;
  onOpenThread?: (rootId: Id<"messages">) => void;
}) {
  const { currentUserId, canModerate } = useChannelPane();
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const remove = useMutation(api.messages.remove);
  const toggleReaction = useToggleReaction(message.channelId, threadRootId);

  const isOwn = message.authorId === currentUserId;
  const hearted = message.reactions.some((r) => r.emoji === HEART_EMOJI && r.reactedByMe);
  const sentAt = formatTime(message._creationTime);
  const sentAtIso = isoTime(message._creationTime);

  async function handleDelete() {
    try {
      await remove({ messageId: message._id });
    } catch (err) {
      toastConvexError(err, "Couldn't delete that message.");
    }
  }

  return (
    <div
      tabIndex={0}
      className={cn(
        "focus-ring group relative flex items-start gap-3 px-4 hover:bg-muted/50 focus-within:bg-muted/50",
        isGroupStart ? "pt-2 pb-0.5" : "py-0.5",
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center">
        {isGroupStart ? (
          <UserAvatar
            name={message.authorName}
            imageUrl={message.authorImageUrl}
            className="size-8"
            fallbackClassName="text-xs"
          />
        ) : (
          <time
            dateTime={sentAtIso}
            className="font-tabular text-[0.6875rem] text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {sentAt}
          </time>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{message.authorName}</span>
            <time dateTime={sentAtIso} className="font-tabular text-xs text-muted-foreground">
              {sentAt}
            </time>
            {!!message.editedAt && <EditedTag />}
          </div>
        )}
        {editing ? (
          <MessageEditForm message={message} onDone={() => setEditing(false)} />
        ) : (
          <>
            {message.body && (
              <MessageBody
                body={message.body}
                mentionedUsers={message.mentionedUsers}
                currentUserId={currentUserId}
                edited={!isGroupStart && !!message.editedAt}
              />
            )}
            <MessageAttachments attachments={message.attachments} />
            <MessageReactions
              reactions={message.reactions}
              onToggle={(emoji) => void toggleReaction(message._id, emoji)}
              onAdd={() => setPickerOpen(true)}
            />
            {onOpenThread && (
              <MessageThreadSummary
                replyCount={message.replyCount}
                replyParticipants={message.replyParticipants}
                lastReplyAt={message.lastReplyAt}
                onOpen={() => onOpenThread(message._id)}
              />
            )}
          </>
        )}
      </div>
      {!editing && (
        <MessageActions
          hearted={hearted}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          onHeart={() => void toggleReaction(message._id, HEART_EMOJI)}
          onReact={(emoji) => void toggleReaction(message._id, emoji)}
          onReply={onOpenThread && (() => onOpenThread(message._id))}
          onEdit={isOwn ? () => setEditing(true) : undefined}
          onDelete={isOwn || canModerate ? () => setConfirmingDelete(true) : undefined}
        />
      )}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this message?"
        description={`This can't be undone.${
          message.replyCount > 0
            ? ` Its ${message.replyCount} ${pluralize(message.replyCount, "reply", "replies")} will be deleted too.`
            : ""
        }`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
