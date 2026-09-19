"use client";

import { useImperativeHandle, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/mention-textarea";
import { ACCEPT_ATTR, MAX_ATTACHMENTS, useAttachments } from "@/hooks/use-attachments";
import { convexErrorMessage } from "@/lib/convex-errors";
import { encodeMentions } from "@/lib/mentions";
import { ImagePlus, Loader2, Send, X } from "lucide-react";

const HEARTBEAT_INTERVAL_MS = 3000;
const MAX_BODY_LENGTH = 4000;

/** What a parent (the drop zone) can ask of the composer. */
export type ComposerHandle = {
  addFiles: (files: File[] | FileList) => void;
};

export function MessageComposer({
  channelId,
  placeholder,
  threadRootId,
  ref,
}: {
  channelId: Id<"channels">;
  placeholder: string;
  /** Set when composing a reply: the message goes into that thread. */
  threadRootId?: Id<"messages">;
  ref?: React.Ref<ComposerHandle>;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const send = useMutation(api.messages.send);
  const heartbeat = useMutation(api.typing.heartbeat);
  const clearTyping = useMutation(api.typing.clear);
  const members = useQuery(api.users.listOrgMembers) ?? [];
  const attachments = useAttachments();
  const fileInput = useRef<HTMLInputElement>(null);
  const lastHeartbeat = useRef(0);
  // Names picked from the @ menu -> user ids, turned into tokens on send.
  const mentionMap = useRef(new Map<string, string>());

  useImperativeHandle(ref, () => ({ addFiles: attachments.addFiles }), [attachments.addFiles]);

  function onChange(value: string) {
    setBody(value);
    const now = Date.now();
    if (!threadRootId && value.trim() && now - lastHeartbeat.current > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat.current = now;
      heartbeat({ channelId }).catch(() => {});
    }
  }

  const hasContent = body.trim().length > 0 || attachments.ready.length > 0;
  const canSend = hasContent && !sending && !attachments.uploading;

  async function submit() {
    if (!canSend) return;
    const text = body.trim();
    const encoded = encodeMentions(text, mentionMap.current);
    if (encoded.length > MAX_BODY_LENGTH) {
      toast.error("That message is too long.");
      return;
    }
    setSending(true);
    setBody("");
    if (!threadRootId) clearTyping({ channelId }).catch(() => {});
    try {
      await send({
        channelId,
        body: encoded,
        threadRootId,
        attachments: attachments.ready.length > 0 ? attachments.ready : undefined,
      });
      attachments.clear();
      mentionMap.current.clear();
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't send that message."));
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
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
      {attachments.items.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attached images">
          {attachments.items.map((item) => (
            <li
              key={item.id}
              className="relative size-16 overflow-hidden rounded-md border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={item.previewUrl}
                alt={item.name}
                className={`size-full object-cover ${item.status === "uploading" ? "opacity-40" : ""}`}
              />
              {item.status === "uploading" && (
                <Loader2
                  className="absolute inset-0 m-auto size-4 animate-spin text-foreground"
                  aria-label="Uploading"
                />
              )}
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => attachments.remove(item.id)}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
          <ImagePlus />
        </Button>
        <MentionTextarea
          value={body}
          onValueChange={onChange}
          members={members}
          onMentionPicked={(name, userId) => mentionMap.current.set(name, userId)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          className="min-h-11 resize-none py-3"
          maxLength={MAX_BODY_LENGTH}
          aria-label={placeholder}
        />
        <Button
          type="submit"
          variant="cta"
          size="icon"
          className="size-11"
          aria-label="Send message"
          disabled={!canSend}
        >
          <Send />
        </Button>
      </div>
    </form>
  );
}
