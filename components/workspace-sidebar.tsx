"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateChannelDialog } from "@/components/create-channel-dialog";
import { NewDmDialog } from "@/components/new-dm-dialog";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { convexErrorMessage } from "@/lib/convex-errors";
import { cn, initials } from "@/lib/utils";
import { Hash, Lock, Settings, Sparkles, Star, Users } from "lucide-react";

const FREE_CHANNEL_LIMIT = 5;

type SidebarChannel = FunctionReturnType<typeof api.channels.list>[number];

function dmLabel(channel: SidebarChannel, meId: Id<"users"> | undefined) {
  const others = channel.dmMembers.filter((m) => m.userId !== meId);
  return {
    others,
    name: others.map((m) => m.name).join(", ") || "Direct message",
  };
}

function ChannelRow({
  channel,
  href,
  active,
  meId,
  onToggleStar,
}: {
  channel: SidebarChannel;
  href: string;
  active: boolean;
  meId: Id<"users"> | undefined;
  onToggleStar: (channel: SidebarChannel) => void;
}) {
  const dm = channel.isDm ? dmLabel(channel, meId) : null;
  const label = dm ? dm.name : channel.name;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        {dm ? (
          dm.others.length === 1 ? (
            <Avatar className="size-4">
              <AvatarImage src={dm.others[0].imageUrl} alt="" />
              <AvatarFallback className="text-[0.5rem] text-foreground">
                {initials(dm.others[0].name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Users className="opacity-70" />
          )
        ) : channel.isPrivate ? (
          <Lock className="opacity-70" />
        ) : (
          <Hash className="opacity-70" />
        )}
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
      {channel.isMember && (
        <SidebarMenuAction
          showOnHover
          className="max-md:hidden"
          aria-label={channel.starred ? `Unstar ${label}` : `Star ${label}`}
          onClick={() => onToggleStar(channel)}
        >
          <Star className={cn(channel.starred && "fill-current")} />
        </SidebarMenuAction>
      )}
      {channel.mentionCount > 0 ? (
        <SidebarMenuBadge
          aria-label={`${channel.mentionCount} unread mentions`}
          className="bg-live font-tabular text-live-foreground group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 md:peer-hover/menu-button:text-live-foreground"
        >
          @{channel.mentionCount}
        </SidebarMenuBadge>
      ) : (
        channel.unreadCount > 0 && (
          <SidebarMenuBadge className="font-tabular text-live group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0">
            {channel.unreadCapped ? "99+" : channel.unreadCount}
          </SidebarMenuBadge>
        )
      )}
    </SidebarMenuItem>
  );
}

/**
 * The workspace sidebar: org switcher and plan, then Starred, Channels and
 * Direct messages (a Pro feature; Free orgs see an upgrade prompt), and
 * settings.
 */
export function WorkspaceSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { has, isLoaded: authLoaded } = useAuth();
  const { organization } = useOrganization();
  const channels = useQuery(api.channels.list);
  const me = useQuery(api.users.me);
  const setStarred = useMutation(api.channels.setStarred);
  const [dmUpgradeOpen, setDmUpgradeOpen] = useState(false);

  const canManageChannels = authLoaded && !!has?.({ permission: "org:channels:manage" });
  const canPrivateChannels = authLoaded && !!has?.({ permission: "org:private_channels:manage" });
  const isUnlimited = authLoaded && !!has?.({ feature: "unlimited_channels" });
  const hasDms = authLoaded && !!has?.({ feature: "direct_messages" });
  const isPro = authLoaded && !!has?.({ plan: "org:pro" });

  async function toggleStar(channel: SidebarChannel) {
    try {
      await setStarred({ channelId: channel._id, starred: !channel.starred });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't update your starred list."));
    }
  }

  const starred = channels?.filter((c) => c.starred && c.isMember) ?? [];
  const regular = channels?.filter((c) => !c.isDm && !(c.starred && c.isMember)) ?? [];
  const dms = channels?.filter((c) => c.isDm && !c.starred) ?? [];
  const channelCount = channels?.filter((c) => !c.isDm).length ?? 0;

  const row = (channel: SidebarChannel) => {
    const href = `/org/${slug}/c/${channel._id}`;
    return (
      <ChannelRow
        key={channel._id}
        channel={channel}
        href={href}
        active={pathname === href}
        meId={me?._id}
        onToggleStar={toggleStar}
      />
    );
  };

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
          <Badge variant={isPro ? "default" : "secondary"}>
            {isPro ? "Pro" : "Free"}
          </Badge>
          {organization && (
            <span className="font-tabular text-xs text-sidebar-foreground/70">
              {organization.membersCount}/{organization.maxAllowedMemberships} members
            </span>
          )}
        </div>
        {!isPro && (
          <Button
            variant="cta"
            size="sm"
            nativeButton={false}
            className="w-full justify-center"
            render={<Link href={`/org/${slug}/upgrade`} />}
          >
            <Sparkles className="size-3.5" /> Upgrade to Pro
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        {starred.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Starred</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{starred.map(row)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Channels</span>
            {canManageChannels && (
              <CreateChannelDialog orgSlug={slug} canCreatePrivate={canPrivateChannels} />
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channels === undefined ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : regular.length === 0 && starred.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">No channels yet.</p>
              ) : (
                regular.map(row)
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!isUnlimited && channels !== undefined && (
          <div className="px-4">
            <Badge variant="secondary" className="w-fit">
              {channelCount}/{FREE_CHANNEL_LIMIT} channels
            </Badge>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Direct messages</span>
            {hasDms && <NewDmDialog orgSlug={slug} />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {!authLoaded || channels === undefined ? (
                <Skeleton className="h-8 w-full" />
              ) : hasDms ? (
                dms.length === 0 && !channels.some((c) => c.isDm) ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    No conversations yet.
                  </p>
                ) : (
                  dms.map(row)
                )
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setDmUpgradeOpen(true)}>
                    <Lock className="opacity-70" />
                    <span className="truncate">Direct messages · Pro</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={`/org/${slug}/settings`} />}>
              <Settings className="opacity-70" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="clerk-on-sidebar flex items-center gap-2 px-2 py-1">
          <UserButton />
        </div>
      </SidebarFooter>
      <UpgradeDialog
        open={dmUpgradeOpen}
        onOpenChange={setDmUpgradeOpen}
        orgSlug={slug}
        reason="Direct messages are a Pro feature. Upgrade to message teammates directly."
      />
    </Sidebar>
  );
}
