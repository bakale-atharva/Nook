"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/mention-textarea";
import { useMentionDraft } from "@/hooks/use-mention-draft";
import { toastConvexError } from "@/lib/convex-errors";
import { decodeMentions } from "@/lib/mentions";
import { Check, X } from "lucide-react";
import type { MessageItemData } from "./types";

/** Edits a message in place: Enter or Save commits, Escape or Cancel backs out. */
export function MessageEditForm({
  message,
  onDone,
}: {
  message: MessageItemData;
  onDone: () => void;
}) {
  const edit = useMutation(api.messages.edit);
  const draft = useMentionDraft({
    text: decodeMentions(message.body, message.mentionedUsers),
    mentions: message.mentionedUsers,
  });
  const hasImages = message.attachments.length > 0;

  async function save() {
    const text = draft.value.trim();
    if (!text && !hasImages) return;
    try {
      await edit({ messageId: message._id, body: draft.encode(text) });
      onDone();
    } catch (err) {
      toastConvexError(err, "Couldn't save your edit.");
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      <MentionTextarea
        {...draft.textareaProps}
        onEnter={() => void save()}
        onEscape={onDone}
        className="min-h-16"
        // The person just chose to edit, so moving focus here is expected.
        autoFocus
        aria-label="Edit message"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>
          <Check /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          <X /> Cancel
        </Button>
      </div>
    </div>
  );
}
