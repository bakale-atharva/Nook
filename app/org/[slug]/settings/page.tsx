"use client";

import { OrganizationProfile } from "@clerk/nextjs";

/**
 * Members tab (invites, roles, seat-limit UI) and Billing tab (plan,
 * upgrade) come straight from Clerk — see the "Plans" section that appears
 * automatically once Organization Plans are configured in the Dashboard.
 */
export default function WorkspaceSettingsPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <OrganizationProfile routing="hash" />
    </div>
  );
}
