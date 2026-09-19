"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexErrorMessage } from "@/lib/convex-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { initials } from "@/lib/utils";
import { Plus } from "lucide-react";

function isPlanLimit(err: unknown): boolean {
  return err instanceof ConvexError && (err.data as { code?: string })?.code === "PLAN_LIMIT";
}

/** Pick a person and open the one-to-one direct message with them. */
export function NewDmDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [opening, setOpening] = useState(false);
  const candidates = useQuery(api.dms.listCandidates, open ? {} : "skip");
  const getOrCreate = useMutation(api.dms.getOrCreate);
  const router = useRouter();

  const visible = (candidates ?? []).filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setFilter("");
  }

  async function openConversation(userId: Id<"users">) {
    setOpening(true);
    try {
      const channelId = await getOrCreate({ userId });
      onOpenChange(false);
      router.push(`/org/${orgSlug}/c/${channelId}`);
    } catch (err) {
      if (isPlanLimit(err)) {
        onOpenChange(false);
        setUpgradeOpen(true);
      } else {
        toast.error(convexErrorMessage(err, "Couldn't start that conversation."));
      }
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger
          render={<Button variant="ghost" size="icon" aria-label="New direct message" />}
        >
          <Plus />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>Pick someone to message directly.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              autoFocus
            />
            <ul aria-label="People" className="max-h-64 space-y-0.5 overflow-y-auto">
              {candidates === undefined ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">Loading…</li>
              ) : visible.length === 0 ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  {candidates.length === 0
                    ? "No one else is in this organization yet."
                    : "No one matches that search."}
                </li>
              ) : (
                visible.map((person) => (
                  <li key={person.userId}>
                    <button
                      type="button"
                      disabled={opening}
                      onClick={() => openConversation(person.userId)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      <Avatar className="size-7">
                        <AvatarImage src={person.imageUrl} alt="" />
                        <AvatarFallback className="text-xs">
                          {initials(person.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">{person.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        orgSlug={orgSlug}
        reason="Direct messages are a Pro feature. Upgrade to message teammates directly."
      />
    </>
  );
}
