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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { cn, initials } from "@/lib/utils";
import { Check, Plus } from "lucide-react";

const MAX_PEOPLE = 7; // plus you = 8, matching convex/dms.ts

function isPlanLimit(err: unknown): boolean {
  return err instanceof ConvexError && (err.data as { code?: string })?.code === "PLAN_LIMIT";
}

/** Pick one person for a 1:1, or several for a group, and open the DM. */
export function NewDmDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Id<"users">[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const candidates = useQuery(api.dms.listCandidates, open ? {} : "skip");
  const getOrCreate = useMutation(api.dms.getOrCreate);
  const router = useRouter();

  const visible = (candidates ?? []).filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  function toggle(userId: Id<"users">) {
    setSelected((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : current.length >= MAX_PEOPLE
          ? current
          : [...current, userId],
    );
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setFilter("");
      setSelected([]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      const channelId = await getOrCreate({ userIds: selected });
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
      setSubmitting(false);
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
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New message</DialogTitle>
              <DialogDescription>
                Pick one person, or several to start a group conversation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search people"
                aria-label="Search people"
                autoFocus
              />
              <ul
                aria-label="People"
                className="max-h-64 space-y-0.5 overflow-y-auto"
              >
                {candidates === undefined ? (
                  <li className="px-2 py-2 text-sm text-muted-foreground">Loading…</li>
                ) : visible.length === 0 ? (
                  <li className="px-2 py-2 text-sm text-muted-foreground">
                    {candidates.length === 0
                      ? "No one else is in this organization yet."
                      : "No one matches that search."}
                  </li>
                ) : (
                  visible.map((person) => {
                    const isSelected = selected.includes(person.userId);
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggle(person.userId)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                            isSelected && "bg-primary/10",
                          )}
                        >
                          <Avatar className="size-7">
                            <AvatarImage src={person.imageUrl} alt="" />
                            <AvatarFallback className="text-xs">
                              {initials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate text-sm">{person.name}</span>
                          {isSelected && <Check className="size-4 text-primary" />}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
            <DialogFooter>
              <span className="mr-auto self-center font-tabular text-xs text-muted-foreground">
                {selected.length} selected
              </span>
              <Button
                variant="cta"
                type="submit"
                disabled={submitting || selected.length === 0}
              >
                {submitting ? "Opening…" : "Start conversation"}
              </Button>
            </DialogFooter>
          </form>
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
