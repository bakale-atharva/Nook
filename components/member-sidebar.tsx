import { DELETED_USER_NAME } from "@/convex/lib/constants";
import { SkeletonRows } from "@/components/skeleton-rows";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

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
    <aside aria-label="Members" className="hidden w-60 shrink-0 flex-col border-l sm:flex">
      <div className="border-b px-4 py-3">
        <h2 className="font-sans text-xs font-semibold tracking-normal text-muted-foreground uppercase">
          Members
          {members && <span className="font-tabular"> — {members.length}</span>}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {members === undefined ? (
          <div className="space-y-2 p-2">
            <SkeletonRows count={3} className="h-9 w-full" />
          </div>
        ) : members.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <UserAvatar
                  name={m.deleted ? DELETED_USER_NAME : m.name}
                  imageUrl={m.imageUrl}
                  className="size-8"
                  fallbackClassName="text-xs"
                />
                <span
                  className={cn("truncate text-sm", m.deleted && "text-muted-foreground italic")}
                >
                  {m.deleted ? DELETED_USER_NAME : m.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
