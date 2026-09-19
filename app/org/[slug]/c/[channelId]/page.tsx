"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { convexErrorMessage } from "@/lib/convex-errors";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Hash, Lock, LogOut, MessageSquare, Star, Trash2, Users } from "lucide-react";
import { MessageList } from "@/components/message-list";
import { MessageComposer } from "@/components/message-composer";
import { ComposerProvider } from "@/components/composer-provider";
import { TypingIndicator } from "@/components/typing-indicator";
import { MemberSidebar } from "@/components/member-sidebar";
import { ThreadPanel } from "@/components/thread-panel";
import { DropZone } from "@/components/drop-zone";

export default function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string; channelId: string }>;
}) {
  const { slug, channelId } = use(params);
  // Keyed by channel so an open thread never carries over to another channel.
  return <ChannelView key={channelId} slug={slug} channelId={channelId as Id<"channels">} />;
}

function ChannelView({ slug, channelId }: { slug: string; channelId: Id<"channels"> }) {
  const router = useRouter();
  const { has, isLoaded } = useAuth();
  const [showMembers, setShowMembers] = useState(true);
  const [threadRootId, setThreadRootId] = useState<Id<"messages"> | null>(null);

  const channel = useQuery(api.channels.get, { channelId });
  const members = useQuery(api.channels.listMembers, { channelId });
  const sidebarChannels = useQuery(api.channels.list);
  const join = useMutation(api.channels.join);
  const leave = useMutation(api.channels.leave);
  const remove = useMutation(api.channels.remove);
  const setStarred = useMutation(api.channels.setStarred);
  const me = useQuery(api.users.me);

  const canManage = isLoaded && !!has?.({ permission: "org:channels:manage" });
  const canModerate = isLoaded && !!has?.({ permission: "org:messages:moderate" });
  const isMember = !!me && (members?.some((m) => m.userId === me._id) ?? false);
  const starred = sidebarChannels?.find((c) => c._id === channelId)?.starred ?? false;

  if (channel === undefined) {
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
  if (channel === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        Channel not found.
      </div>
    );
  }

  const isDm = channel.dmKey !== undefined;
  const dmTitle =
    members
      ?.filter((m) => m.userId !== me?._id)
      .map((m) => (m.deleted ? "Deleted user" : m.name))
      .join(", ") || "Direct message";
  const title = isDm ? dmTitle : channel.name;
  const composerPlaceholder = isDm ? `Message ${dmTitle}…` : `Message #${channel.name}…`;

  async function handleJoin() {
    try {
      await join({ channelId });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't join channel."));
    }
  }

  async function handleLeave() {
    await leave({ channelId });
  }

  async function handleDelete() {
    if (!confirm(`Delete #${channel!.name}? This can't be undone.`)) return;
    await remove({ channelId });
    router.replace(`/org/${slug}`);
  }

  async function handleStar() {
    try {
      await setStarred({ channelId, starred: !starred });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't update your starred list."));
    }
  }

  function handleMembersToggle() {
    // With a thread open the member list is hidden; the toggle closes the
    // thread and brings the list back rather than doing nothing.
    if (threadRootId) {
      setThreadRootId(null);
      setShowMembers(true);
    } else {
      setShowMembers((v) => !v);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {isDm ? (
            <MessageSquare className="size-4 shrink-0" />
          ) : channel.isPrivate ? (
            <Lock className="size-4 shrink-0" />
          ) : (
            <Hash className="size-4 shrink-0" />
          )}
          <h1 className="truncate font-semibold">{title}</h1>
          {channel.description && (
            <span className="truncate text-sm text-muted-foreground">
              {channel.description}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isMember && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={starred ? "Remove from starred" : "Add to starred"}
              aria-pressed={starred}
              onClick={handleStar}
            >
              <Star className={cn(starred && "fill-primary text-primary")} />
            </Button>
          )}
          {!isDm && !channel.isPrivate && isMember && (
            <Button variant="outline" size="sm" onClick={handleLeave}>
              <LogOut /> Leave
            </Button>
          )}
          {!isDm && canManage && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button
            variant={showMembers && !threadRootId ? "secondary" : "ghost"}
            size="icon"
            aria-label="Toggle member list"
            onClick={handleMembersToggle}
          >
            <Users />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {isMember ? (
            <ComposerProvider>
              <DropZone>
                <MessageList
                  channelId={channelId}
                  currentUserId={me?._id}
                  canModerate={canModerate}
                  orgSlug={slug}
                  onOpenThread={setThreadRootId}
                />
                <TypingIndicator channelId={channelId} />
                <MessageComposer channelId={channelId} placeholder={composerPlaceholder} />
              </DropZone>
            </ComposerProvider>
          ) : (
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
          )}
        </div>
        {isMember && threadRootId ? (
          <ThreadPanel
            rootId={threadRootId}
            channelId={channelId}
            currentUserId={me?._id}
            canModerate={canModerate}
            onClose={() => setThreadRootId(null)}
          />
        ) : (
          showMembers && <MemberSidebar members={members} />
        )}
      </div>
    </div>
  );
}
