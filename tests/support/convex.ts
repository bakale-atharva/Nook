/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

// convex-test locates the `_generated` folder inside this glob to work out
// where the function modules live, so the relative prefix is fine.
export const modules = import.meta.glob("../../convex/**/*.ts");

export const ORG = "org_nook";
export const OTHER_ORG = "org_other";

const PRO_FEATURES = [
  "channels",
  "messages",
  "private_channels",
  "unlimited_channels",
  "full_history",
  "direct_messages",
];
const FREE_FEATURES = ["channels", "messages"];

const MEMBER_PERMISSIONS = ["org:channels:read", "org:messages:send"];
const ADMIN_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "org:channels:manage",
  "org:messages:moderate",
  "org:private_channels:manage",
];

type IdentityOptions = {
  name: string;
  role?: "admin" | "member";
  plan?: "pro" | "free";
  orgId?: string;
};

/** The pieces of Clerk's v2 org claim, before they are nested or flattened. */
function orgClaim({ role = "member", plan = "pro", orgId = ORG }: Omit<IdentityOptions, "name">) {
  const features = plan === "pro" ? PRO_FEATURES : FREE_FEATURES;
  const granted = new Set(role === "admin" ? ADMIN_PERMISSIONS : MEMBER_PERMISSIONS);
  const actions = [...new Set([...granted].map((p) => p.split(":")[2]))].sort();
  const fpm = features.map((feature) =>
    actions.reduce(
      (mask, action, bit) => (granted.has(`org:${feature}:${action}`) ? mask | (1 << bit) : mask),
      0,
    ),
  );
  return {
    id: orgId,
    rol: role,
    per: actions.join(","),
    fpm: fpm.join(","),
    fea: features.map((f) => `o:${f}`).join(","),
  };
}

/**
 * A session identity shaped like Clerk's v2 token: the org claim `o` with a
 * permission list (`per`) and one bitmask per plan feature (`fpm`), aligned
 * with the `fea` claim. Mirrors what convex/lib/auth.ts decodes.
 */
export function identity(options: IdentityOptions) {
  const { fea, ...o } = orgClaim(options);
  return { subject: `user_${options.name}`, o, fea };
}

/** The same identity with the org claim dot-flattened (`o.id`, `o.rol`, ...). */
export function flatIdentity(options: IdentityOptions) {
  const { fea, id, rol, per, fpm } = orgClaim(options);
  return {
    subject: `user_${options.name}`,
    "o.id": id,
    "o.rol": rol,
    "o.per": per,
    "o.fpm": fpm,
    fea,
  };
}

/** The `ConvexError` payload a promise rejects with, or undefined if it resolves. */
export async function errorData(
  promise: Promise<unknown>,
): Promise<Record<string, unknown> | undefined> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ConvexError) return err.data as Record<string, unknown>;
    throw err;
  }
  return undefined;
}

export async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  const data = await errorData(promise);
  return data === undefined ? undefined : (data.code as string | undefined);
}

/** The slice of `ctx.db` convex-test needs to record an upload's Content-Type. */
type StorageMetadataWriter = {
  patch(id: Id<"_storage">, fields: { contentType: string }): Promise<void>;
};

/**
 * Stores a file the way a real browser upload would leave it. convex-test's
 * `storage.store` records only size and hash, while Convex proper also keeps
 * the Content-Type header of the upload, which is what messages.send checks.
 */
export async function storeFile(
  t: ReturnType<typeof convexTest>,
  contentType: string,
  bytes: number,
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)]));
    // `_storage` rows aren't writable through the typed db API; convex-test
    // allows it, which is all a test needs.
    const db = ctx.db as unknown as StorageMetadataWriter;
    await db.patch(storageId, { contentType });
    return storageId;
  });
}

export async function setup() {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const user = (name: string) =>
      ctx.db.insert("users", { clerkUserId: `user_${name}`, name, updatedAt: 0 });
    const alice = await user("alice");
    const bob = await user("bob");
    const carol = await user("carol"); // an org admin who is in no DM
    const dave = await user("dave"); // belongs to a different org
    const join = async (orgId: string, userId: Id<"users">) =>
      ctx.db.insert("orgMemberships", {
        clerkMembershipId: `mem_${orgId}_${userId}`,
        orgId,
        userId,
        role: "org:member",
        updatedAt: 0,
      });
    await join(ORG, alice);
    await join(ORG, bob);
    await join(ORG, carol);
    await join(OTHER_ORG, dave);

    const general = await ctx.db.insert("channels", {
      orgId: ORG,
      name: "general",
      isPrivate: false,
      createdBy: alice,
    });
    const otherChannel = await ctx.db.insert("channels", {
      orgId: ORG,
      name: "random",
      isPrivate: false,
      createdBy: alice,
    });
    for (const channelId of [general, otherChannel]) {
      for (const userId of [alice, bob, carol]) {
        await ctx.db.insert("channelMembers", {
          channelId,
          orgId: ORG,
          userId,
          lastReadAt: 0,
        });
      }
    }
    return { alice, bob, carol, dave, general, otherChannel };
  });

  return {
    t,
    ...seeded,
    asAlice: t.withIdentity(identity({ name: "alice" })),
    asAliceFree: t.withIdentity(identity({ name: "alice", plan: "free" })),
    asBob: t.withIdentity(identity({ name: "bob" })),
    asCarolAdmin: t.withIdentity(identity({ name: "carol", role: "admin" })),
    asCarolFreeAdmin: t.withIdentity(identity({ name: "carol", role: "admin", plan: "free" })),
    asDave: t.withIdentity(identity({ name: "dave", orgId: OTHER_ORG })),
  };
}

export type TestContext = Awaited<ReturnType<typeof setup>>;

export async function firstPage(client: TestContext["asAlice"], channelId: Id<"channels">) {
  return client.query(api.messages.list, {
    channelId,
    paginationOpts: { numItems: 50, cursor: null },
  });
}
