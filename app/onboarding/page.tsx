"use client";

import { OrganizationList } from "@clerk/nextjs";

/**
 * Every user must belong to an Organization (Clerk Dashboard: "Allow
 * personal accounts" is off), so Clerk's `choose-organization` session task
 * lands users here to create one or accept a pending invite. Once an org is
 * active, proxy.ts's organizationSyncOptions carries it into /w/:slug URLs.
 */
export default function OnboardingPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/w/:slug"
        afterCreateOrganizationUrl="/w/:slug"
      />
    </div>
  );
}
