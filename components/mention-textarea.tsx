"use client";

import { useId, useImperativeHandle, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

export type MentionMember = { userId: string; name: string; imageUrl?: string };

const MAX_SUGGESTIONS = 6;
const MAX_QUERY_LENGTH = 30;

/** The `@query` being typed at the caret, if any. */
function findTrigger(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.length > MAX_QUERY_LENGTH) return null;
  return { start: at, query };
}

/**
 * A textarea that suggests teammates while you type `@name`. Picking one
 * inserts `@Name ` and reports the name -> user id pair through
 * `onMentionPicked`; the owner turns those into `<@id>` tokens on send (see
 * lib/mentions.ts). Keys the suggestion list doesn't need (Enter to send,
 * for one) fall through to `onKeyDown`.
 */
export function MentionTextarea({
  value,
  onValueChange,
  members,
  onMentionPicked,
  onKeyDown,
  onPaste,
  ref,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  members: MentionMember[];
  onMentionPicked: (name: string, userId: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  ref?: React.Ref<HTMLTextAreaElement>;
} & Omit<
  React.ComponentProps<"textarea">,
  "value" | "onChange" | "onKeyDown" | "onPaste" | "ref"
>) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  const listId = useId();

  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const query = trigger?.query.toLowerCase() ?? "";
  const suggestions = trigger
    ? members
        .filter((m) => m.name.toLowerCase().includes(query))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name);
        })
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const open = !!trigger && trigger.start !== dismissedAt && suggestions.length > 0;
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  function syncTrigger(el: HTMLTextAreaElement) {
    const next = findTrigger(el.value, el.selectionStart ?? el.value.length);
    setTrigger(next);
    if (next?.start !== trigger?.start || next?.query !== trigger?.query) setActive(0);
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
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
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
        onPaste={onPaste}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {suggestions.map((member, i) => (
            <li
              key={member.userId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
            >
              <button
                type="button"
                tabIndex={-1}
                // mousedown, not click: keeps focus (and the caret) in the textarea.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(member);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                  i === activeIndex && "bg-muted",
                )}
              >
                <Avatar className="size-5">
                  <AvatarImage src={member.imageUrl} alt="" />
                  <AvatarFallback className="text-[0.625rem]">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
