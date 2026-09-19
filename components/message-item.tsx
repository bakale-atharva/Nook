"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiPicker } from "@/components/emoji-picker";
import { MentionTextarea } from "@/components/mention-textarea";
import { useToggleReaction } from "@/hooks/use-toggle-reaction";
import { convexErrorMessage } from "@/lib/convex-errors";
import { HEART_EMOJI } from "@/lib/emoji";
import { decodeMentions, encodeMentions, splitBody } from "@/lib/mentions";
import { formatTime } from "@/lib/time";
import { cn, initials } from "@/lib/utils";
import {
  Check,
  Heart,
  MessageSquareReply,
  Pencil,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";

export type MessageItemData = FunctionReturnType<typeof api.messages.list>["page"][number];

const iconButton = "size-7";

function EditedTag() {
  return (
    <span className="font-mono text-[0.6875rem] tracking-[0.04em] text-muted-foreground uppercase">
      edited
    </span>
  );
}

/** Renders a stored body: plain text, with `<@id>` tokens as @Name chips. */
function MessageBody({
  message,
  currentUserId,
  trailing,
}: {
  message: MessageItemData;
  currentUserId: Id<"users"> | undefined;
  trailing?: React.ReactNode;
}) {
  const names = new Map<string, string>(message.mentionedUsers.map((u) => [u.id, u.name]));
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {splitBody(message.body).map((segment, i) =>
        segment.type === "text" ? (
          <Fragment key={i}>{segment.text}</Fragment>
        ) : (
          <span
            key={i}
            className={cn(
              "rounded-sm px-1 font-medium text-primary",
              segment.id === currentUserId ? "bg-primary/20" : "bg-primary/10",
            )}
          >
            @{names.get(segment.id) ?? "unknown"}
          </span>
        ),
      )}
      {trailing}
    </p>
  );
}

function EditForm({
  message,
  onDone,
}: {
  message: MessageItemData;
  onDone: () => void;
}) {
  const edit = useMutation(api.messages.edit);
  const members = useQuery(api.users.listOrgMembers) ?? [];
  const [draft, setDraft] = useState(() =>
    decodeMentions(message.body, message.mentionedUsers),
  );
  const [mentionMap] = useState(
    () => new Map<string, string>(message.mentionedUsers.map((u) => [u.name, u.id])),
  );
  const hasImages = message.attachments.length > 0;

  async function save() {
    const text = draft.trim();
    if (!text && !hasImages) return;
    try {
      await edit({ messageId: message._id, body: encodeMentions(text, mentionMap) });
      onDone();
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't save your edit."));
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      <MentionTextarea
        value={draft}
        onValueChange={setDraft}
        members={members}
        onMentionPicked={(name, userId) => mentionMap.set(name, userId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            onDone();
          }
        }}
        className="min-h-16"
        autoFocus
        aria-label="Edit message"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>
          <Check /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          <X /> Cancel
        </Button>
      </div>
    </div>
  );
}

function Attachments({ message }: { message: MessageItemData }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const images = message.attachments.filter((a) => a.url);
  if (images.length === 0) return null;
  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {images.map((a, i) => (
          <button
            key={a.storageId}
            type="button"
            aria-label={`View ${a.name}`}
            onClick={() => setOpenIndex(i)}
            className="overflow-hidden rounded-md border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL */}
            <img
              src={a.url!}
              alt={a.name}
              width={a.width}
              height={a.height}
              loading="lazy"
              className="h-auto max-h-72 w-auto max-w-full object-cover"
            />
          </button>
        ))}
      </div>
      <Dialog open={current !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="w-fit max-w-[calc(100%-2rem)] gap-2 p-2 sm:max-w-[min(64rem,calc(100%-2rem))]">
          <DialogTitle className="sr-only">{current?.name ?? "Image"}</DialogTitle>
          {current && (
            // eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL
            <img
              src={current.url!}
              alt={current.name}
              className="max-h-[80vh] max-w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReactionBar({
  message,
  onToggle,
  onAdd,
}: {
  message: MessageItemData;
  onToggle: (emoji: string) => void;
  onAdd: () => void;
}) {
  if (message.reactions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {message.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          aria-pressed={r.reactedByMe}
          aria-label={`${r.emoji}, ${r.count} ${r.count === 1 ? "reaction" : "reactions"}${
            r.reactedByMe ? ", including yours" : ""
          }`}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            r.reactedByMe
              ? "border-primary/40 bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="font-tabular">{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        aria-label="Add reaction"
        onClick={onAdd}
        className="inline-flex h-6 items-center rounded-full border bg-background px-1.5 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SmilePlus className="size-3.5" />
      </button>
    </div>
  );
}

function ThreadSummary({
  message,
  onOpen,
}: {
  message: MessageItemData;
  onOpen: () => void;
}) {
  if (message.replyCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1.5 flex items-center gap-2 rounded-md py-0.5 pr-2 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex -space-x-1.5">
        {message.replyParticipants.map((p) => (
          <Avatar key={p.userId} className="size-5 ring-2 ring-background">
            <AvatarImage src={p.imageUrl} alt="" />
            <AvatarFallback className="text-[0.5rem]">{initials(p.name)}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span className="font-medium text-primary">
        <span className="font-tabular">{message.replyCount}</span>{" "}
        {message.replyCount === 1 ? "reply" : "replies"}
      </span>
      {message.lastReplyAt && (
        <span className="font-tabular text-muted-foreground">
          {formatTime(message.lastReplyAt)}
        </span>
      )}
    </button>
  );
}

/**
 * One message: author, body with @mention chips, images, reactions, the
 * thread summary, and a hover/focus action bar (heart, react, reply, edit,
 * delete). `variant="thread"` is the row inside the thread panel, which has
 * no "reply in thread" action or reply summary of its own.
 */
export function MessageItem({
  message,
  currentUserId,
  canModerate,
  isGroupStart,
  variant = "feed",
  threadRootId,
  onOpenThread,
}: {
  message: MessageItemData;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
  isGroupStart: boolean;
  variant?: "feed" | "thread";
  /** The open thread's root, so reaction updates reach the thread panel too. */
  threadRootId?: Id<"messages">;
  onOpenThread?: (rootId: Id<"messages">) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const remove = useMutation(api.messages.remove);
  const toggleReaction = useToggleReaction(message.channelId, threadRootId);

  const isOwn = message.authorId === currentUserId;
  const hearted = message.reactions.some((r) => r.emoji === HEART_EMOJI && r.reactedByMe);
  const canReply = variant === "feed" && !message.threadRootId && !!onOpenThread;

  async function handleDelete() {
    try {
      await remove({ messageId: message._id });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't delete that message."));
    }
  }

  const editedInline = !isGroupStart && message.editedAt && (
    <span className="ml-1.5">
      <EditedTag />
    </span>
  );

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 hover:bg-muted/50 focus-within:bg-muted/50",
        isGroupStart ? "pt-2 pb-0.5" : "py-0.5",
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center">
        {isGroupStart ? (
          <Avatar className="size-8">
            <AvatarImage src={message.authorImageUrl} alt={message.authorName} />
            <AvatarFallback className="text-xs">{initials(message.authorName)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="hidden font-tabular text-[0.6875rem] text-muted-foreground group-hover:inline">
            {formatTime(message._creationTime)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{message.authorName}</span>
            <span className="font-tabular text-xs text-muted-foreground">
              {formatTime(message._creationTime)}
            </span>
            {message.editedAt && <EditedTag />}
          </div>
        )}
        {editing ? (
          <EditForm message={message} onDone={() => setEditing(false)} />
        ) : (
          <>
            {message.body && (
              <MessageBody
                message={message}
                currentUserId={currentUserId}
                trailing={editedInline}
              />
            )}
            <Attachments message={message} />
            <ReactionBar
              message={message}
              onToggle={(emoji) => void toggleReaction(message._id, emoji)}
              onAdd={() => setPickerOpen(true)}
            />
            {variant === "feed" && onOpenThread && (
              <ThreadSummary message={message} onOpen={() => onOpenThread(message._id)} />
            )}
          </>
        )}
      </div>
      {!editing && (
        <div
          className={cn(
            "absolute -top-3 right-4 z-10 items-center gap-0.5 rounded-md border bg-background p-0.5",
            // Stay open while the emoji popover is up, even once the pointer
            // has left the row for the popover.
            pickerOpen ? "flex" : "hidden group-focus-within:flex group-hover:flex",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className={iconButton}
            aria-label={hearted ? "Remove heart" : "Heart this message"}
            aria-pressed={hearted}
            title="Heart"
            onClick={() => void toggleReaction(message._id, HEART_EMOJI)}
          >
            <Heart className={cn("size-3.5", hearted && "fill-primary text-primary")} />
          </Button>
          <EmojiPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(emoji) => void toggleReaction(message._id, emoji)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={iconButton}
                aria-label="Add reaction"
                title="Add reaction"
              >
                <SmilePlus className="size-3.5" />
              </Button>
            }
          />
          {canReply && (
            <Button
              variant="ghost"
              size="icon"
              className={iconButton}
              aria-label="Reply in thread"
              title="Reply in thread"
              onClick={() => onOpenThread?.(message._id)}
            >
              <MessageSquareReply className="size-3.5" />
            </Button>
          )}
          {isOwn && (
            <Button
              variant="ghost"
              size="icon"
              className={iconButton}
              aria-label="Edit message"
              title="Edit"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {(isOwn || canModerate) && (
            <Button
              variant="ghost"
              size="icon"
              className={iconButton}
              aria-label="Delete message"
              title="Delete"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
