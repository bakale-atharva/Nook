import { ConvexError } from "convex/values";

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
      return data.limit === "channels"
        ? `Free orgs are limited to ${data.max ?? 5} channels. Upgrade to Pro for unlimited channels.`
        : "You've hit a plan limit. Upgrade to Pro to continue.";
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
