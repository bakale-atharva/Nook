/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as channels from "../channels.js";
import type * as cleanup from "../cleanup.js";
import type * as clerkSync from "../clerkSync.js";
import type * as dms from "../dms.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_channelAccess from "../lib/channelAccess.js";
import type * as lib_mentions from "../lib/mentions.js";
import type * as lib_messageCleanup from "../lib/messageCleanup.js";
import type * as messages from "../messages.js";
import type * as organizations from "../organizations.js";
import type * as reactions from "../reactions.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  channels: typeof channels;
  cleanup: typeof cleanup;
  clerkSync: typeof clerkSync;
  dms: typeof dms;
  files: typeof files;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/channelAccess": typeof lib_channelAccess;
  "lib/mentions": typeof lib_mentions;
  "lib/messageCleanup": typeof lib_messageCleanup;
  messages: typeof messages;
  organizations: typeof organizations;
  reactions: typeof reactions;
  typing: typeof typing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
