import { v } from "convex/values";

/** An image attached to a message, as stored on the `messages` table. */
export const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

/** What the client sends: type and size are read from storage, not trusted. */
export const attachmentInputValidator = attachmentValidator.pick(
  "storageId",
  "name",
  "width",
  "height",
);

/** What the client receives: the stored record plus a signed URL. */
export const attachmentOutputValidator = attachmentValidator.extend({
  url: v.union(v.string(), v.null()),
});
