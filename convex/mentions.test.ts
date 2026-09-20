import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { firstPage, setup } from "../tests/support/convex";

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
