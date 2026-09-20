"use client";

import Link from "next/link";
import { useOrganization, OrganizationSwitcher } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SkeletonRows } from "@/components/skeleton-rows";
import { UpgradeProvider } from "@/components/upgrade-provider";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useWorkspaceSync } from "@/hooks/use-workspace-sync";
import { TriangleAlert } from "lucide-react";

/** Tells billing managers that the last payment failed. */
function PastDueBanner({ slug }: { slug: string }) {
  const { canManageBilling } = useOrgAccess();
  if (!canManageBilling) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">
        Your last payment failed. Update billing to keep your Pro features.
      </span>
      <Link href={`/org/${slug}/settings`} className="focus-ring rounded-sm font-medium underline">
        Fix billing
      </Link>
    </div>
  );
}

/**
 * Renders the page only once Clerk's active organization is known and matches
 * the URL. organizationSyncOptions (proxy.ts) makes the active org follow
 * :slug; if it couldn't (the org doesn't exist or the person lost access), the
 * active one is still the previous org, so people get a way out here instead
 * of a page querying the wrong workspace.
 */
function OrgAccessGuard({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <SkeletonRows count={3} className="h-10 w-2/3" />
      </div>
    );
  }
  if (organization && organization.slug !== slug) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">
            You don&apos;t have access to that organization, or it no longer exists. Pick one
            below.
          </p>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/org/:slug" />
        </div>
      </div>
    );
  }
  return children;
}

/** Everything around a workspace page: sidebar, header, banner and the plan-limit dialog. */
export function WorkspaceShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const org = useQuery(api.organizations.current);
  useWorkspaceSync(org);

  return (
    <UpgradeProvider orgSlug={slug}>
      <SidebarProvider>
        <WorkspaceSidebar slug={slug} />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-3">
            <SidebarTrigger />
          </header>
          {org?.subscriptionStatus === "past_due" && <PastDueBanner slug={slug} />}
          <OrgAccessGuard slug={slug}>{children}</OrgAccessGuard>
        </SidebarInset>
      </SidebarProvider>
    </UpgradeProvider>
  );
}
