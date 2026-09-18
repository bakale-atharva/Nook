"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { convexErrorMessage } from "@/lib/convex-errors";
import { Send } from "lucide-react";

const HEARTBEAT_INTERVAL_MS = 3000;

export function MessageComposer({
  channelId,
  channelName,
}: {
  channelId: Id<"channels">;
  channelName: string;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const send = useMutation(api.messages.send);
  const heartbeat = useMutation(api.typing.heartbeat);
  const clearTyping = useMutation(api.typing.clear);
  const lastHeartbeat = useRef(0);

  function onChange(value: string) {
    setBody(value);
    const now = Date.now();
    if (value.trim() && now - lastHeartbeat.current > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat.current = now;
      heartbeat({ channelId }).catch(() => {});
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody("");
    clearTyping({ channelId }).catch(() => {});
    try {
      await send({ channelId, body: text });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Couldn't send that message."));
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
      <Textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Message #${channelName}`}
        className="min-h-11 flex-1 resize-none py-3"
        maxLength={4000}
      />
      <Button
        type="submit"
        variant="cta"
        size="icon"
        disabled={!body.trim() || sending}
      >
        <Send />
      </Button>
    </form>
  );
}
