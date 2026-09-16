"use client";

import { OrganizationList, UserButton } from "@clerk/nextjs";

/**
 * Every user must belong to an Organization (Clerk Dashboard: "Allow
 * personal accounts" is off), so Clerk's `choose-organization` session task
 * lands users here to create one or accept a pending invite. Once an org is
 * active, proxy.ts's organizationSyncOptions carries it into /org/:slug URLs.
 */
export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-lg font-semibold">Nook</span>
        <UserButton />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Welcome to Nook</h1>
          <p className="text-sm text-muted-foreground">
            Create an organization or accept an invite to get started.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/org/:slug"
          afterCreateOrganizationUrl="/org/:slug"
        />
      </div>
    </div>
  );
}
