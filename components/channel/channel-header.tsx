"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/channel-icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useChannelPane } from "@/components/channel/channel-context";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useToggleStar } from "@/hooks/use-toggle-star";
import { useChannels } from "@/hooks/use-workspace-data";
import { toastConvexError } from "@/lib/convex-errors";
import { cn } from "@/lib/utils";
import { LogOut, Star, Trash2, Users } from "lucide-react";

/**
 * The channel's title row: name and description on the left; star, leave,
 * delete and the member-list toggle on the right, each only where it applies.
 */
export function ChannelHeader({
  channel,
  title,
  isMember,
  membersActive,
  onToggleMembers,
}: {
  channel: Doc<"channels">;
  title: string;
  isMember: boolean;
  /** Whether the member list is open beside the messages. */
  membersActive: boolean;
  onToggleMembers: () => void;
}) {
  const router = useRouter();
  const { orgSlug } = useChannelPane();
  const { canManageChannels } = useOrgAccess();
  const channels = useChannels();
  const toggleStar = useToggleStar();
  const leave = useMutation(api.channels.leave);
  const remove = useMutation(api.channels.remove);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isDm = channel.dmKey !== undefined;
  const starred = channels?.find((c) => c._id === channel._id)?.starred ?? false;

  async function handleLeave() {
    try {
      await leave({ channelId: channel._id });
    } catch (err) {
      toastConvexError(err, "Couldn't leave the channel.");
    }
  }

  async function handleDelete() {
    try {
      await remove({ channelId: channel._id });
      router.replace(`/org/${orgSlug}`);
    } catch (err) {
      toastConvexError(err, "Couldn't delete the channel.");
    }
  }

  return (
    <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <ChannelIcon isDm={isDm} isPrivate={channel.isPrivate} className="size-4 shrink-0" />
        <h1 className="truncate font-semibold">{title}</h1>
        {channel.description && (
          <span className="truncate text-sm text-muted-foreground">{channel.description}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isMember && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={isDm ? "Star conversation" : "Star channel"}
            aria-pressed={starred}
            onClick={() => void toggleStar(channel._id, !starred)}
          >
            <Star aria-hidden className={cn(starred && "fill-primary text-primary")} />
          </Button>
        )}
        {!isDm && !channel.isPrivate && isMember && (
          <Button variant="outline" size="sm" onClick={handleLeave}>
            <LogOut aria-hidden /> Leave
          </Button>
        )}
        {!isDm && canManageChannels && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
        )}
        <Button
          variant={membersActive ? "secondary" : "ghost"}
          size="icon"
          aria-label="Member list"
          aria-pressed={membersActive}
          onClick={onToggleMembers}
        >
          <Users aria-hidden />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete #${channel.name}?`}
        description="This can't be undone. Every message, reaction and image in the channel is deleted with it."
        confirmLabel="Delete channel"
        destructive
        onConfirm={handleDelete}
      />
    </header>
  );
}
