import { auth } from "@clerk/nextjs/server";
import type { Id } from "@/convex/_generated/dataModel";
import { ChannelView } from "@/components/channel/channel-view";

export default async function ChannelPage({ params }: PageProps<"/org/[slug]/c/[channelId]">) {
  await auth.protect();
  const { slug, channelId } = await params;
  // Keyed by channel so an open thread never carries over to another channel.
  return <ChannelView key={channelId} slug={slug} channelId={channelId as Id<"channels">} />;
}
