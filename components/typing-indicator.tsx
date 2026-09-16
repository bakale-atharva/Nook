"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function TypingIndicator({ channelId }: { channelId: Id<"channels"> }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const typers = useQuery(api.typing.list, { channelId, now });

  if (!typers || typers.length === 0) {
    return <div className="h-5 px-4" />;
  }

  const names = typers.map((t) => t.name);
  const text =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : `${names.length} people are typing…`;

  return <div className="h-5 px-4 text-xs text-muted-foreground">{text}</div>;
}
