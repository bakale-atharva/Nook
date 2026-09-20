"use client";

import { createContext, use, useState } from "react";
import type { PlanLimit } from "@/convex/lib/errors";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { planLimitMessage } from "@/lib/convex-errors";

const UpgradeContext = createContext<((limit: PlanLimit) => void) | null>(null);

/**
 * Mounts the one upgrade dialog for the workspace. Anything that runs into a
 * plan limit calls `useUpgradePrompt()` instead of owning a dialog and its
 * open state.
 */
export function UpgradeProvider({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the copy doesn't change while the dialog fades out.
  const [limit, setLimit] = useState<PlanLimit>("channels");

  function promptUpgrade(next: PlanLimit) {
    setLimit(next);
    setOpen(true);
  }

  return (
    <UpgradeContext value={promptUpgrade}>
      {children}
      <UpgradeDialog
        open={open}
        onOpenChange={setOpen}
        orgSlug={orgSlug}
        reason={planLimitMessage(limit)}
      />
    </UpgradeContext>
  );
}

/** Returns a function that opens the upgrade dialog, explaining the given limit. */
export function useUpgradePrompt() {
  const promptUpgrade = use(UpgradeContext);
  if (!promptUpgrade) throw new Error("useUpgradePrompt must be used inside <UpgradeProvider>.");
  return promptUpgrade;
}
