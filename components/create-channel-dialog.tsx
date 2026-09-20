"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useOpenChannel, useOrgSlug } from "@/hooks/use-org-slug";
import { useSubmitAction } from "@/hooks/use-submit-action";
import { convexErrorCode, convexErrorMessage } from "@/lib/convex-errors";
import { Plus } from "lucide-react";

/**
 * The form lives in its own component so it unmounts with the dialog: closing
 * by any route (Escape, the X, a successful create) starts the next one blank.
 */
function CreateChannelForm({ onDone }: { onDone: () => void }) {
  const { canCreatePrivateChannels } = useOrgAccess();
  const slug = useOrgSlug();
  const openChannel = useOpenChannel();
  const create = useMutation(api.channels.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const { submit, submitting } = useSubmitAction(create, {
    onSuccess: (channelId) => {
      onDone();
      openChannel(channelId);
    },
    onPlanLimit: onDone,
    // A taken name belongs on the field, not in a toast that disappears.
    onError: (err) => {
      if (convexErrorCode(err) !== "DUPLICATE_NAME") return false;
      setNameError(convexErrorMessage(err));
      return true;
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    void submit({
      name: name.trim(),
      description: description.trim() || undefined,
      isPrivate,
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Create a channel</DialogTitle>
        <DialogDescription>
          Channels are where your team communicates. They&apos;re best organized around a
          topic — #marketing, for example.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <label htmlFor="channel-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="channel-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            placeholder="e.g. marketing…"
            required
            maxLength={80}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? "channel-name-error" : undefined}
          />
          {nameError && (
            <p id="channel-name-error" role="alert" className="text-sm text-destructive">
              {nameError}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <label htmlFor="channel-description" className="text-sm font-medium">
            Description <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="channel-description"
            name="description"
            autoComplete="off"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this channel is for…"
            maxLength={500}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isPrivate"
            className="mt-1"
            checked={isPrivate}
            disabled={!canCreatePrivateChannels}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>
            Make private
            {!canCreatePrivateChannels && (
              <span className="block text-muted-foreground">
                Private channels are a Pro feature.{" "}
                <Link href={`/org/${slug}/upgrade`} className="font-medium underline" onClick={onDone}>
                  Upgrade
                </Link>
              </span>
            )}
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button variant="cta" type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create channel"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateChannelDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Create channel" />}>
        <Plus aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <CreateChannelForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
