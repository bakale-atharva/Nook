"use client";

import { useAuth } from "@clerk/nextjs";
import { FEATURES, PERMISSIONS } from "@/convex/lib/constants";

type Check = Parameters<NonNullable<ReturnType<typeof useAuth>["has"]>>[0];

/**
 * What the signed-in person may do in the active organization, from Clerk's
 * session claims. Everything is false until Clerk has loaded, so gated UI
 * starts hidden instead of flashing. The server enforces every one of these
 * again; this only decides what to show.
 */
export function useOrgAccess() {
  const { has, isLoaded } = useAuth();
  const can = (check: Check) => isLoaded && !!has?.(check);

  return {
    isLoaded,
    canManageChannels: can({ permission: PERMISSIONS.CHANNELS_MANAGE }),
    canCreatePrivateChannels: can({ permission: PERMISSIONS.PRIVATE_CHANNELS_MANAGE }),
    canModerate: can({ permission: PERMISSIONS.MESSAGES_MODERATE }),
    canManageBilling: can({ permission: "org:sys_billing:manage" }),
    hasUnlimitedChannels: can({ feature: FEATURES.UNLIMITED_CHANNELS }),
    hasDms: can({ feature: FEATURES.DIRECT_MESSAGES }),
    isPro: can({ plan: "org:pro" }),
  };
}
