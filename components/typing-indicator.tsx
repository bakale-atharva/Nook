"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const names = new Intl.ListFormat([], { style: "long", type: "conjunction" });

function typingText(typers: string[]) {
  if (typers.length > 2) return `${typers.length} people are typing…`;
  return `${names.format(typers)} ${typers.length === 1 ? "is" : "are"} typing…`;
}

export function TypingIndicator({ channelId }: { channelId: Id<"channels"> }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const typers = useQuery(api.typing.list, { channelId, now });

  // One persistent live region: its content changes, the region itself never
  // unmounts, so screen readers announce who starts typing.
  return (
    <div aria-live="polite" className="text-label flex h-5 items-center gap-1.5 px-4">
      {typers && typers.length > 0 && (
        <>
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-live" />
          {typingText(typers.map((t) => t.name))}
        </>
      )}
    </div>
  );
}
