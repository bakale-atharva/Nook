import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { FREE_CHANNEL_LIMIT } from "@/convex/lib/constants";
import type { ErrorCode, PlanLimit } from "@/convex/lib/errors";

type ConvexErrorData = {
  code?: string;
  message?: string;
  max?: number;
  limit?: string;
};

/** The payload of a ConvexError, or an empty object for anything else. */
function errorData(err: unknown): ConvexErrorData {
  // `ConvexError(null)` and string payloads are legal, so don't assume an object.
  return err instanceof ConvexError && typeof err.data === "object" && err.data !== null
    ? err.data
    : {};
}

/** The application error code the server threw, if this is one of ours. */
export function convexErrorCode(err: unknown): ErrorCode | undefined {
  return errorData(err).code as ErrorCode | undefined;
}

/** Which plan limit was hit, when `err` is a PLAN_LIMIT the app knows how to explain. */
export function planLimitOf(err: unknown): PlanLimit | null {
  const { code, limit } = errorData(err);
  if (code !== "PLAN_LIMIT") return null;
  return limit === "channels" || limit === "direct_messages" ? limit : null;
}

/** What to tell someone who hit `limit`, both in errors and in the upgrade dialog. */
export function planLimitMessage(limit: PlanLimit, max = FREE_CHANNEL_LIMIT): string {
  switch (limit) {
    case "channels":
      return `Free orgs are limited to ${max} channels. Upgrade to Pro for unlimited channels.`;
    case "direct_messages":
      return "Direct messages are a Pro feature. Upgrade to message teammates directly.";
  }
}

/** Turns a thrown ConvexError({code, message, ...}) into UI-friendly text. */
export function convexErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!(err instanceof ConvexError)) return fallback;
  const data = errorData(err);
  switch (data.code) {
    case "PLAN_LIMIT": {
      const limit = planLimitOf(err);
      return limit
        ? planLimitMessage(limit, data.max)
        : "You've hit a plan limit. Upgrade to Pro to continue.";
    }
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
