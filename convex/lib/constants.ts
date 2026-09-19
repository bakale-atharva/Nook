// Pure constants (no Convex runtime imports) so both the backend and the
// Next.js client can import them and never drift apart.

// --- Plan features and permissions (Clerk) ------------------------------
// `has({ feature })` / `has({ permission })` on the client and the decoded
// session claims on the server use these same strings.

export const FEATURES = {
  DIRECT_MESSAGES: "direct_messages",
  UNLIMITED_CHANNELS: "unlimited_channels",
  FULL_HISTORY: "full_history",
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export const PERMISSIONS = {
  CHANNELS_READ: "org:channels:read",
  CHANNELS_MANAGE: "org:channels:manage",
  PRIVATE_CHANNELS_MANAGE: "org:private_channels:manage",
  MESSAGES_SEND: "org:messages:send",
  MESSAGES_MODERATE: "org:messages:moderate",
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// --- Plan limits ---------------------------------------------------------

export const FREE_CHANNEL_LIMIT = 5;
export const FREE_HISTORY_LIMIT = 30;

// --- Messages ------------------------------------------------------------

export const MAX_BODY_LENGTH = 4000;
export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 20000;
export const ALLOWED_IMAGE_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];
export const MAX_THREAD_REPLIES = 200;
export const MAX_REACTIONS_READ = 200;
export const MAX_EMOJI_LENGTH = 16;
export const MAX_DISTINCT_EMOJI = 20;
export const MAX_MENTIONS = 20;

// --- Direct messages and sidebar -----------------------------------------

/** DMs are strictly one-to-one: the caller and one other person. */
export const DM_MEMBER_COUNT = 2;
export const UNREAD_CAP = 99;

// --- Query and cleanup bounds --------------------------------------------

/** Upper bound on rows read for org/channel-wide lists (members, channels). */
export const MAX_ROWS_LISTED = 500;
export const TYPING_TTL_MS = 6000;
export const MAX_TYPING_LISTED = 20;
export const TYPING_SWEEP_BATCH = 5;

/** Rows deleted per scheduled invocation, so no mutation grows unbounded. */
export const REACTION_DELETE_BATCH = 200;
export const REPLY_DELETE_BATCH = 25;
export const MESSAGE_CASCADE_BATCH = 50;
export const ROW_DELETE_BATCH = 100;
export const CHANNEL_CASCADE_PAGE = 25;

// --- Copy ----------------------------------------------------------------

export const DELETED_USER_NAME = "Deleted user";
