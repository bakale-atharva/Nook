"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";
import { FREE_CHANNEL_LIMIT } from "@/convex/lib/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelIcon } from "@/components/channel-icon";
import { CreateChannelDialog } from "@/components/create-channel-dialog";
import { NewDmDialog } from "@/components/new-dm-dialog";
import { useUpgradePrompt } from "@/components/upgrade-provider";
import { UserAvatar } from "@/components/user-avatar";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useToggleStar } from "@/hooks/use-toggle-star";
import { useChannels, useMe, type SidebarChannel } from "@/hooks/use-workspace-data";
import { cn } from "@/lib/utils";
import { Lock, Settings, Sparkles, Star } from "lucide-react";

// The unread badge gives way to the star button while the row is hovered or focused.
const HIDE_ON_ROW_HOVER =
  "group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0";

function ChannelBadge({ channel }: { channel: SidebarChannel }) {
  if (channel.mentionCount > 0) {
    return (
      <SidebarMenuBadge
        aria-label={`${channel.mentionCount} unread mentions`}
        className={cn(
          "bg-live font-tabular text-live-foreground md:peer-hover/menu-button:text-live-foreground",
          HIDE_ON_ROW_HOVER,
        )}
      >
        @{channel.mentionCount}
      </SidebarMenuBadge>
    );
  }
  if (channel.unreadCount > 0) {
    return (
      <SidebarMenuBadge className={cn("font-tabular text-live", HIDE_ON_ROW_HOVER)}>
        {channel.unreadCapped ? "99+" : channel.unreadCount}
      </SidebarMenuBadge>
    );
  }
  return null;
}

/** One channel or DM in the sidebar: link, star button and unread badge. */
function ChannelRow({
  channel,
  slug,
  meId,
}: {
  channel: SidebarChannel;
  slug: string;
  meId: Id<"users"> | undefined;
}) {
  const pathname = usePathname();
  const toggleStar = useToggleStar();
  const href = `/org/${slug}/c/${channel._id}`;
  // A DM is one-to-one: it's named after, and shows the avatar of, the other person.
  const peer = channel.isDm ? channel.dmMembers.find((m) => m.userId !== meId) : undefined;
  const label = channel.isDm ? (peer?.name ?? "Direct message") : channel.name;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={pathname === href} render={<Link href={href} />}>
        {peer ? (
          <UserAvatar
            name={peer.name}
            imageUrl={peer.imageUrl}
            className="size-4"
            fallbackClassName="text-[0.5rem] text-foreground"
          />
        ) : (
          <ChannelIcon
            isDm={channel.isDm}
            isPrivate={channel.isPrivate}
            className="opacity-70"
          />
        )}
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
      {channel.isMember && (
        // Hidden on phones, where the star lives in the channel header instead.
        <SidebarMenuAction
          showOnHover
          className="max-md:hidden"
          aria-label={channel.starred ? `Unstar ${label}` : `Star ${label}`}
          onClick={() => void toggleStar(channel._id, !channel.starred)}
        >
          <Star className={cn(channel.starred && "fill-current")} />
        </SidebarMenuAction>
      )}
      <ChannelBadge channel={channel} />
    </SidebarMenuItem>
  );
}

function ChannelRows({
  channels,
  slug,
  meId,
}: {
  channels: SidebarChannel[];
  slug: string;
  meId: Id<"users"> | undefined;
}) {
  return channels.map((channel) => (
    <ChannelRow key={channel._id} channel={channel} slug={slug} meId={meId} />
  ));
}

/** A titled group of sidebar rows, with an optional action beside the title. */
function SidebarSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span>{label}</span>
        {action}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function MenuNote({ children }: { children: React.ReactNode }) {
  return (
    <SidebarMenuItem>
      <p className="px-2 py-1 text-sm text-muted-foreground">{children}</p>
    </SidebarMenuItem>
  );
}

function MenuSkeleton({ count = 1 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <SidebarMenuItem key={i}>
      <Skeleton className="h-8 w-full" />
    </SidebarMenuItem>
  ));
}

/**
 * The workspace sidebar: org switcher and plan, then Starred, Channels and
 * Direct messages (a Pro feature; Free orgs see an upgrade prompt), and
 * settings.
 */
export function WorkspaceSidebar({ slug }: { slug: string }) {
  const { organization } = useOrganization();
  const access = useOrgAccess();
  const channels = useChannels();
  const me = useMe();
  const promptUpgrade = useUpgradePrompt();

  const starred = channels?.filter((c) => c.starred && c.isMember) ?? [];
  const regular = channels?.filter((c) => !c.isDm && !(c.starred && c.isMember)) ?? [];
  const dms = channels?.filter((c) => c.isDm && !c.starred) ?? [];
  const channelCount = channels?.filter((c) => !c.isDm).length ?? 0;
  const meId = me?._id;

  let channelRows: React.ReactNode;
  if (channels === undefined) {
    channelRows = <MenuSkeleton count={3} />;
  } else if (regular.length === 0 && starred.length === 0) {
    channelRows = <MenuNote>No channels yet.</MenuNote>;
  } else {
    channelRows = <ChannelRows channels={regular} slug={slug} meId={meId} />;
  }

  let dmRows: React.ReactNode;
  if (!access.isLoaded || channels === undefined) {
    dmRows = <MenuSkeleton />;
  } else if (!access.hasDms) {
    dmRows = (
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => promptUpgrade("direct_messages")}>
          <Lock aria-hidden className="opacity-70" />
          <span className="truncate">Direct messages · Pro</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  } else if (channels.every((c) => !c.isDm)) {
    dmRows = <MenuNote>No conversations yet.</MenuNote>;
  } else {
    dmRows = <ChannelRows channels={dms} slug={slug} meId={meId} />;
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-2 p-2">
        <div className="clerk-on-sidebar">
          <OrganizationSwitcher
            afterSelectOrganizationUrl="/org/:slug"
            afterCreateOrganizationUrl="/org/:slug"
            hidePersonal
          />
        </div>
        <div className="flex items-center justify-between px-1">
          <Badge variant={access.isPro ? "default" : "secondary"}>
            {access.isPro ? "Pro" : "Free"}
          </Badge>
          {organization && (
            <span className="font-tabular text-xs text-sidebar-foreground/70">
              {organization.membersCount}/{organization.maxAllowedMemberships} members
            </span>
          )}
        </div>
        {!access.isPro && (
          <Button
            variant="cta"
            size="sm"
            nativeButton={false}
            className="w-full justify-center"
            render={<Link href={`/org/${slug}/upgrade`} />}
          >
            <Sparkles aria-hidden className="size-3.5" /> Upgrade to Pro
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        {starred.length > 0 && (
          <SidebarSection label="Starred">
            <ChannelRows channels={starred} slug={slug} meId={meId} />
          </SidebarSection>
        )}
        <SidebarSection
          label="Channels"
          action={access.canManageChannels && <CreateChannelDialog />}
        >
          {channelRows}
        </SidebarSection>
        {!access.hasUnlimitedChannels && channels !== undefined && (
          <div className="px-4">
            <Badge variant="secondary" className="w-fit">
              {channelCount}/{FREE_CHANNEL_LIMIT} channels
            </Badge>
          </div>
        )}
        <SidebarSection
          label="Direct messages"
          action={access.hasDms && <NewDmDialog />}
        >
          {dmRows}
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={`/org/${slug}/settings`} />}>
              <Settings aria-hidden className="opacity-70" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="clerk-on-sidebar flex items-center gap-2 px-2 py-1">
          <UserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
