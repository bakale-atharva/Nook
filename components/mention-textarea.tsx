"use client";

import { useId, useRef, useState } from "react";
import { MentionSuggestions } from "@/components/mention-suggestions";
import { Textarea } from "@/components/ui/textarea";
import { findMentionTrigger, suggestMembers, type MentionMember } from "@/lib/mentions";

/**
 * A textarea that suggests teammates while you type `@name`. Picking one
 * inserts `@Name ` and reports the name -> user id pair through
 * `onMentionPicked`; the owner turns those into `<@id>` tokens on send (see
 * lib/mentions.ts). While the suggestion list is closed, Enter calls
 * `onEnter` (sending or saving) and Escape calls `onEscape`; Shift+Enter
 * still inserts a newline.
 */
export function MentionTextarea({
  value,
  onValueChange,
  members,
  onMentionPicked,
  onEnter,
  onEscape,
  onKeyDown,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  members: MentionMember[];
  onMentionPicked: (name: string, userId: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} & Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "onKeyDown" | "ref">) {
  const inner = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const suggestions = trigger ? suggestMembers(members, trigger.query) : [];
  const open = !!trigger && trigger.start !== dismissedAt && suggestions.length > 0;
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  function syncTrigger(el: HTMLTextAreaElement) {
    const next = findMentionTrigger(el.value, el.selectionStart ?? el.value.length);
    setTrigger(next);
    if (next?.start !== trigger?.start || next?.query !== trigger?.query) setActive(0);
    // A dismissal only covers the mention it was pressed on; once the caret
    // leaves it (or the "@" is deleted) the next "@" may suggest again.
    if (dismissedAt !== null && next?.start !== dismissedAt) setDismissedAt(null);
  }

  function pick(member: MentionMember) {
    const el = inner.current;
    if (!trigger || !el) return;
    const caret = el.selectionStart ?? value.length;
    const inserted = `@${member.name} `;
    onValueChange(value.slice(0, trigger.start) + inserted + value.slice(caret));
    onMentionPicked(member.name, member.userId);
    setTrigger(null);
    const nextCaret = trigger.start + inserted.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter while an IME is composing confirms the composition; it isn't ours.
    const composing = e.nativeEvent.isComposing;
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + delta + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !composing) {
        e.preventDefault();
        pick(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedAt(trigger?.start ?? null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !composing && onEnter) {
      e.preventDefault();
      onEnter();
      return;
    }
    if (e.key === "Escape") onEscape?.();
    onKeyDown?.(e);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Textarea
        {...rest}
        ref={inner}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          syncTrigger(e.target);
        }}
        onSelect={(e) => syncTrigger(e.currentTarget)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
      />
      {open && (
        <MentionSuggestions
          id={listId}
          members={suggestions}
          activeIndex={activeIndex}
          onPick={pick}
        />
      )}
    </div>
  );
}
