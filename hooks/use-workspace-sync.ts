"use client";

import { useEffect, useRef } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Keeps Convex and Clerk in step for the active workspace. Render it once,
 * with the org row from `api.organizations.current`.
 *
 * 1. Fallback user sync: upserts the caller's `users` row from their session
 *    token once Convex auth is ready and an organization is active. The Clerk
 *    webhooks (convex/clerkSync.ts) normally do this; this covers the moment
 *    between sign-up and the first delivery, or a missed event. It re-runs
 *    when the active organization changes, because `store` throws
 *    NO_ACTIVE_ORG until the token carries one.
 * 2. Plan refresh: the `pla`/`fea` session-token claims that drive plan gating
 *    only refresh on their own schedule, so as soon as the (reactive) plan on
 *    the org row changes (the subscription webhook landed after a checkout)
 *    the session is reloaded.
 */
export function useWorkspaceSync(org: Doc<"organizations"> | null | undefined) {
  const { isAuthenticated } = useConvexAuth();
  const { orgId } = useAuth();
  const { session } = useSession();
  const store = useMutation(api.users.store);
  // null until the first plan value has been seen.
  const seenPlan = useRef<{ plan: string | undefined } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !orgId) return;
    store().catch(() => {
      // Expected while the session token doesn't yet carry the organization.
    });
  }, [isAuthenticated, orgId, store]);

  useEffect(() => {
    if (org === undefined) return; // still loading
    if (seenPlan.current === null) {
      seenPlan.current = { plan: org?.plan };
      return;
    }
    if (org?.plan !== seenPlan.current.plan) {
      seenPlan.current = { plan: org?.plan };
      session?.reload().catch(() => {});
    }
  }, [org, session]);
}
