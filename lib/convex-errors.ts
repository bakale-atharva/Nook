import { ConvexError } from "convex/values";
import { FREE_CHANNEL_LIMIT } from "@/convex/lib/constants";

type ConvexErrorData = {
  code?: string;
  message?: string;
  max?: number;
  limit?: string;
};

/** Turns a thrown ConvexError({code, message, ...}) into UI-friendly text. */
export function convexErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!(err instanceof ConvexError)) return fallback;
  const data = err.data as ConvexErrorData;
  switch (data.code) {
    case "PLAN_LIMIT":
      if (data.limit === "channels") {
        return `Free orgs are limited to ${data.max ?? FREE_CHANNEL_LIMIT} channels. Upgrade to Pro for unlimited channels.`;
      }
      if (data.limit === "direct_messages") {
        return "Direct messages are a Pro feature. Upgrade to message teammates directly.";
      }
      return "You've hit a plan limit. Upgrade to Pro to continue.";
    case "DUPLICATE_NAME":
      return data.message ?? "That name is already taken.";
    case "FORBIDDEN":
      return "You don't have permission to do that.";
    case "NO_ACTIVE_ORG":
      return "Pick or create an organization first.";
    case "UNAUTHENTICATED":
      return "Please sign in.";
    case "NOT_FOUND":
      return data.message ?? "Not found.";
    default:
      return data.message ?? fallback;
  }
}
