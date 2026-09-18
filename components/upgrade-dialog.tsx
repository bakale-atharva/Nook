"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

/**
 * Opens whenever a server call fails with ConvexError({code:"PLAN_LIMIT"})
 * — see lib/convex-errors.ts. The server is the source of truth for every
 * limit; this is purely the "here's how to fix that" UX on top of it.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  orgSlug,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  reason: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Upgrade to Pro
          </DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={`/org/${orgSlug}/upgrade`} />}
            onClick={() => onOpenChange(false)}
          >
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
