import type {
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
} from "@clerk/backend";
import type {
  MembershipUpsert,
  OrgUpsert,
  SubscriptionUpdate,
  UserUpsert,
} from "./clerkUpserts";

// Maps Clerk's webhook payloads to the shapes the sync mutations take. Pure
// functions, so the field-by-field decisions live in one testable place.

export function userFromWebhook(data: UserJSON): UserUpsert {
  const primaryEmail = data.email_addresses?.find(
    (e) => e.id === data.primary_email_address_id,
  )?.email_address;
  return {
    clerkUserId: data.id,
    name:
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
      data.username ||
      "Unknown",
    imageUrl: data.image_url,
    email: primaryEmail,
    updatedAt: data.updated_at ?? Date.now(),
  };
}

export function orgFromWebhook(data: OrganizationJSON): OrgUpsert {
  return {
    clerkOrgId: data.id,
    name: data.name,
    slug: data.slug,
    imageUrl: data.image_url,
    updatedAt: data.updated_at ?? Date.now(),
  };
}

export function membershipFromWebhook(data: OrganizationMembershipJSON): MembershipUpsert {
  return {
    clerkMembershipId: data.id,
    orgId: data.organization.id,
    clerkUserId: data.public_user_data.user_id,
    role: data.role,
    updatedAt: data.updated_at ?? Date.now(),
  };
}

/** The parts of a subscription event this app reads. */
type SubscriptionEventData = {
  status: string;
  payer: { organization_id?: string | null };
  items: { plan?: { slug: string } | null }[];
};

/** Null for user-level payers: only org subscriptions are mirrored. */
export function subscriptionFromWebhook(data: SubscriptionEventData): SubscriptionUpdate | null {
  const clerkOrgId = data.payer.organization_id;
  if (!clerkOrgId) return null;
  return { clerkOrgId, plan: data.items[0]?.plan?.slug, status: data.status };
}
