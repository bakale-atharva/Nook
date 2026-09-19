import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_BODY_LENGTH,
  MAX_IMAGE_DIMENSION,
} from "./constants";
import { invalidArgument } from "./errors";
import type { attachmentInputValidator } from "./validators";

/** Trims `body` and rejects empty (without files) or over-long messages. */
export function validateBody(body: string, hasAttachments: boolean): string {
  const trimmed = body.trim();
  if (!trimmed && !hasAttachments) {
    throw invalidArgument("Message can't be empty.");
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw invalidArgument("Message is too long.");
  }
  return trimmed;
}

function cleanDimension(n: number | undefined): number | undefined {
  return n !== undefined && Number.isInteger(n) && n > 0 && n <= MAX_IMAGE_DIMENSION
    ? n
    : undefined;
}

/**
 * Checks the uploaded files against Convex's own storage metadata (never the
 * client's claim) and returns the attachment records to persist. Only images
 * up to MAX_ATTACHMENT_BYTES are accepted.
 */
export async function validateAttachments(
  ctx: QueryCtx,
  inputs: Infer<typeof attachmentInputValidator>[],
) {
  if (inputs.length > MAX_ATTACHMENTS) {
    throw invalidArgument(`You can attach up to ${MAX_ATTACHMENTS} images.`);
  }
  if (new Set(inputs.map((a) => a.storageId)).size !== inputs.length) {
    throw invalidArgument("Duplicate attachment.");
  }
  const out = [];
  for (const input of inputs) {
    const meta = await ctx.db.system.get("_storage", input.storageId);
    if (!meta || !meta.contentType || !ALLOWED_IMAGE_TYPES.includes(meta.contentType)) {
      throw invalidArgument("Only PNG, JPEG, GIF and WebP images can be attached.");
    }
    if (meta.size > MAX_ATTACHMENT_BYTES) {
      throw invalidArgument("Images can be at most 10 MB.");
    }
    out.push({
      storageId: input.storageId,
      name: input.name.trim().slice(0, 200) || "image",
      contentType: meta.contentType,
      size: meta.size,
      width: cleanDimension(input.width),
      height: cleanDimension(input.height),
    });
  }
  return out;
}
