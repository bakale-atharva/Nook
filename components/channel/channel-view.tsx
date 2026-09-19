"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DELETED_USER_NAME } from "@/convex/lib/constants";
import {
  ChannelNotFound,
  ChannelSkeleton,
  JoinChannelPrompt,
} from "@/components/channel/channel-states";
import { ChannelHeader } from "@/components/channel/channel-header";
import { ChannelProvider } from "@/components/channel/channel-context";
import { ComposerProvider } from "@/components/composer-provider";
import { DropZone } from "@/components/drop-zone";
import { MemberSidebar } from "@/components/member-sidebar";
import { MessageComposer } from "@/components/message-composer";
import { MessageList } from "@/components/message-list";
import { ThreadPanel } from "@/components/thread-panel";
import { TypingIndicator } from "@/components/typing-indicator";
import { useChannelPanels } from "@/hooks/use-channel-panels";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMe } from "@/hooks/use-workspace-data";

/**
 * A channel or DM: header, the message list with its composer (members
 * only), and the member list or an open thread beside them.
 */
export function ChannelView({ slug, channelId }: { slug: string; channelId: Id<"channels"> }) {
  const panels = useChannelPanels();
  const { canModerate } = useOrgAccess();
  const channel = useQuery(api.channels.get, { channelId });
  const members = useQuery(api.channels.listMembers, { channelId });
  const me = useMe();
  const currentUserId = me?._id;

  const pane = useMemo(
    () => ({ channelId, orgSlug: slug, currentUserId, canModerate }),
    [channelId, slug, currentUserId, canModerate],
  );

  if (channel === undefined) return <ChannelSkeleton />;
  if (channel === null) return <ChannelNotFound />;

  const isMember = !!currentUserId && (members?.some((m) => m.userId === currentUserId) ?? false);
  const isDm = channel.dmKey !== undefined;
  // A DM is one-to-one: it's titled with the other person's name.
  const peer = members?.find((m) => m.userId !== currentUserId);
  const dmTitle = peer ? (peer.deleted ? DELETED_USER_NAME : peer.name) : "Direct message";
  const title = isDm ? dmTitle : channel.name;
  const composerPlaceholder = isDm ? `Message ${dmTitle}…` : `Message #${channel.name}…`;

  return (
    <ChannelProvider value={pane}>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChannelHeader
          channel={channel}
          title={title}
          isMember={isMember}
          membersActive={panels.membersVisible}
          onToggleMembers={panels.toggleMembers}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            {isMember ? (
              <ComposerProvider>
                <DropZone>
                  <MessageList onOpenThread={panels.openThread} />
                  <TypingIndicator />
                  <MessageComposer placeholder={composerPlaceholder} />
                </DropZone>
              </ComposerProvider>
            ) : (
              <JoinChannelPrompt channel={channel} />
            )}
          </div>
          {isMember && panels.threadRootId ? (
            <ThreadPanel rootId={panels.threadRootId} onClose={panels.closeThread} />
          ) : (
            panels.membersVisible && <MemberSidebar members={members} />
          )}
        </div>
      </div>
    </ChannelProvider>
  );
}
