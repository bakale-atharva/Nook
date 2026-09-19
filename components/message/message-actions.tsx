"use client";

import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/emoji-picker";
import { cn } from "@/lib/utils";
import { Heart, MessageSquareReply, Pencil, SmilePlus, Trash2, type LucideIcon } from "lucide-react";

/**
 * One icon button of the action bar. Extra props (a popover trigger's ref and
 * handlers, for one) pass through to the Button. `label` is both the
 * accessible name and the tooltip.
 */
function MessageActionButton({
  label,
  icon: Icon,
  iconClassName,
  ...props
}: {
  label: string;
  icon: LucideIcon;
  iconClassName?: string;
} & Omit<React.ComponentProps<typeof Button>, "children" | "aria-label" | "title">) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden className={cn("size-3.5", iconClassName)} />
    </Button>
  );
}

/**
 * The floating action bar of a message row (heart, react, reply, edit,
 * delete). It shows on hover and while anything in the row has focus, and
 * stays up while the emoji popover is open, even after the pointer has left
 * the row for the popover.
 */
export function MessageActions({
  hearted,
  pickerOpen,
  onPickerOpenChange,
  onHeart,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  hearted: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onHeart: () => void;
  onReact: (emoji: string) => void;
  /** Present when the message can be replied to in a thread. */
  onReply?: () => void;
  /** Present when the caller may edit the message. */
  onEdit?: () => void;
  /** Present when the caller may delete the message. */
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute -top-3 right-4 z-10 items-center gap-0.5 rounded-md border bg-background p-0.5",
        pickerOpen ? "flex" : "hidden group-focus-within:flex group-hover:flex",
      )}
    >
      <MessageActionButton
        label={hearted ? "Remove heart" : "Heart this message"}
        icon={Heart}
        iconClassName={hearted ? "fill-primary text-primary" : undefined}
        aria-pressed={hearted}
        onClick={onHeart}
      />
      <EmojiPicker
        open={pickerOpen}
        onOpenChange={onPickerOpenChange}
        onSelect={onReact}
        trigger={<MessageActionButton label="Add reaction" icon={SmilePlus} />}
      />
      {onReply && <MessageActionButton label="Reply in thread" icon={MessageSquareReply} onClick={onReply} />}
      {onEdit && <MessageActionButton label="Edit message" icon={Pencil} onClick={onEdit} />}
      {onDelete && <MessageActionButton label="Delete message" icon={Trash2} onClick={onDelete} />}
    </div>
  );
}
