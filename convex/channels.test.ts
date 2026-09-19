import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { ORG, OTHER_ORG, errorData, firstPage, setup } from "../tests/support/convex";

describe("creating channels", () => {
  test("trims the name, makes the creator a member, and rejects blanks and duplicates", async () => {
    const { t, asCarolAdmin, carol } = await setup();
    const id = await asCarolAdmin.mutation(api.channels.create, {
      name: "  ideas  ",
      description: "  brainstorm  ",
      isPrivate: false,
    });
    const channel = await t.run((ctx) => ctx.db.get(id));
    expect(channel).toMatchObject({ name: "ideas", description: "brainstorm", isPrivate: false });
    const membership = await t.run((ctx) =>
      ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", id).eq("userId", carol))
        .unique(),
    );
    expect(membership).not.toBeNull();

    expect(
      await errorData(asCarolAdmin.mutation(api.channels.create, { name: "   ", isPrivate: false })),
    ).toEqual({ code: "INVALID_ARGUMENT", message: "Channel name is required." });
    expect(
      await errorData(asCarolAdmin.mutation(api.channels.create, { name: "ideas", isPrivate: false })),
    ).toEqual({ code: "DUPLICATE_NAME", message: 'A channel named "ideas" already exists.' });
  });

  test("the free plan stops at five regular channels, and says so with the limit", async () => {
    const { asCarolFreeAdmin } = await setup();
    for (const name of ["a", "b", "c"]) {
      await asCarolFreeAdmin.mutation(api.channels.create, { name, isPrivate: false });
    }
    expect(
      await errorData(asCarolFreeAdmin.mutation(api.channels.create, { name: "d", isPrivate: false })),
    ).toEqual({ code: "PLAN_LIMIT", limit: "channels", max: 5 });
  });
});

describe("joining and leaving", () => {
  test("join is idempotent; leave is idempotent and tolerates a missing channel", async () => {
    const { t, asBob, general, bob } = await setup();
    await asBob.mutation(api.channels.leave, { channelId: general });
    await asBob.mutation(api.channels.leave, { channelId: general }); // no-op
    await asBob.mutation(api.channels.join, { channelId: general });
    await asBob.mutation(api.channels.join, { channelId: general }); // no-op
    const rows = await t.run((ctx) =>
      ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", general).eq("userId", bob))
        .collect(),
    );
    expect(rows).toHaveLength(1);

    await t.run((ctx) => ctx.db.delete(general));
    expect(await asBob.mutation(api.channels.leave, { channelId: general })).toBeNull();
    expect(await errorData(asBob.mutation(api.channels.join, { channelId: general }))).toEqual({
      code: "NOT_FOUND",
    });
  });

  test("private channels can't be joined without an invite", async () => {
    const { t, asBob, alice } = await setup();
    const secret = await t.run((ctx) =>
      ctx.db.insert("channels", { orgId: ORG, name: "secret", isPrivate: true, createdBy: alice }),
    );
    expect(await errorData(asBob.mutation(api.channels.join, { channelId: secret }))).toEqual({
      code: "FORBIDDEN",
      message: "Private channels require an invite from an admin.",
    });
    // ...and it stays hidden from non-members.
    expect(await asBob.query(api.channels.get, { channelId: secret })).toBeNull();
    expect((await asBob.query(api.channels.list, {})).map((c) => c.name)).not.toContain("secret");
  });

  test("addMember adds people to private channels only, and only org members", async () => {
    const { t, asCarolAdmin, alice, bob, dave, general } = await setup();
    const secret = await t.run((ctx) =>
      ctx.db.insert("channels", { orgId: ORG, name: "secret", isPrivate: true, createdBy: alice }),
    );

    expect(
      await errorData(asCarolAdmin.mutation(api.channels.addMember, { channelId: general, userId: bob })),
    ).toEqual({
      code: "INVALID_ARGUMENT",
      message: "addMember is for private channels only; public channels use join.",
    });
    expect(
      await errorData(asCarolAdmin.mutation(api.channels.addMember, { channelId: secret, userId: dave })),
    ).toEqual({ code: "NOT_FOUND", message: "That user is not a member of this organization." });

    const addable = () =>
      asCarolAdmin.query(api.channels.listAddable, { channelId: secret });
    expect((await addable()).map((u) => u.name).sort()).toEqual(["alice", "bob", "carol"]);

    await asCarolAdmin.mutation(api.channels.addMember, { channelId: secret, userId: bob });
    await asCarolAdmin.mutation(api.channels.addMember, { channelId: secret, userId: bob }); // idempotent
    expect((await addable()).map((u) => u.name).sort()).toEqual(["alice", "carol"]);
    const members = await asCarolAdmin.query(api.channels.listMembers, { channelId: secret });
    expect(members.map((m) => m.name)).toEqual(["bob"]);
  });

  test("channels.remove of a missing or foreign channel is NOT_FOUND", async () => {
    const { t, asCarolAdmin, alice } = await setup();
    const foreign = await t.run((ctx) =>
      ctx.db.insert("channels", { orgId: OTHER_ORG, name: "x", isPrivate: false, createdBy: alice }),
    );
    expect(await errorData(asCarolAdmin.mutation(api.channels.remove, { channelId: foreign }))).toEqual({
      code: "NOT_FOUND",
    });
    await t.run((ctx) => ctx.db.delete(foreign));
    expect(await errorData(asCarolAdmin.mutation(api.channels.remove, { channelId: foreign }))).toEqual({
      code: "NOT_FOUND",
    });
  });

  test("listAddable is empty for a DM or a missing channel", async () => {
    const { t, asAlice, asCarolAdmin, bob, general } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userId: bob });
    expect(await asCarolAdmin.query(api.channels.listAddable, { channelId: dm })).toEqual([]);
    await t.run((ctx) => ctx.db.delete(general));
    expect(await asCarolAdmin.query(api.channels.listAddable, { channelId: general })).toEqual([]);
  });
});

describe("how deleted people appear", () => {
  async function withDeletedBob() {
    const ctx = await setup();
    await ctx.t.run((db) =>
      db.db.patch(ctx.bob, { deletedAt: 1, imageUrl: "https://img.example/bob.png" }),
    );
    return ctx;
  }

  test("messages show 'Deleted user' and hide the avatar", async () => {
    const { t, asAlice, bob, general } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("messages", { channelId: general, orgId: ORG, authorId: bob, body: "from bob", mentions: [bob] });
    });
    await t.run((ctx) => ctx.db.patch(bob, { deletedAt: 1, imageUrl: "https://img.example/bob.png" }));
    const [message] = (await firstPage(asAlice, general)).page;
    expect(message).toMatchObject({
      authorName: "Deleted user",
      authorDeleted: true,
      mentionedUsers: [{ id: bob, name: "Deleted user" }],
    });
    expect(message.authorImageUrl).toBeUndefined();
  });

  test("member lists flag deleted people but keep the stored name; pickers leave them out", async () => {
    const { asAlice, general, bob } = await withDeletedBob();
    const members = await asAlice.query(api.channels.listMembers, { channelId: general });
    expect(members.find((m) => m.userId === bob)).toMatchObject({ name: "bob", deleted: true });

    expect((await asAlice.query(api.users.listOrgMembers, {})).map((u) => u.name).sort()).toEqual([
      "alice",
      "carol",
    ]);
    expect((await asAlice.query(api.dms.listCandidates, {})).map((u) => u.name)).toEqual(["carol"]);
  });

  test("dm participants show 'Deleted user' in the sidebar list", async () => {
    const { t, asAlice, bob } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userId: bob });
    await t.run((ctx) => ctx.db.patch(bob, { deletedAt: 1, imageUrl: "https://img.example/bob.png" }));
    const entry = (await asAlice.query(api.channels.list, {})).find((c) => c._id === dm);
    expect(entry?.dmMembers.map((m) => [m.name, m.imageUrl]).sort()).toEqual([
      ["Deleted user", undefined],
      ["alice", undefined],
    ]);
  });

  test("dms.listCandidates leaves out yourself", async () => {
    const { asAlice } = await setup();
    expect((await asAlice.query(api.dms.listCandidates, {})).map((u) => u.name).sort()).toEqual([
      "bob",
      "carol",
    ]);
  });
});

describe("free-plan history window", () => {
  async function seedMessages(count: number) {
    const ctx = await setup();
    const { t, alice, general } = ctx;
    await t.run(async (db) => {
      for (let i = 1; i <= count; i++) {
        await db.db.insert("messages", {
          channelId: general,
          orgId: ORG,
          authorId: alice,
          body: `m${i}`,
        });
      }
    });
    return ctx;
  }

  test("free plans see only the latest 30 and are told there is more", async () => {
    const { asAliceFree, asAlice, general } = await seedMessages(35);
    const freePage = await firstPage(asAliceFree, general);
    expect(freePage.page).toHaveLength(30);
    expect(freePage.page[0].body).toBe("m35");
    expect(freePage.page.at(-1)?.body).toBe("m6");
    expect(await asAliceFree.query(api.messages.historyHidden, { channelId: general })).toBe(true);

    expect((await firstPage(asAlice, general)).page).toHaveLength(35);
    expect(await asAlice.query(api.messages.historyHidden, { channelId: general })).toBe(false);
  });

  test("with 30 or fewer messages nothing is hidden", async () => {
    const { asAliceFree, general } = await seedMessages(30);
    expect(await firstPage(asAliceFree, general).then((p) => p.page.length)).toBe(30);
    expect(await asAliceFree.query(api.messages.historyHidden, { channelId: general })).toBe(false);
  });
});

describe("threads on missing messages", () => {
  test("listThread is null for a missing root or a reply; remove of a missing message is a no-op", async () => {
    const { t, asAlice, general } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    const reply = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "reply",
      threadRootId: root,
    });
    expect(await asAlice.query(api.messages.listThread, { rootId: reply })).toBeNull();
    await t.run((ctx) => ctx.db.delete(root));
    expect(await asAlice.query(api.messages.listThread, { rootId: root })).toBeNull();
    expect(await asAlice.mutation(api.messages.remove, { messageId: root })).toBeNull();
  });
});
