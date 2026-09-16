"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { convexErrorMessage } from "@/lib/convex-errors";
import { Pencil, Trash2, X, Check, Sparkles } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type MessageItem = {
  _id: Id<"messages">;
  _creationTime: number;
  authorId: Id<"users">;
  authorName: string;
  authorImageUrl?: string;
  authorDeleted: boolean;
  body: string;
  editedAt?: number;
};

function MessageRow({
  message,
  isOwn,
  canModerate,
}: {
  message: MessageItem;
  isOwn: boolean;
  canModerate: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const edit = useMutation(api.messages.edit);
  const remove = useMutation(api.messages.remove);

  async function saveEdit() {
    const body = draft.trim();
    if (!body) return;
    try {
      await edit({ messageId: message._id, body });
      setEditing(false);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't save your edit."));
    }
  }

  async function handleDelete() {
    try {
      await remove({ messageId: message._id });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't delete that message."));
    }
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-1.5 hover:bg-muted/50">
      <Avatar className="mt-0.5 size-8 shrink-0">
        <AvatarImage src={message.authorImageUrl} alt={message.authorName} />
        <AvatarFallback className="text-xs">{initials(message.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{message.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message._creationTime)}
          </span>
          {message.editedAt && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-16"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>
                <Check /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(message.body);
                  setEditing(false);
                }}
              >
                <X /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        )}
      </div>
      {!editing && (isOwn || canModerate) && (
        <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
          {isOwn && (
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={handleDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function MessageList({
  channelId,
  currentUserId,
  canModerate,
  orgSlug,
}: {
  channelId: Id<"channels">;
  currentUserId: Id<"users"> | undefined;
  canModerate: boolean;
  orgSlug: string;
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
      {chronological.length === 0 && status !== "LoadingFirstPage" && (
        <p className="flex-1 px-4 py-8 text-center text-sm text-muted-foreground">
          No messages yet. Say hello!
        </p>
      )}
      {chronological.map((message) => (
        <MessageRow
          key={message._id}
          message={message}
          isOwn={message.authorId === currentUserId}
          canModerate={canModerate}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
