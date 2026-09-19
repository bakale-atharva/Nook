import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { ORG, errorCode, firstPage, setup } from "../tests/support/convex";

describe("direct messages", () => {
  test("getOrCreate returns the same DM for the same people, in any order", async () => {
    const { asAlice, asBob, alice, bob } = await setup();
    const first = await asAlice.mutation(api.dms.getOrCreate, { userIds: [bob] });
    expect(await asAlice.mutation(api.dms.getOrCreate, { userIds: [bob] })).toBe(first);
    expect(await asBob.mutation(api.dms.getOrCreate, { userIds: [alice] })).toBe(first);
  });

  test("rejects people outside the org, yourself alone, and free plans", async () => {
    const { asAlice, asAliceFree, alice, bob, dave } = await setup();
    expect(await errorCode(asAlice.mutation(api.dms.getOrCreate, { userIds: [dave] }))).toBe(
      "NOT_FOUND",
    );
    expect(await errorCode(asAlice.mutation(api.dms.getOrCreate, { userIds: [alice] }))).toBe(
      "INVALID_ARGUMENT",
    );
    expect(await errorCode(asAliceFree.mutation(api.dms.getOrCreate, { userIds: [bob] }))).toBe(
      "PLAN_LIMIT",
    );
  });

  test("an admin who is not in the DM cannot see or post in it", async () => {
    const { asAlice, asBob, asCarolAdmin, bob } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userIds: [bob] });
    await asBob.mutation(api.messages.send, { channelId: dm, body: "secret" });

    // Carol holds org:private_channels:manage, which opens private channels
    // but must never open a DM.
    expect(await asCarolAdmin.query(api.channels.get, { channelId: dm })).toBeNull();
    expect(await asCarolAdmin.query(api.channels.listMembers, { channelId: dm })).toEqual([]);
    expect(await errorCode(firstPage(asCarolAdmin, dm))).toBe("NOT_FOUND");
    expect(
      await errorCode(asCarolAdmin.mutation(api.messages.send, { channelId: dm, body: "hi" })),
    ).toBe("NOT_FOUND");
    expect(
      await errorCode(asCarolAdmin.query(api.typing.list, { channelId: dm, now: Date.now() })),
    ).toBe("NOT_FOUND");
    const listed = await asCarolAdmin.query(api.channels.list, {});
    expect(listed.some((c) => c._id === dm)).toBe(false);
  });

  test("DMs cannot be deleted, joined, left or extended", async () => {
    const { asAlice, asCarolAdmin, bob, carol } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userIds: [bob] });
    expect(await errorCode(asCarolAdmin.mutation(api.channels.remove, { channelId: dm }))).toBe(
      "INVALID_ARGUMENT",
    );
    expect(await errorCode(asAlice.mutation(api.channels.leave, { channelId: dm }))).toBe(
      "INVALID_ARGUMENT",
    );
    expect(
      await errorCode(asCarolAdmin.mutation(api.channels.addMember, { channelId: dm, userId: carol })),
    ).toBe("INVALID_ARGUMENT");
  });

  test("a plan without the feature loses access to existing DMs, and gets them back", async () => {
    const { asAlice, asAliceFree, bob } = await setup();
    const dm = await asAlice.mutation(api.dms.getOrCreate, { userIds: [bob] });
    await asAlice.mutation(api.messages.send, { channelId: dm, body: "hello" });

    expect((await asAliceFree.query(api.channels.list, {})).some((c) => c._id === dm)).toBe(false);
    expect(await asAliceFree.query(api.channels.get, { channelId: dm })).toBeNull();
    expect(await errorCode(firstPage(asAliceFree, dm))).toBe("PLAN_LIMIT");
    expect(
      await errorCode(asAliceFree.mutation(api.messages.send, { channelId: dm, body: "x" })),
    ).toBe("PLAN_LIMIT");

    // Nothing was deleted: upgrading brings it all back.
    const page = await firstPage(asAlice, dm);
    expect(page.page.map((m) => m.body)).toEqual(["hello"]);
    const entry = (await asAlice.query(api.channels.list, {})).find((c) => c._id === dm);
    expect(entry?.isDm).toBe(true);
    expect(entry?.dmMembers.map((m) => m.name).sort()).toEqual(["alice", "bob"]);
  });

  test("DMs do not count toward the free channel limit", async () => {
    const { t, asCarolFreeAdmin, alice, carol } = await setup();
    await t.run(async (ctx) => {
      // 2 regular channels already exist from setup; add 2 more (4 total) and
      // three DM rows. If DMs counted, creating one more would hit the cap.
      for (const name of ["a", "b"]) {
        await ctx.db.insert("channels", { orgId: ORG, name, isPrivate: false, createdBy: alice });
      }
      for (const key of ["x", "y", "z"]) {
        await ctx.db.insert("channels", {
          orgId: ORG,
          name: "",
          isPrivate: true,
          createdBy: carol,
          dmKey: key,
        });
      }
    });
    await asCarolFreeAdmin.mutation(api.channels.create, { name: "fifth", isPrivate: false });
    expect(
      await errorCode(
        asCarolFreeAdmin.mutation(api.channels.create, { name: "sixth", isPrivate: false }),
      ),
    ).toBe("PLAN_LIMIT");
  });
});
