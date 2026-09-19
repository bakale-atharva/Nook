import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

/** A message as the channel feed and thread panel render it. */
export type MessageItemData = FunctionReturnType<typeof api.messages.list>["page"][number];
export type MessageAttachment = MessageItemData["attachments"][number];
export type MessageReaction = MessageItemData["reactions"][number];
