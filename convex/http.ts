import { httpRouter } from "convex/server";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  membershipFromWebhook,
  orgFromWebhook,
  subscriptionFromWebhook,
  userFromWebhook,
} from "./lib/clerkPayloads";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let evt;
    try {
      evt = await verifyWebhook(req);
    } catch (err) {
      console.error("Clerk webhook signature verification failed", err);
      return new Response("Webhook verification failed", { status: 400 });
    }

    switch (evt.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.clerkSync.upsertUser, userFromWebhook(evt.data));
        break;
      case "user.deleted":
        if (evt.data.id) {
          await ctx.runMutation(internal.clerkSync.deleteUser, {
            clerkUserId: evt.data.id,
          });
        }
        break;
      case "organization.created":
      case "organization.updated":
        await ctx.runMutation(internal.clerkSync.upsertOrg, orgFromWebhook(evt.data));
        break;
      case "organization.deleted":
        if (evt.data.id) {
          await ctx.runMutation(internal.clerkSync.deleteOrg, {
            clerkOrgId: evt.data.id,
          });
        }
        break;
      case "organizationMembership.created":
      case "organizationMembership.updated":
        await ctx.runMutation(
          internal.clerkSync.upsertMembership,
          membershipFromWebhook(evt.data),
        );
        break;
      case "organizationMembership.deleted":
        await ctx.runMutation(internal.clerkSync.deleteMembership, {
          clerkMembershipId: evt.data.id,
        });
        break;
      case "subscription.created":
      case "subscription.updated":
      case "subscription.active":
      case "subscription.pastDue": {
        const update = subscriptionFromWebhook(evt.data);
        if (update) {
          await ctx.runMutation(internal.clerkSync.upsertSubscription, update);
        }
        break;
      }
      default:
        // Unhandled event types are ignored (we only subscribed to the
        // events above in the Clerk Dashboard, but stay defensive).
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
