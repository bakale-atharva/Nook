import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/utils";

type Member = {
  userId: string;
  name: string;
  imageUrl?: string;
  deleted: boolean;
};

export function MemberSidebar({
  members,
}: {
  members: Member[] | undefined;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l sm:flex">
      <div className="border-b px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Members {members ? `— ${members.length}` : ""}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {members === undefined ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : members.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <Avatar className="size-8">
                  <AvatarImage src={m.imageUrl} alt={m.name} />
                  <AvatarFallback className="text-xs">
                    {initials(m.deleted ? "Deleted user" : m.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={
                    m.deleted
                      ? "truncate text-sm text-muted-foreground italic"
                      : "truncate text-sm"
                  }
                >
                  {m.deleted ? "Deleted user" : m.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
