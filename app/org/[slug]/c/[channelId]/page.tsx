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
import { Hash, Lock, LogOut, Trash2, Users } from "lucide-react";
import { MessageList } from "@/components/message-list";
import { MessageComposer } from "@/components/message-composer";
import { TypingIndicator } from "@/components/typing-indicator";
import { MemberSidebar } from "@/components/member-sidebar";

export default function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string; channelId: string }>;
}) {
  const { slug, channelId } = use(params);
  const router = useRouter();
  const { has, isLoaded } = useAuth();
  const [showMembers, setShowMembers] = useState(true);

  const channel = useQuery(api.channels.get, {
    channelId: channelId as Id<"channels">,
  });
  const members = useQuery(api.channels.listMembers, {
    channelId: channelId as Id<"channels">,
  });
  const join = useMutation(api.channels.join);
  const leave = useMutation(api.channels.leave);
  const remove = useMutation(api.channels.remove);
  const me = useQuery(api.users.me);

  const canManage = isLoaded && !!has?.({ permission: "org:channels:manage" });
  const canModerate = isLoaded && !!has?.({ permission: "org:messages:moderate" });
  const isMember = !!me && (members?.some((m) => m.userId === me._id) ?? false);

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

  async function handleJoin() {
    try {
      await join({ channelId: channelId as Id<"channels"> });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't join channel."));
    }
  }

  async function handleLeave() {
    await leave({ channelId: channelId as Id<"channels"> });
  }

  async function handleDelete() {
    if (!confirm(`Delete #${channel!.name}? This can't be undone.`)) return;
    await remove({ channelId: channelId as Id<"channels"> });
    router.replace(`/org/${slug}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {channel.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}
          <h1 className="font-semibold">{channel.name}</h1>
          {channel.description && (
            <span className="text-sm text-muted-foreground">
              {channel.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!channel.isPrivate && isMember && (
            <Button variant="outline" size="sm" onClick={handleLeave}>
              <LogOut /> Leave
            </Button>
          )}
          {canManage && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button
            variant={showMembers ? "secondary" : "ghost"}
            size="icon"
            aria-label="Toggle member list"
            onClick={() => setShowMembers((v) => !v)}
          >
            <Users />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          {isMember ? (
            <>
              <MessageList
                channelId={channelId as Id<"channels">}
                currentUserId={me?._id}
                canModerate={canModerate}
                orgSlug={slug}
              />
              <TypingIndicator channelId={channelId as Id<"channels">} />
              <MessageComposer channelId={channelId as Id<"channels">} channelName={channel.name} />
            </>
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
        {showMembers && <MemberSidebar members={members} />}
      </div>
    </div>
  );
}
