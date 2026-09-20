import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "../tests/support/convex";
import {
  membershipData,
  orgData,
  postWebhook,
  subscriptionData,
  userData,
} from "../tests/support/webhook";

/**
 * These go through the real `/clerk-webhook` endpoint (signature check,
 * dispatch, mutations) so they keep passing however the handlers are
 * organised underneath.
 */

afterEach(() => {
  vi.useRealTimers();
});

function newTest() {
  return convexTest(schema, modules);
}
type T = ReturnType<typeof newTest>;

const users = (t: T) => t.run((ctx) => ctx.db.query("users").collect());
const orgs = (t: T) => t.run((ctx) => ctx.db.query("organizations").collect());
const memberships = (t: T) => t.run((ctx) => ctx.db.query("orgMemberships").collect());

async function ok(t: T, type: string, data: unknown) {
  const res = await postWebhook(t, { type, data });
  expect(res.status).toBe(200);
}

describe("webhook endpoint", () => {
  test("rejects a bad signature and changes nothing", async () => {
    const t = newTest();
    const res = await postWebhook(t, { type: "user.created", data: userData() }, { forgeSignature: true });
    expect(res.status).toBe(400);
    expect(await users(t)).toEqual([]);
  });

  test("acknowledges event types it does not handle", async () => {
    const t = newTest();
    const res = await postWebhook(t, { type: "session.created", data: { id: "sess_1" } });
    expect(res.status).toBe(200);
    expect(await users(t)).toEqual([]);
  });
});

describe("users", () => {
  test("user.created stores the profile, using the primary email", async () => {
    const t = newTest();
    await ok(t, "user.created", userData());
    expect(await users(t)).toMatchObject([
      {
        clerkUserId: "user_zed",
        name: "Zed Adams",
        imageUrl: "https://img.example/zed.png",
        email: "zed@example.com",
        updatedAt: 1_700_000_001_000,
      },
    ]);
  });

  test("the name falls back to the username, then to Unknown", async () => {
    const t = newTest();
    await ok(t, "user.created", userData({ id: "user_a", first_name: null, last_name: null, username: "zed_u" }));
    await ok(t, "user.created", userData({ id: "user_b", first_name: null, last_name: null, username: null }));
    await ok(t, "user.created", userData({ id: "user_c", first_name: "Solo", last_name: null }));
    const byId = Object.fromEntries((await users(t)).map((u) => [u.clerkUserId, u.name]));
    expect(byId).toEqual({ user_a: "zed_u", user_b: "Unknown", user_c: "Solo" });
  });

  test("no primary email means no email", async () => {
    const t = newTest();
    await ok(t, "user.created", userData({ primary_email_address_id: null }));
    expect((await users(t))[0].email).toBeUndefined();
  });

  test("user.updated applies newer events and drops out-of-order ones", async () => {
    const t = newTest();
    await ok(t, "user.created", userData({ updated_at: 2000 }));
    await ok(t, "user.updated", userData({ first_name: "Stale", updated_at: 1000 }));
    expect((await users(t))[0]).toMatchObject({ name: "Zed Adams", updatedAt: 2000 });
    await ok(t, "user.updated", userData({ first_name: "Fresh", updated_at: 3000 }));
    expect(await users(t)).toMatchObject([{ name: "Fresh Adams", updatedAt: 3000 }]);
  });

  test("user.deleted soft-deletes and removes their channel memberships in every org", async () => {
    vi.useFakeTimers();
    const t = newTest();
    await ok(t, "user.created", userData());
    await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").collect())[0];
      const creator = user._id;
      for (const orgId of ["org_a", "org_b"]) {
        const channelId = await ctx.db.insert("channels", {
          orgId,
          name: "general",
          isPrivate: false,
          createdBy: creator,
        });
        await ctx.db.insert("channelMembers", { channelId, orgId, userId: user._id, lastReadAt: 0 });
      }
    });
    await ok(t, "user.deleted", { id: "user_zed", deleted: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [user] = await users(t);
    expect(user.deletedAt).toEqual(expect.any(Number));
    expect(await t.run((ctx) => ctx.db.query("channelMembers").collect())).toEqual([]);
  });

  test("user.deleted for an unknown user is a no-op", async () => {
    const t = newTest();
    await ok(t, "user.deleted", { id: "user_nobody", deleted: true });
    expect(await users(t)).toEqual([]);
  });
});

describe("organizations", () => {
  test("organization.created stores it, and updates respect ordering", async () => {
    const t = newTest();
    await ok(t, "organization.created", orgData({ updated_at: 2000 }));
    expect(await orgs(t)).toMatchObject([
      { clerkOrgId: "org_acme", name: "Acme", slug: "acme", imageUrl: "https://img.example/acme.png", updatedAt: 2000 },
    ]);
    await ok(t, "organization.updated", orgData({ name: "Stale", updated_at: 1000 }));
    expect((await orgs(t))[0].name).toBe("Acme");
    await ok(t, "organization.updated", orgData({ name: "Acme Inc", slug: "acme-inc", updated_at: 3000 }));
    expect(await orgs(t)).toMatchObject([{ name: "Acme Inc", slug: "acme-inc", updatedAt: 3000 }]);
  });

  test("organization.deleted removes the org, its channels and its memberships", async () => {
    vi.useFakeTimers();
    const t = newTest();
    await ok(t, "organization.created", orgData());
    await ok(t, "user.created", userData());
    await ok(t, "organizationMembership.created", membershipData());
    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      const channelId = await ctx.db.insert("channels", {
        orgId: "org_acme",
        name: "general",
        isPrivate: false,
        createdBy: user._id,
      });
      await ctx.db.insert("channelMembers", { channelId, orgId: "org_acme", userId: user._id, lastReadAt: 0 });
      await ctx.db.insert("messages", { channelId, orgId: "org_acme", authorId: user._id, body: "hi" });
      // Another org's data must survive.
      const other = await ctx.db.insert("channels", {
        orgId: "org_keep",
        name: "keep",
        isPrivate: false,
        createdBy: user._id,
      });
      await ctx.db.insert("orgMemberships", {
        clerkMembershipId: "orgmem_keep",
        orgId: "org_keep",
        userId: user._id,
        role: "org:member",
        updatedAt: 0,
      });
      expect(other).toBeTruthy();
    });

    await ok(t, "organization.deleted", { id: "org_acme", deleted: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await orgs(t)).toEqual([]);
    const channels = await t.run((ctx) => ctx.db.query("channels").collect());
    expect(channels.map((c) => c.orgId)).toEqual(["org_keep"]);
    expect((await memberships(t)).map((m) => m.orgId)).toEqual(["org_keep"]);
    expect(await t.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("channelMembers").collect())).toEqual([]);
  });
});

describe("memberships", () => {
  test("created links the user to the org; updates change the role, ordered", async () => {
    const t = newTest();
    await ok(t, "user.created", userData());
    await ok(t, "organizationMembership.created", membershipData({ updated_at: 2000 }));
    const [user] = await users(t);
    expect(await memberships(t)).toMatchObject([
      { clerkMembershipId: "orgmem_1", orgId: "org_acme", userId: user._id, role: "org:member", updatedAt: 2000 },
    ]);
    await ok(t, "organizationMembership.updated", membershipData({ role: "org:stale", updated_at: 1000 }));
    expect((await memberships(t))[0].role).toBe("org:member");
    await ok(t, "organizationMembership.updated", membershipData({ role: "org:admin", updated_at: 3000 }));
    expect(await memberships(t)).toMatchObject([{ role: "org:admin", updatedAt: 3000 }]);
  });

  test("a membership that arrives before its user is retried until the user exists", async () => {
    vi.useFakeTimers();
    const t = newTest();
    await ok(t, "organizationMembership.created", membershipData());
    expect(await memberships(t)).toEqual([]);

    await ok(t, "user.created", userData());
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [user] = await users(t);
    expect(await memberships(t)).toMatchObject([{ userId: user._id, orgId: "org_acme" }]);
  });

  test("deleted removes the membership and that org's channel memberships only", async () => {
    const t = newTest();
    await ok(t, "user.created", userData());
    await ok(t, "organizationMembership.created", membershipData());
    await t.run(async (ctx) => {
      const [user] = await ctx.db.query("users").collect();
      for (const orgId of ["org_acme", "org_keep"]) {
        const channelId = await ctx.db.insert("channels", {
          orgId,
          name: orgId,
          isPrivate: false,
          createdBy: user._id,
        });
        await ctx.db.insert("channelMembers", { channelId, orgId, userId: user._id, lastReadAt: 0 });
      }
    });
    await ok(t, "organizationMembership.deleted", { id: "orgmem_1", deleted: true });
    expect(await memberships(t)).toEqual([]);
    const left = await t.run((ctx) => ctx.db.query("channelMembers").collect());
    expect(left.map((m) => m.orgId)).toEqual(["org_keep"]);
  });

  test("deleting an unknown membership is a no-op", async () => {
    const t = newTest();
    await ok(t, "organizationMembership.deleted", { id: "orgmem_none", deleted: true });
    expect(await memberships(t)).toEqual([]);
  });
});

describe("subscriptions", () => {
  test("records the plan slug and status on the org", async () => {
    const t = newTest();
    await ok(t, "organization.created", orgData());
    await ok(t, "subscription.created", subscriptionData({ status: "active", planSlug: "pro" }));
    expect(await orgs(t)).toMatchObject([{ plan: "pro", subscriptionStatus: "active" }]);
    await ok(t, "subscription.pastDue", subscriptionData({ status: "past_due", planSlug: "pro" }));
    expect((await orgs(t))[0].subscriptionStatus).toBe("past_due");
  });

  test("a subscription with no plan clears the plan", async () => {
    const t = newTest();
    await ok(t, "organization.created", orgData());
    await ok(t, "subscription.created", subscriptionData({ planSlug: "pro" }));
    await ok(t, "subscription.updated", subscriptionData({ status: "ended", planSlug: null }));
    const [org] = await orgs(t);
    expect(org.plan).toBeUndefined();
    expect(org.subscriptionStatus).toBe("ended");
  });

  test("user-level payers and unknown orgs are ignored", async () => {
    const t = newTest();
    await ok(t, "organization.created", orgData());
    await ok(t, "subscription.created", subscriptionData({ organizationId: undefined }));
    await ok(t, "subscription.created", subscriptionData({ organizationId: "org_unknown" }));
    expect((await orgs(t))[0].plan).toBeUndefined();
  });
});

describe("backfill mutations", () => {
  test("user, org and membership upserts are idempotent and ordered", async () => {
    const t = newTest();
    const user = { clerkUserId: "user_b", name: "Backfilled", updatedAt: 10 };
    await t.mutation(internal.clerkSync.upsertUser, user);
    await t.mutation(internal.clerkSync.upsertUser, { ...user, name: "Stale", updatedAt: 5 });
    await t.mutation(internal.clerkSync.upsertUser, { ...user, name: "Newer", updatedAt: 20 });
    expect(await users(t)).toMatchObject([{ name: "Newer", updatedAt: 20 }]);

    const org = { clerkOrgId: "org_b", name: "B", slug: "b", updatedAt: 10 };
    await t.mutation(internal.clerkSync.upsertOrg, org);
    await t.mutation(internal.clerkSync.upsertOrg, { ...org, name: "Stale", updatedAt: 5 });
    expect(await orgs(t)).toMatchObject([{ name: "B" }]);

    const membership = {
      clerkMembershipId: "m_b",
      orgId: "org_b",
      clerkUserId: "user_b",
      role: "org:member",
      updatedAt: 10,
    };
    await t.mutation(internal.clerkSync.upsertMembershipRow, membership);
    await t.mutation(internal.clerkSync.upsertMembershipRow, { ...membership, role: "org:admin", updatedAt: 11 });
    expect(await memberships(t)).toMatchObject([{ role: "org:admin" }]);
    // A membership for a user that doesn't exist is skipped, not retried.
    await t.mutation(internal.clerkSync.upsertMembershipRow, {
      ...membership,
      clerkMembershipId: "m_ghost",
      clerkUserId: "user_ghost",
    });
    expect(await memberships(t)).toHaveLength(1);
  });
});
