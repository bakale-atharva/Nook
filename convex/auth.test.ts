import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  errorData,
  firstPage,
  flatIdentity,
  identity,
  setup,
} from "../tests/support/convex";

describe("identity", () => {
  test("no session at all is UNAUTHENTICATED", async () => {
    const { t } = await setup();
    expect(await errorData(t.query(api.channels.list, {}))).toEqual({ code: "UNAUTHENTICATED" });
    expect(await errorData(t.query(api.organizations.current, {}))).toEqual({
      code: "UNAUTHENTICATED",
    });
  });

  test("a session without an active org is NO_ACTIVE_ORG", async () => {
    const { t } = await setup();
    const noOrg = t.withIdentity({ subject: "user_alice" });
    expect(await errorData(noOrg.query(api.channels.list, {}))).toEqual({ code: "NO_ACTIVE_ORG" });
    expect(await errorData(noOrg.mutation(api.users.store, {}))).toEqual({ code: "NO_ACTIVE_ORG" });
  });

  test("the org claim works nested or dot-flattened", async () => {
    const { t } = await setup();
    const nested = t.withIdentity(identity({ name: "alice" }));
    const flat = t.withIdentity(flatIdentity({ name: "alice" }));
    const names = async (client: typeof nested) =>
      (await client.query(api.channels.list, {})).map((c) => c.name).sort();
    expect(await names(nested)).toEqual(["general", "random"]);
    expect(await names(flat)).toEqual(await names(nested));
  });

  test("a person the webhook hasn't synced yet is USER_NOT_SYNCED, and users.store fixes it", async () => {
    const { t } = await setup();
    const erin = t.withIdentity({ ...identity({ name: "erin" }), name: "Erin", email: "erin@example.com" });
    expect(await errorData(erin.query(api.channels.list, {}))).toEqual({ code: "USER_NOT_SYNCED" });
    expect(await erin.query(api.users.me, {})).toBeNull();

    await erin.mutation(api.users.store, {});
    expect(await erin.query(api.users.me, {})).toMatchObject({
      clerkUserId: "user_erin",
      name: "Erin",
      email: "erin@example.com",
    });
  });

  test("users.store keeps webhook data the token doesn't carry", async () => {
    const { asAlice, alice, t } = await setup();
    await t.run((ctx) => ctx.db.patch(alice, { name: "Alice Liddell", updatedAt: 500 }));
    await asAlice.mutation(api.users.store, {});
    const me = await asAlice.query(api.users.me, {});
    expect(me).toMatchObject({ name: "Alice Liddell", updatedAt: 500 });
  });
});

describe("which error wins", () => {
  test("messages.list checks the channel before the user, typing.list the user first", async () => {
    const { t, asAlice, bob } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userId: bob });
    // Unsynced person on a plan without DMs.
    const stranger = t.withIdentity(identity({ name: "erin", plan: "free" }));
    expect(await errorData(firstPage(stranger, dm))).toEqual({
      code: "PLAN_LIMIT",
      limit: "direct_messages",
    });
    expect(await errorData(stranger.query(api.typing.list, { channelId: dm, now: 0 }))).toEqual({
      code: "USER_NOT_SYNCED",
    });
  });

  test("messages.list on a public channel needs a synced user", async () => {
    const { t, general } = await setup();
    const erin = t.withIdentity(identity({ name: "erin" }));
    expect(await errorData(firstPage(erin, general))).toEqual({ code: "USER_NOT_SYNCED" });
  });

  test("historyHidden never throws on channels you can't see", async () => {
    const { asAliceFree, asCarolAdmin, asAlice, bob } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userId: bob });
    expect(await asCarolAdmin.query(api.messages.historyHidden, { channelId: dm })).toBe(false);
    expect(await asAliceFree.query(api.messages.historyHidden, { channelId: dm })).toBe(false);
  });
});

describe("permissions", () => {
  test("members can't create channels; the error names the permission", async () => {
    const { asBob } = await setup();
    expect(
      await errorData(asBob.mutation(api.channels.create, { name: "new", isPrivate: false })),
    ).toEqual({ code: "FORBIDDEN", permission: "org:channels:manage" });
  });

  test("members can't delete channels or add people to private ones", async () => {
    const { asBob, general, carol } = await setup();
    expect(await errorData(asBob.mutation(api.channels.remove, { channelId: general }))).toEqual({
      code: "FORBIDDEN",
      permission: "org:channels:manage",
    });
    expect(
      await errorData(asBob.mutation(api.channels.addMember, { channelId: general, userId: carol })),
    ).toEqual({ code: "FORBIDDEN", permission: "org:private_channels:manage" });
    expect(await errorData(asBob.query(api.channels.listAddable, { channelId: general }))).toEqual({
      code: "FORBIDDEN",
      permission: "org:private_channels:manage",
    });
  });

  test("only the author can edit; only the author or a moderator can delete", async () => {
    const { asAlice, asBob, asCarolAdmin, general, t } = await setup();
    const id = await asAlice.mutation(api.messages.send, { channelId: general, body: "mine" });

    expect(await errorData(asBob.mutation(api.messages.edit, { messageId: id, body: "hijack" }))).toEqual({
      code: "FORBIDDEN",
      message: "You can only edit your own messages.",
    });
    // Even a moderator can't edit someone else's words.
    expect(
      await errorData(asCarolAdmin.mutation(api.messages.edit, { messageId: id, body: "hijack" })),
    ).toEqual({ code: "FORBIDDEN", message: "You can only edit your own messages." });

    expect(await errorData(asBob.mutation(api.messages.remove, { messageId: id }))).toEqual({
      code: "FORBIDDEN",
      permission: "org:messages:moderate",
    });
    await asCarolAdmin.mutation(api.messages.remove, { messageId: id });
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });

  test("editing sets editedAt and validates the body", async () => {
    const { asAlice, general, t } = await setup();
    const id = await asAlice.mutation(api.messages.send, { channelId: general, body: "first" });
    await asAlice.mutation(api.messages.edit, { messageId: id, body: "  second  " });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      body: "second",
      editedAt: expect.any(Number),
    });
    expect(await errorData(asAlice.mutation(api.messages.edit, { messageId: id, body: " " }))).toEqual({
      code: "INVALID_ARGUMENT",
      message: "Message can't be empty.",
    });
    expect(
      await errorData(asAlice.mutation(api.messages.edit, { messageId: id, body: "x".repeat(4001) })),
    ).toEqual({ code: "INVALID_ARGUMENT", message: "Message is too long." });
  });

  test("you can only post and react in channels you belong to", async () => {
    const { t, asBob, general, bob } = await setup();
    const message = await asBob.mutation(api.messages.send, { channelId: general, body: "hi" });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", general).eq("userId", bob))
        .unique();
      if (row) await ctx.db.delete(row._id);
    });
    const forbidden = { code: "FORBIDDEN", message: "Join the channel first." };
    expect(await errorData(asBob.mutation(api.messages.send, { channelId: general, body: "x" }))).toEqual(
      forbidden,
    );
    expect(
      await errorData(asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "👍" })),
    ).toEqual(forbidden);
  });
});

describe("other orgs", () => {
  test("nothing in another org is visible or editable", async () => {
    const { asAlice, asDave, general, t } = await setup();
    const id = await asAlice.mutation(api.messages.send, { channelId: general, body: "private talk" });
    const notFound = { code: "NOT_FOUND" };

    expect(await errorData(firstPage(asDave, general))).toEqual(notFound);
    expect(await asDave.query(api.channels.get, { channelId: general })).toBeNull();
    expect(await asDave.query(api.channels.listMembers, { channelId: general })).toEqual([]);
    expect(await errorData(asDave.query(api.messages.listThread, { rootId: id }))).toEqual(notFound);
    expect(await errorData(asDave.mutation(api.messages.edit, { messageId: id, body: "x" }))).toEqual(
      notFound,
    );
    expect(await errorData(asDave.mutation(api.messages.remove, { messageId: id }))).toEqual(notFound);
    expect(await errorData(asDave.mutation(api.channels.join, { channelId: general }))).toEqual(notFound);
    expect(await errorData(asDave.mutation(api.reactions.toggle, { messageId: id, emoji: "👍" }))).toEqual(
      notFound,
    );
    expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
    expect(await asDave.query(api.organizations.current, {})).toBeNull();
  });
});
