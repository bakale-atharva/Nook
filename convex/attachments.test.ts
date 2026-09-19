import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { errorCode, firstPage, setup, storeFile } from "../tests/support/convex";

afterEach(() => {
  vi.useRealTimers();
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
