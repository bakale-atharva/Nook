/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG = "org_nook";
const OTHER_ORG = "org_other";

const PRO_FEATURES = [
  "channels",
  "messages",
  "private_channels",
  "unlimited_channels",
  "full_history",
  "direct_messages",
];
const FREE_FEATURES = ["channels", "messages"];

const MEMBER_PERMISSIONS = [
  "org:channels:read",
  "org:messages:send",
];
const ADMIN_PERMISSIONS = [
  ...MEMBER_PERMISSIONS,
  "org:channels:manage",
  "org:messages:moderate",
  "org:private_channels:manage",
];

/**
 * A session identity shaped like Clerk's v2 token: the org claim `o` with a
 * permission list (`per`) and one bitmask per plan feature (`fpm`), aligned
 * with the `fea` claim. Mirrors what convex/lib/auth.ts decodes.
 */
function identity({
  name,
  role = "member",
  plan = "pro",
  orgId = ORG,
}: {
  name: string;
  role?: "admin" | "member";
  plan?: "pro" | "free";
  orgId?: string;
}) {
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
    subject: `user_${name}`,
    o: { id: orgId, rol: role, per: actions.join(","), fpm: fpm.join(",") },
    fea: features.map((f) => `o:${f}`).join(","),
  };
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ConvexError) return (err.data as { code?: string }).code;
    throw err;
  }
  return undefined;
}

/**
 * Stores a file the way a real browser upload would leave it. convex-test's
 * `storage.store` records only size and hash, while Convex proper also keeps
 * the Content-Type header of the upload, which is what messages.send checks.
 */
async function storeFile(
  t: ReturnType<typeof convexTest>,
  contentType: string,
  bytes: number,
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.db as any).patch(storageId, { contentType });
    return storageId;
  });
}

async function setup() {
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
  };
}

async function firstPage(client: Awaited<ReturnType<typeof setup>>["asAlice"], channelId: Id<"channels">) {
  return client.query(api.messages.list, {
    channelId,
    paginationOpts: { numItems: 50, cursor: null },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

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

describe("threads", () => {
  test("replies stay out of the feed and update the root's summary", async () => {
    const { asAlice, asBob, general, bob } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    await asBob.mutation(api.messages.send, {
      channelId: general,
      body: "reply",
      threadRootId: root,
    });

    const page = await firstPage(asAlice, general);
    expect(page.page.map((m) => m.body)).toEqual(["root"]);
    expect(page.page[0].replyCount).toBe(1);
    expect(page.page[0].replyParticipants.map((p) => p.userId)).toEqual([bob]);

    const thread = await asAlice.query(api.messages.listThread, { rootId: root });
    expect(thread?.root.body).toBe("root");
    expect(thread?.replies.map((r) => r.body)).toEqual(["reply"]);
  });

  test("replies must target a root in the same channel and cannot nest", async () => {
    const { asAlice, general, otherChannel } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    const reply = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "reply",
      threadRootId: root,
    });

    expect(
      await errorCode(
        asAlice.mutation(api.messages.send, {
          channelId: general,
          body: "nested",
          threadRootId: reply,
        }),
      ),
    ).toBe("INVALID_ARGUMENT");
    expect(
      await errorCode(
        asAlice.mutation(api.messages.send, {
          channelId: otherChannel,
          body: "wrong channel",
          threadRootId: root,
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  test("thread replies do not count as unread for the channel", async () => {
    const { asAlice, asBob, general } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "reply",
      threadRootId: root,
    });
    const entry = (await asBob.query(api.channels.list, {})).find((c) => c._id === general);
    expect(entry?.unreadCount).toBe(1);
  });

  test("deleting a reply lowers the count; deleting the root removes the replies", async () => {
    vi.useFakeTimers();
    const { t, asAlice, asBob, general } = await setup();
    const root = await asAlice.mutation(api.messages.send, { channelId: general, body: "root" });
    const replyA = await asBob.mutation(api.messages.send, {
      channelId: general,
      body: "a",
      threadRootId: root,
    });
    await asBob.mutation(api.messages.send, { channelId: general, body: "b", threadRootId: root });

    await asBob.mutation(api.messages.remove, { messageId: replyA });
    expect((await firstPage(asAlice, general)).page[0].replyCount).toBe(1);

    await asAlice.mutation(api.messages.remove, { messageId: root });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const remaining = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(remaining).toEqual([]);
  });
});

describe("reactions and hearts", () => {
  test("toggling adds then removes, and counts per person", async () => {
    const { asAlice, asBob, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });

    await asAlice.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "🎉" });

    const seenByAlice = (await firstPage(asAlice, general)).page[0].reactions;
    expect(seenByAlice).toEqual([
      { emoji: "❤️", count: 2, reactedByMe: true },
      { emoji: "🎉", count: 1, reactedByMe: false },
    ]);

    await asAlice.mutation(api.reactions.toggle, { messageId: message, emoji: "❤️" });
    const after = (await firstPage(asAlice, general)).page[0].reactions;
    expect(after[0]).toEqual({ emoji: "❤️", count: 1, reactedByMe: false });
  });

  test("only real emoji are accepted", async () => {
    const { asAlice, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });
    for (const emoji of ["", "hello", "a".repeat(40), "1"]) {
      expect(await errorCode(asAlice.mutation(api.reactions.toggle, { messageId: message, emoji }))).toBe(
        "INVALID_ARGUMENT",
      );
    }
  });

  test("deleting a message deletes its reactions", async () => {
    vi.useFakeTimers();
    const { t, asAlice, asBob, general } = await setup();
    const message = await asAlice.mutation(api.messages.send, { channelId: general, body: "hi" });
    await asBob.mutation(api.reactions.toggle, { messageId: message, emoji: "👍" });
    await asAlice.mutation(api.messages.remove, { messageId: message });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("reactions").collect())).toEqual([]);
  });
});

describe("image attachments", () => {
  const store = storeFile;

  test("accepts an image and serves a URL", async () => {
    const { t, asAlice, general } = await setup();
    const storageId = await store(t, "image/png", 100);
    await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "",
      attachments: [{ storageId, name: "shot.png", width: 640, height: 480 }],
    });
    const [message] = (await firstPage(asAlice, general)).page;
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toMatchObject({
      name: "shot.png",
      contentType: "image/png",
      size: 100,
      width: 640,
      height: 480,
    });
    expect(message.attachments[0].url).toEqual(expect.any(String));
  });

  test("rejects non-images and oversized files, judged by storage metadata", async () => {
    const { t, asAlice, general } = await setup();
    const text = await store(t, "text/plain", 10);
    const huge = await store(t, "image/png", 10 * 1024 * 1024 + 1);
    expect(
      await errorCode(
        asAlice.mutation(api.messages.send, {
          channelId: general,
          body: "x",
          attachments: [{ storageId: text, name: "notes.png" }],
        }),
      ),
    ).toBe("INVALID_ARGUMENT");
    expect(
      await errorCode(
        asAlice.mutation(api.messages.send, {
          channelId: general,
          body: "x",
          attachments: [{ storageId: huge, name: "huge.png" }],
        }),
      ),
    ).toBe("INVALID_ARGUMENT");
  });

  test("caps a message at four images and requires some content", async () => {
    const { t, asAlice, general } = await setup();
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => store(t, "image/png", 10)));
    expect(
      await errorCode(
        asAlice.mutation(api.messages.send, {
          channelId: general,
          body: "x",
          attachments: ids.map((storageId) => ({ storageId, name: "i.png" })),
        }),
      ),
    ).toBe("INVALID_ARGUMENT");
    expect(await errorCode(asAlice.mutation(api.messages.send, { channelId: general, body: "  " }))).toBe(
      "INVALID_ARGUMENT",
    );
  });

  test("deleting a message deletes its files", async () => {
    vi.useFakeTimers();
    const { t, asAlice, general } = await setup();
    const storageId = await store(t, "image/png", 10);
    const messageId = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "pic",
      attachments: [{ storageId, name: "a.png" }],
    });
    await asAlice.mutation(api.messages.remove, { messageId });
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
  });
});

describe("@mentions", () => {
  test("only members of this org become mentions", async () => {
    const { t, asAlice, general, bob, dave } = await setup();
    const messageId = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: `hi <@${bob}> and <@${dave}> and <@notarealid1234567890>`,
    });
    const stored = await t.run((ctx) => ctx.db.get(messageId));
    expect(stored?.mentions).toEqual([bob]);
    const [message] = (await firstPage(asAlice, general)).page;
    expect(message.mentionedUsers).toEqual([{ id: bob, name: "bob" }]);
  });

  test("a mention shows up as a count for the person mentioned", async () => {
    const { asAlice, asBob, general, bob } = await setup();
    await asAlice.mutation(api.messages.send, { channelId: general, body: "plain" });
    await asAlice.mutation(api.messages.send, { channelId: general, body: `ping <@${bob}>` });
    const entry = (await asBob.query(api.channels.list, {})).find((c) => c._id === general);
    expect(entry?.unreadCount).toBe(2);
    expect(entry?.mentionCount).toBe(1);
  });

  test("editing re-derives mentions", async () => {
    const { t, asAlice, general, bob } = await setup();
    const messageId = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: `hi <@${bob}>`,
    });
    await asAlice.mutation(api.messages.edit, { messageId, body: "hi again" });
    expect((await t.run((ctx) => ctx.db.get(messageId)))?.mentions).toBeUndefined();
  });

  test("everyone in the org is listed for the picker, and only them", async () => {
    const { asAlice } = await setup();
    const members = await asAlice.query(api.users.listOrgMembers, {});
    expect(members.map((m) => m.name).sort()).toEqual(["alice", "bob", "carol"]);
  });
});

describe("starred channels", () => {
  test("starring is per person and shows in the list", async () => {
    const { asAlice, asBob, general } = await setup();
    await asAlice.mutation(api.channels.setStarred, { channelId: general, starred: true });
    const star = async (client: typeof asAlice) =>
      (await client.query(api.channels.list, {})).find((c) => c._id === general)?.starred;
    expect(await star(asAlice)).toBe(true);
    expect(await star(asBob)).toBe(false);

    await asAlice.mutation(api.channels.setStarred, { channelId: general, starred: false });
    expect(await star(asAlice)).toBe(false);
  });

  test("you must be a member to star", async () => {
    const { t, asBob, general, bob } = await setup();
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) => q.eq("channelId", general).eq("userId", bob))
        .unique();
      if (row) await ctx.db.delete(row._id);
    });
    expect(await errorCode(asBob.mutation(api.channels.setStarred, { channelId: general, starred: true }))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("channel deletion", () => {
  test("cascades to messages, replies, reactions and files", async () => {
    vi.useFakeTimers();
    const { t, asAlice, asBob, asCarolAdmin, general } = await setup();
    const storageId = await storeFile(t, "image/png", 10);
    const root = await asAlice.mutation(api.messages.send, {
      channelId: general,
      body: "pic",
      attachments: [{ storageId, name: "a.png" }],
    });
    await asBob.mutation(api.messages.send, { channelId: general, body: "r", threadRootId: root });
    await asBob.mutation(api.reactions.toggle, { messageId: root, emoji: "👍" });

    await asCarolAdmin.mutation(api.channels.remove, { channelId: general });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.run(async (ctx) => {
      expect(await ctx.db.get(general)).toBeNull();
      const leftovers = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", general))
        .collect();
      expect(leftovers).toEqual([]);
      expect(await ctx.db.query("reactions").collect()).toEqual([]);
      expect(await ctx.storage.get(storageId)).toBeNull();
    });
  });
});
