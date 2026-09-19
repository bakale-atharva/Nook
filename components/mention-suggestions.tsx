import { UserAvatar } from "@/components/user-avatar";
import type { MentionMember } from "@/lib/mentions";
import { cn } from "@/lib/utils";

/**
 * The listbox of teammates under an `@` in a MentionTextarea. Focus stays in
 * the textarea (the combobox pattern), so options are picked with the mouse
 * or through the textarea's key handling, never focused themselves.
 */
export function MentionSuggestions({
  id,
  members,
  activeIndex,
  onPick,
}: {
  id: string;
  members: MentionMember[];
  activeIndex: number;
  onPick: (member: MentionMember) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Mention a teammate"
      className="absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      {members.map((member, i) => (
        <li
          key={member.userId}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          // mousedown, not click: keeps focus (and the caret) in the textarea.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(member);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted",
            i === activeIndex && "bg-muted",
          )}
        >
          <UserAvatar
            name={member.name}
            imageUrl={member.imageUrl}
            className="size-5"
            fallbackClassName="text-[0.625rem]"
          />
          <span className="truncate">{member.name}</span>
        </li>
      ))}
    </ul>
  );
}
