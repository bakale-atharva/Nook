"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MessageSquare } from "lucide-react";

export default function WorkspaceHomePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const channels = useQuery(api.channels.list);

  useEffect(() => {
    if (channels && channels.length > 0) {
      router.replace(`/w/${params.slug}/c/${channels[0]._id}`);
    }
  }, [channels, params.slug, router]);

  if (channels === undefined || channels.length > 0) {
    return null; // loading, or about to redirect
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <MessageSquare className="size-8 text-muted-foreground" />
      <p className="font-medium">No channels yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {"An admin can create the first channel from the sidebar's + button."}
      </p>
    </div>
  );
}
