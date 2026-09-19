"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth, useOrganization, OrganizationSwitcher } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PlanSync } from "@/components/plan-sync";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { TriangleAlert } from "lucide-react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();
  const { has, isLoaded: authLoaded } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const org = useQuery(api.organizations.current);

  const canManageBilling = authLoaded && !!has?.({ permission: "org:sys_billing:manage" });
  const isPastDue = org?.subscriptionStatus === "past_due";

  // organizationSyncOptions keeps the active org matched to :slug; if it
  // couldn't (org doesn't exist or the user lost access), organization here
  // will be the previously-active one instead — let people fix that here.
  const slugMismatch =
    orgLoaded && organization && organization.slug !== params.slug;

  return (
    <SidebarProvider>
      <PlanSync />
      <WorkspaceSidebar slug={params.slug} />
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
