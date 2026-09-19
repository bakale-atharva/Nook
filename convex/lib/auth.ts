import type { Auth, UserIdentity } from "convex/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Feature, Permission } from "./constants";
import {
  missingPermission,
  noActiveOrg,
  notFound,
  unauthenticated,
  userNotSynced,
} from "./errors";
import { getUserByClerkId } from "./lookups";

/**
 * Decoded shape of Clerk's v2 session-token organization claim (`o`).
 * See https://clerk.com/docs/guides/sessions/session-tokens for the wire
 * format — this is what `ctx.auth.getUserIdentity()` surfaces it as.
 */
type OrgClaim = {
  id: string;
  slg?: string;
  rol: string; // role WITHOUT the "org:" prefix, e.g. "admin"
  per?: string; // comma-separated permission names, no "org:" prefix
  fpm?: string; // comma-separated feature-permission bitmasks
};

/**
 * Reads a claim that may arrive either as a nested object (`identity.o`) or
 * dot-flattened (`identity["o.id"]`) — Convex's Custom JWT auth flattens
 * nested claims, but the exact shape for Clerk's OIDC-style provider isn't
 * guaranteed across SDK versions, so we accept both defensively.
 */
function readOrgClaim(identity: UserIdentity): OrgClaim | null {
  const nested = identity.o as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    if (typeof nested.id === "string" && typeof nested.rol === "string") {
      return {
        id: nested.id,
        slg: typeof nested.slg === "string" ? nested.slg : undefined,
        rol: nested.rol,
        per: typeof nested.per === "string" ? nested.per : undefined,
        fpm: typeof nested.fpm === "string" ? nested.fpm : undefined,
      };
    }
    return null;
  }
  const id = identity["o.id"];
  const rol = identity["o.rol"];
  if (typeof id === "string" && typeof rol === "string") {
    const slg = identity["o.slg"];
    const per = identity["o.per"];
    const fpm = identity["o.fpm"];
    return {
      id,
      rol,
      slg: typeof slg === "string" ? slg : undefined,
      per: typeof per === "string" ? per : undefined,
      fpm: typeof fpm === "string" ? fpm : undefined,
    };
  }
  return null;
}

/** Parses the `fea` claim (e.g. "o:channels,o:messages") into feature keys. */
function readFeatures(identity: UserIdentity): string[] {
  const fea = identity.fea;
  if (typeof fea !== "string" || fea.length === 0) return [];
  return fea
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => (f.includes(":") ? f.split(":", 2)[1] : f));
}

/**
 * Decodes Clerk's compact per-feature permission bitmask into fully
 * qualified `org:<feature>:<action>` permission strings.
 *
 * `o.per` is a flat, feature-agnostic list of permission action names (e.g.
 * "manage,moderate,read,send") — NOT "feature:action" pairs. `o.fpm` has one
 * comma-separated bitmask per Feature, aligned to the `fea` claim's feature
 * order. Each bit in a feature's mask (bit 0 = least significant = first
 * entry in `o.per`) says whether that action applies to that feature. See
 * https://clerk.com/docs/guides/sessions/session-tokens#decode-o-fpm-manually
 */
function decodeOrgPermissions(
  per: string | undefined,
  fpm: string | undefined,
  features: string[],
): Set<string> {
  const actions = (per ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const masks = (fpm ?? "").split(",").map((m) => m.trim());
  const permissions = new Set<string>();
  features.forEach((feature, featureIndex) => {
    const mask = Number(masks[featureIndex]);
    if (!Number.isFinite(mask)) return;
    actions.forEach((action, bitIndex) => {
      if ((mask >> bitIndex) & 1) {
        permissions.add(`org:${feature}:${action}`);
      }
    });
  });
  return permissions;
}

export type OrgIdentity = {
  identity: UserIdentity;
  orgId: string;
  orgSlug: string | undefined;
  role: string; // "org:admin" | "org:member"
  permissions: Set<string>; // e.g. "org:channels:manage"
  features: Set<string>; // e.g. "channels", "full_history"
};

/**
 * Requires an authenticated caller with an active Clerk Organization.
 * Throws a ConvexError the client can branch on:
 *  - code "UNAUTHENTICATED": no session at all -> send to /sign-in
 *  - code "NO_ACTIVE_ORG": signed in, no active org -> send to /onboarding
 */
export async function requireOrgIdentity(ctx: {
  auth: Auth;
}): Promise<OrgIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw unauthenticated();
  }
  const org = readOrgClaim(identity);
  if (!org) {
    throw noActiveOrg();
  }
  const features = readFeatures(identity);
  return {
    identity,
    orgId: org.id,
    orgSlug: org.slg,
    role: `org:${org.rol}`,
    permissions: decodeOrgPermissions(org.per, org.fpm, features),
    features: new Set(features),
  };
}

/** Throws FORBIDDEN unless the caller holds `permission` (e.g. "org:channels:manage"). */
export function requirePermission(org: OrgIdentity, permission: Permission): void {
  if (!org.permissions.has(permission)) {
    throw missingPermission(permission);
  }
}

/** Whether the org's active plan includes `feature` (e.g. "unlimited_channels"). */
export function hasFeature(org: OrgIdentity, feature: Feature): boolean {
  return org.features.has(feature);
}

/** Throws NOT_FOUND if `resourceOrgId` doesn't match the caller's active org. */
export function assertSameOrg(org: OrgIdentity, resourceOrgId: string): void {
  if (org.orgId !== resourceOrgId) {
    throw notFound();
  }
}

/**
 * Looks up (never creates) the synced `users` row for the caller. Most
 * functions should use this; `users.store` is the only place that upserts.
 */
export async function getSyncedUser(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
): Promise<Doc<"users"> | null> {
  return await getUserByClerkId(ctx, org.identity.subject);
}

/** Like getSyncedUser, but throws if the webhook/store sync hasn't happened yet. */
export async function requireSyncedUser(
  ctx: QueryCtx | MutationCtx,
  org: OrgIdentity,
): Promise<Doc<"users">> {
  const user = await getSyncedUser(ctx, org);
  if (!user) {
    throw userNotSynced();
  }
  return user;
}

/**
 * The common handler preamble: an active org, then (optionally) a Clerk
 * permission, then the caller's synced `users` row - checked in that order,
 * which decides which error wins when several apply.
 */
export async function requireCaller(
  ctx: QueryCtx | MutationCtx,
  permission?: Permission,
): Promise<{ org: OrgIdentity; user: Doc<"users"> }> {
  const org = await requireOrgIdentity(ctx);
  if (permission) requirePermission(org, permission);
  const user = await requireSyncedUser(ctx, org);
  return { org, user };
}

/** requireCaller without the user lookup, for handlers that don't need one. */
export async function requireOrgWith(
  ctx: { auth: Auth },
  permission: Permission,
): Promise<OrgIdentity> {
  const org = await requireOrgIdentity(ctx);
  requirePermission(org, permission);
  return org;
}
