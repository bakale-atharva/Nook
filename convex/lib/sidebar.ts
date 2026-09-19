import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { hasFeature, type OrgIdentity } from "./auth";
import { isDm } from "./channelAccess";
import {
  FEATURES,
  MAX_DM_MEMBERS_SHOWN,
  MAX_ROWS_LISTED,
  UNREAD_CAP,
} from "./constants";
import { regularChannels } from "./lookups";
import { displayImage, displayName } from "./users";

/**
 * The caller's sidebar: public channels, private channels they belong to and,
 * on plans with direct messages, their DMs. Each carries the caller's
 * membership state, an unread count (capped at UNREAD_CAP+1 reads, shown by
 * the client as "99+"), and how many of those unread messages @mention them.
 * Thread replies never count toward unread.
 */
export async function listSidebarChannels(
  ctx: QueryCtx,
  org: OrgIdentity,
  user: Doc<"users">,
) {
  // dmKey === undefined selects regular channels only, so a busy org's
  // DMs never crowd this scan or get read by people outside them.
  const channels = await regularChannels(ctx, org.orgId).take(MAX_ROWS_LISTED);

  const memberships = await ctx.db
    .query("channelMembers")
    .withIndex("by_org_user", (q) => q.eq("orgId", org.orgId).eq("userId", user._id))
    .take(MAX_ROWS_LISTED);
  const membershipByChannel = new Map(memberships.map((m) => [m.channelId, m]));

  const visible = channels.filter((c) => !c.isPrivate || membershipByChannel.has(c._id));

  // Memberships that aren't a regular channel are DMs (or dangling rows).
  let dms: Doc<"channels">[] = [];
  if (hasFeature(org, FEATURES.DIRECT_MESSAGES)) {
    const regularIds = new Set(channels.map((c) => c._id));
    const candidates = await Promise.all(
      memberships
        .filter((m) => !regularIds.has(m.channelId))
        .map((m) => ctx.db.get(m.channelId)),
    );
    dms = candidates
      .filter((c): c is Doc<"channels"> => !!c && isDm(c))
      .sort(
        (a, b) =>
          (b.lastMessageAt ?? b._creationTime) - (a.lastMessageAt ?? a._creationTime),
      );
  }

  return await Promise.all(
    [...visible, ...dms].map(async (channel) => {
      const membership = membershipByChannel.get(channel._id);
      let unreadCount = 0;
      let unreadCapped = false;
      let mentionCount = 0;
      if (membership) {
        const unread = await ctx.db
          .query("messages")
          .withIndex("by_channel_thread", (q) =>
            q
              .eq("channelId", channel._id)
              .eq("threadRootId", undefined)
              .gt("_creationTime", membership.lastReadAt),
          )
          .take(UNREAD_CAP + 1);
        unreadCount = Math.min(unread.length, UNREAD_CAP);
        unreadCapped = unread.length > UNREAD_CAP;
        mentionCount = unread.filter((m) => m.mentions?.includes(user._id)).length;
      }

      let dmMembers: {
        userId: Id<"users">;
        name: string;
        imageUrl: string | undefined;
      }[] = [];
      if (isDm(channel)) {
        const rows = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) => q.eq("channelId", channel._id))
          .take(MAX_DM_MEMBERS_SHOWN);
        dmMembers = await Promise.all(
          rows.map(async (row) => {
            const u = await ctx.db.get(row.userId);
            return { userId: row.userId, name: displayName(u), imageUrl: displayImage(u) };
          }),
        );
      }

      return {
        ...channel,
        isDm: isDm(channel),
        isMember: !!membership,
        starred: membership?.starred ?? false,
        unreadCount,
        unreadCapped,
        mentionCount,
        dmMembers,
      };
    }),
  );
}
