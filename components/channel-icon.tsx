import { Hash, Lock, MessageSquare } from "lucide-react";

/** The glyph for a channel: a bubble for a DM, a lock for private, a hash otherwise. */
export function ChannelIcon({
  isDm,
  isPrivate,
  className,
}: {
  isDm: boolean;
  isPrivate: boolean;
  className?: string;
}) {
  const Icon = isDm ? MessageSquare : isPrivate ? Lock : Hash;
  return <Icon aria-hidden className={className} />;
}
