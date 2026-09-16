"use client";

import { useEffect, useRef } from "react";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * The `pla`/`fea` session-token claims that drive plan gating only refresh
 * on their own schedule. clerkSync's subscription.* webhook handlers
 * update convex `organizations.plan` the moment a checkout completes, so
 * we watch that (reactive) value and force a session reload as soon as it
 * changes — the "session.reload() after checkout" step from the plan.
 */
export function PlanSync() {
  const { session } = useClerk();
  const org = useQuery(api.organizations.current);
  const lastPlan = useRef<string | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (org === undefined) return; // still loading
    if (!initialized.current) {
      initialized.current = true;
      lastPlan.current = org?.plan;
      return;
    }
    if (org?.plan !== lastPlan.current) {
      lastPlan.current = org?.plan;
      session?.reload().catch(() => {});
    }
  }, [org, session]);

  return null;
}
