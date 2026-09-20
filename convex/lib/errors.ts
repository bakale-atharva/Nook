import { ConvexError } from "convex/values";

/**
 * The application errors the client branches on (see lib/convex-errors.ts).
 * Every one is a `ConvexError` carrying `{ code, ... }`; build them with the
 * constructors below so each code keeps exactly one payload shape.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "NO_ACTIVE_ORG"
  | "USER_NOT_SYNCED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "PLAN_LIMIT"
  | "DUPLICATE_NAME";

export type PlanLimit = "channels" | "direct_messages";

export type ErrorPayload =
  | { code: "UNAUTHENTICATED" | "NO_ACTIVE_ORG" | "USER_NOT_SYNCED" }
  | { code: "NOT_FOUND"; message?: string }
  | { code: "FORBIDDEN"; message?: string; permission?: string }
  | { code: "INVALID_ARGUMENT" | "DUPLICATE_NAME"; message: string }
  | { code: "PLAN_LIMIT"; limit: PlanLimit; max?: number };

type AppError = ConvexError<ErrorPayload>;

const fail = (payload: ErrorPayload): AppError => new ConvexError(payload);

export const unauthenticated = () => fail({ code: "UNAUTHENTICATED" });
export const noActiveOrg = () => fail({ code: "NO_ACTIVE_ORG" });
export const userNotSynced = () => fail({ code: "USER_NOT_SYNCED" });

/** `message` is only attached when given; Convex values can't hold `undefined`. */
export const notFound = (message?: string) =>
  fail(message === undefined ? { code: "NOT_FOUND" } : { code: "NOT_FOUND", message });

/** The caller lacks a Clerk permission (payload names it). */
export const missingPermission = (permission: string) =>
  fail({ code: "FORBIDDEN", permission });

/** The caller is not allowed to do this, with a message to show. */
export const forbidden = (message: string) => fail({ code: "FORBIDDEN", message });

export const invalidArgument = (message: string) =>
  fail({ code: "INVALID_ARGUMENT", message });

export const duplicateName = (message: string) => fail({ code: "DUPLICATE_NAME", message });

export const planLimit = (limit: PlanLimit, max?: number) =>
  fail(max === undefined ? { code: "PLAN_LIMIT", limit } : { code: "PLAN_LIMIT", limit, max });

/** The `code` of an application error, or undefined for anything else. */
export function errorCodeOf(err: unknown): ErrorCode | undefined {
  if (!(err instanceof ConvexError)) return undefined;
  const data: unknown = err.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? (data.code as ErrorCode) : undefined;
}
