import { Fragment } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { splitBody } from "@/lib/mentions";
import { cn } from "@/lib/utils";

export function EditedTag() {
  return <span className="text-label">edited</span>;
}

/**
 * Renders a stored body: plain text, with `<@id>` tokens as @Name chips.
 * `edited` appends the "edited" tag inline (used when there's no header line
 * to carry it).
 */
export function MessageBody({
  body,
  mentionedUsers,
  currentUserId,
  edited = false,
}: {
  body: string;
  mentionedUsers: { id: string; name: string }[];
  currentUserId: Id<"users"> | undefined;
  edited?: boolean;
}) {
  const names = new Map(mentionedUsers.map((u) => [u.id, u.name]));
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {splitBody(body).map((segment, i) =>
        segment.type === "text" ? (
          <Fragment key={i}>{segment.text}</Fragment>
        ) : (
          <span
            key={i}
            className={cn(
              "rounded-sm px-1 font-medium text-primary",
              segment.id === currentUserId ? "bg-primary/20" : "bg-primary/10",
            )}
          >
            @{names.get(segment.id) ?? "unknown"}
          </span>
        ),
      )}
      {edited && (
        <span className="ml-1.5">
          <EditedTag />
        </span>
      )}
    </p>
  );
}
