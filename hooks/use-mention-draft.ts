"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { encodeMentions } from "@/lib/mentions";

/**
 * A message draft that supports @mentions: the text, the org members to
 * suggest, and the name -> user id pairs picked from the menu, which
 * `encode` turns into `<@id>` tokens for sending. `textareaProps` spreads
 * straight onto `<MentionTextarea>`.
 */
export function useMentionDraft(
  initial: { text?: string; mentions?: { id: string; name: string }[] } = {},
) {
  const [value, setValue] = useState(initial.text ?? "");
  const [picked] = useState(
    () => new Map<string, string>((initial.mentions ?? []).map((m) => [m.name, m.id])),
  );
  const members = useQuery(api.users.listOrgMembers) ?? [];

  return {
    value,
    setValue,
    textareaProps: {
      value,
      onValueChange: setValue,
      members,
      onMentionPicked: (name: string, userId: string) => {
        picked.set(name, userId);
      },
    },
    encode: (text: string) => encodeMentions(text, picked),
    clearMentions: () => picked.clear(),
  };
}
