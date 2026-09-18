"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useAuth, useOrganization, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateChannelDialog } from "@/components/create-channel-dialog";
import { PlanSync } from "@/components/plan-sync";
import { Hash, Lock, Settings, Sparkles, TriangleAlert } from "lucide-react";

const FREE_CHANNEL_LIMIT = 5;

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { has, isLoaded: authLoaded } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const channels = useQuery(api.channels.list);
  const org = useQuery(api.organizations.current);

  const canManageChannels = authLoaded && !!has?.({ permission: "org:channels:manage" });
  const canPrivateChannels = authLoaded && !!has?.({ permission: "org:private_channels:manage" });
  const canManageBilling = authLoaded && !!has?.({ permission: "org:sys_billing:manage" });
  const isUnlimited = authLoaded && !!has?.({ feature: "unlimited_channels" });
  const isPro = authLoaded && !!has?.({ plan: "org:pro" });
  const isPastDue = org?.subscriptionStatus === "past_due";

  // organizationSyncOptions keeps the active org matched to :slug; if it
  // couldn't (org doesn't exist or the user lost access), organization here
  // will be the previously-active one instead — let people fix that here.
  const slugMismatch =
    orgLoaded && organization && organization.slug !== params.slug;

  return (
    <SidebarProvider>
      <PlanSync />
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
              render={<Link href={`/org/${params.slug}/upgrade`} />}
            >
              <Sparkles className="size-3.5" /> Upgrade to Pro
            </Button>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Channels</span>
              {canManageChannels && (
                <CreateChannelDialog
                  orgSlug={params.slug}
                  canCreatePrivate={canPrivateChannels}
                />
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
                ) : channels.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    No channels yet.
                  </p>
                ) : (
                  channels.map((channel) => {
                    const href = `/org/${params.slug}/c/${channel._id}`;
                    return (
                      <SidebarMenuItem key={channel._id}>
                        <SidebarMenuButton
                          isActive={pathname === href}
                          render={<Link href={href} />}
                        >
                          {channel.isPrivate ? (
                            <Lock className="opacity-70" />
                          ) : (
                            <Hash className="opacity-70" />
                          )}
                          <span className="truncate">{channel.name}</span>
                        </SidebarMenuButton>
                        {channel.unreadCount > 0 && (
                          <SidebarMenuBadge className="font-tabular text-live">
                            {channel.unreadCapped ? "99+" : channel.unreadCount}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {!isUnlimited && channels !== undefined && (
            <div className="px-4 pt-2">
              <Badge variant="secondary" className="w-fit">
                {channels.length}/{FREE_CHANNEL_LIMIT} channels
              </Badge>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href={`/org/${params.slug}/settings`} />}>
                <Settings className="opacity-70" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="clerk-on-sidebar flex items-center gap-2 px-2 py-1">
            <UserButton />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3">
          <SidebarTrigger />
        </header>
        {isPastDue && canManageBilling && (
          <div className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" />
            <span className="flex-1">
              Your last payment failed. Update billing to keep your Pro features.
            </span>
            <Link href={`/org/${params.slug}/settings`} className="font-medium underline">
              Fix billing
            </Link>
          </div>
        )}
        {slugMismatch ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="space-y-3">
              <p className="text-muted-foreground">
                You don&apos;t have access to that organization, or it no
                longer exists. Pick one below.
              </p>
              <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/org/:slug" />
            </div>
          </div>
        ) : (
          children
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
