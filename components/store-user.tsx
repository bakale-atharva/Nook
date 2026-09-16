"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Fallback sync: upserts the caller's `users` row from their session token
 * once Convex auth is ready. Clerk webhooks (convex/clerkSync.ts) do this
 * on user.created/updated, so this mostly matters for the moment between
 * sign-up and the first webhook delivery, or if an event was ever missed.
 *
 * Silently no-ops until the user has an active Organization (`store` throws
 * NO_ACTIVE_ORG before onboarding) — nothing to render either way.
 */
export function StoreUser() {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);

  useEffect(() => {
    if (!isAuthenticated) return;
    store().catch(() => {
      // Expected before the user has picked/created an Organization.
    });
  }, [isAuthenticated, store]);

  return null;
}
