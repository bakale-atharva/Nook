"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { convexErrorMessage } from "@/lib/convex-errors";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Hash, Lock, LogOut, Trash2 } from "lucide-react";
import { MessageList } from "@/components/message-list";
import { MessageComposer } from "@/components/message-composer";
import { TypingIndicator } from "@/components/typing-indicator";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string; channelId: string }>;
}) {
  const { slug, channelId } = use(params);
  const router = useRouter();
  const { has, isLoaded } = useAuth();

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

  if (channel === undefined) return null;
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
        </div>
      </header>

      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm text-muted-foreground">Members</span>
        <div className="flex -space-x-2">
          {members?.slice(0, 8).map((m) => (
            <Avatar key={m.userId} className="size-6 border-2 border-background">
              <AvatarImage src={m.imageUrl} alt={m.name} />
              <AvatarFallback className="text-[10px]">
                {initials(m.deleted ? "Deleted user" : m.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        {members && members.length > 8 && (
          <Badge variant="secondary">+{members.length - 8}</Badge>
        )}
        {!channel.isPrivate && !isMember && (
          <Button variant="link" size="sm" onClick={handleJoin}>
            Join channel
          </Button>
        )}
      </div>

      {isMember ? (
        <>
          <MessageList
            channelId={channelId as Id<"channels">}
            currentUserId={me?._id}
            canModerate={canModerate}
          />
          <TypingIndicator channelId={channelId as Id<"channels">} />
          <MessageComposer channelId={channelId as Id<"channels">} channelName={channel.name} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
          {channel.isPrivate
            ? "You're not a member of this private channel."
            : `Join #${channel.name} to see and send messages.`}
        </div>
      )}
    </div>
  );
}
