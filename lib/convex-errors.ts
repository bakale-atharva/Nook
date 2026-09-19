import { ConvexError } from "convex/values";
import { toast } from "sonner";
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
  // `ConvexError(null)` and string payloads are legal, so don't assume an object.
  const data: ConvexErrorData =
    typeof err.data === "object" && err.data !== null ? err.data : {};
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

/** Shows a failed Convex call as a toast, using the server's message when it has one. */
export function toastConvexError(err: unknown, fallback?: string): void {
  toast.error(convexErrorMessage(err, fallback));
}
