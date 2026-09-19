import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

/**
 * A person's avatar: their image, or their initials while it loads or when
 * they have none. Decorative (empty alt) because the name is always shown
 * next to it.
 */
export function UserAvatar({
  name,
  imageUrl,
  className,
  fallbackClassName,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={imageUrl} alt="" />
      <AvatarFallback className={fallbackClassName}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
