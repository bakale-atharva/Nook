"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MAX_ATTACHMENTS, MAX_BODY_LENGTH } from "@/convex/lib/constants";
import { AttachmentPreviewList } from "@/components/attachment-preview-list";
import { useComposer } from "@/components/composer-provider";
import { MentionTextarea } from "@/components/mention-textarea";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTR } from "@/hooks/use-attachments";
import { useMentionDraft } from "@/hooks/use-mention-draft";
import { useTypingHeartbeat } from "@/hooks/use-typing-heartbeat";
import { toastConvexError } from "@/lib/convex-errors";
import { ImagePlus, Send } from "lucide-react";

/**
 * The message box: text with @mentions, image attachments (held by the
 * surrounding <ComposerProvider>) and a send button. Enter sends,
 * Shift+Enter adds a line. With `threadRootId` it posts into that thread and
 * doesn't announce typing.
 */
export function MessageComposer({
  channelId,
  placeholder,
  threadRootId,
}: {
  channelId: Id<"channels">;
  placeholder: string;
  /** Set when composing a reply: the message goes into that thread. */
  threadRootId?: Id<"messages">;
}) {
  const [sending, setSending] = useState(false);
  const send = useMutation(api.messages.send);
  const draft = useMentionDraft();
  const attachments = useComposer();
  const typing = useTypingHeartbeat(channelId, !threadRootId);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasContent = draft.value.trim().length > 0 || attachments.ready.length > 0;
  const canSend = hasContent && !sending && !attachments.uploading;

  function onChange(value: string) {
    draft.setValue(value);
    typing.ping(value);
  }

  async function submit() {
    if (!canSend) return;
    const text = draft.value.trim();
    const encoded = draft.encode(text);
    if (encoded.length > MAX_BODY_LENGTH) {
      toast.error("That message is too long.");
      return;
    }
    setSending(true);
    draft.setValue("");
    typing.stop();
    try {
      await send({
        channelId,
        body: encoded,
        threadRootId,
        attachments: attachments.ready.length > 0 ? attachments.ready : undefined,
      });
      attachments.clear();
      draft.clearMentions();
    } catch (err) {
      toastConvexError(err, "Couldn't send that message.");
      draft.setValue(text);
    } finally {
      setSending(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    e.preventDefault();
    void attachments.addFiles(images);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2 border-t p-3"
    >
      <AttachmentPreviewList />
      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void attachments.addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Attach images"
          disabled={attachments.items.length >= MAX_ATTACHMENTS}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus aria-hidden />
        </Button>
        <MentionTextarea
          {...draft.textareaProps}
          onValueChange={onChange}
          onEnter={() => void submit()}
          onPaste={onPaste}
          placeholder={placeholder}
          className="min-h-11 resize-none py-3"
          maxLength={MAX_BODY_LENGTH}
          aria-label={placeholder.replace(/…$/, "")}
        />
        <Button
          type="submit"
          variant="cta"
          size="icon"
          className="size-11"
          aria-label="Send message"
          disabled={!canSend}
        >
          <Send aria-hidden />
        </Button>
      </div>
    </form>
  );
}
