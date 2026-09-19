"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useOpenChannel } from "@/hooks/use-org-slug";
import { useSubmitAction } from "@/hooks/use-submit-action";
import { Plus } from "lucide-react";

/** Pick a person and open the one-to-one direct message with them. */
export function NewDmDialog() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const candidates = useQuery(api.dms.listCandidates, open ? {} : "skip");
  const getOrCreate = useMutation(api.dms.getOrCreate);
  const openChannel = useOpenChannel();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setFilter("");
  }

  const { submit: openConversation, submitting: opening } = useSubmitAction(getOrCreate, {
    onSuccess: (channelId) => {
      onOpenChange(false);
      openChannel(channelId);
    },
    onPlanLimit: () => onOpenChange(false),
    fallback: "Couldn't start that conversation.",
  });

  const visible = (candidates ?? []).filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label="New direct message" />}
      >
        <Plus aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Pick someone to message directly.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Input
            type="search"
            name="search"
            autoComplete="off"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
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
                    onClick={() => void openConversation({ userId: person.userId })}
                    className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                  >
                    <UserAvatar
                      name={person.name}
                      imageUrl={person.imageUrl}
                      className="size-7"
                      fallbackClassName="text-xs"
                    />
                    <span className="flex-1 truncate text-sm">{person.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
