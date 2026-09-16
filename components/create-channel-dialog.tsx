"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { convexErrorMessage } from "@/lib/convex-errors";
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
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { Plus } from "lucide-react";

function isPlanLimit(err: unknown): boolean {
  return err instanceof ConvexError && (err.data as { code?: string })?.code === "PLAN_LIMIT";
}

export function CreateChannelDialog({
  orgSlug,
  canCreatePrivate,
}: {
  orgSlug: string;
  canCreatePrivate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const create = useMutation(api.channels.create);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const channelId = await create({
        name,
        description: description || undefined,
        isPrivate,
      });
      setOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      router.push(`/org/${orgSlug}/c/${channelId}`);
    } catch (err) {
      if (isPlanLimit(err)) {
        setOpen(false);
        setUpgradeOpen(true);
      } else {
        toast.error(convexErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Create channel" />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              Channels are where your team communicates. They&apos;re best
              organized around a topic — #marketing, for example.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="channel-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. marketing"
                required
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="channel-description" className="text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="channel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this channel about?"
                maxLength={500}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={isPrivate}
                disabled={!canCreatePrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>
                Make private
                {!canCreatePrivate && (
                  <span className="block text-muted-foreground">
                    Private channels are a Pro feature.{" "}
                    <Link
                      href={`/org/${orgSlug}/upgrade`}
                      className="font-medium underline"
                      onClick={() => setOpen(false)}
                    >
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
      </DialogContent>
    </Dialog>
    <UpgradeDialog
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      orgSlug={orgSlug}
      reason="Free orgs are limited to 5 channels. Upgrade to Pro for unlimited channels."
    />
    </>
  );
}
