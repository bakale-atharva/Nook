import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { errorCode, firstPage, setup } from "../tests/support/convex";

afterEach(() => {
  vi.useRealTimers();
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
