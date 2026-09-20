import type { convexTest } from "convex-test";

// Clerk delivers webhooks through Svix, which signs `${id}.${timestamp}.${body}`
// with HMAC-SHA256 keyed by the base64 part of the `whsec_...` signing secret.
const SECRET_BYTES = "nook-test-signing-secret-0123456789";
const SIGNING_SECRET = `whsec_${btoa(SECRET_BYTES)}`;

async function sign(id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET_BYTES),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
}

let counter = 0;

/**
 * POSTs a Clerk-style event to the `/clerk-webhook` HTTP endpoint with a valid
 * Svix signature (or a forged one when `forgeSignature` is set) and returns
 * the response, so tests exercise verification, dispatch and the mutations.
 */
export async function postWebhook(
  t: ReturnType<typeof convexTest>,
  event: { type: string; data: unknown },
  { forgeSignature = false }: { forgeSignature?: boolean } = {},
): Promise<Response> {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SIGNING_SECRET;
  const body = JSON.stringify({ object: "event", ...event });
  const id = `msg_test_${++counter}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = forgeSignature
    ? `v1,${btoa("not the real signature")}`
    : await sign(id, timestamp, body);
  return await t.fetch("/clerk-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    },
    body,
  });
}

/** A realistic `user.*` payload, extra Clerk fields included. */
export function userData(
  overrides: Partial<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    image_url: string;
    primary_email_address_id: string | null;
    email_addresses: { id: string; email_address: string }[];
    updated_at: number;
  }> = {},
) {
  return {
    object: "user",
    id: "user_zed",
    first_name: "Zed",
    last_name: "Adams",
    username: null,
    image_url: "https://img.example/zed.png",
    has_image: true,
    primary_email_address_id: "idn_1",
    email_addresses: [
      { id: "idn_0", email_address: "old@example.com", object: "email_address" },
      { id: "idn_1", email_address: "zed@example.com", object: "email_address" },
    ],
    phone_numbers: [],
    public_metadata: {},
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
    ...overrides,
  };
}

export function orgData(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    image_url: string;
    updated_at: number;
  }> = {},
) {
  return {
    object: "organization",
    id: "org_acme",
    name: "Acme",
    slug: "acme",
    image_url: "https://img.example/acme.png",
    max_allowed_memberships: 5,
    public_metadata: {},
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
    ...overrides,
  };
}

export function membershipData(
  overrides: Partial<{
    id: string;
    role: string;
    orgId: string;
    userId: string;
    updated_at: number;
  }> = {},
) {
  const { orgId = "org_acme", userId = "user_zed", ...rest } = overrides;
  return {
    object: "organization_membership",
    id: "orgmem_1",
    role: "org:member",
    organization: { object: "organization", id: orgId, name: "Acme", slug: "acme" },
    public_user_data: { user_id: userId, first_name: "Zed", last_name: "Adams" },
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
    ...rest,
  };
}

export function subscriptionData(
  overrides: Partial<{
    status: string;
    organizationId: string | undefined;
    planSlug: string | null;
  }> = {},
) {
  const { status = "active", planSlug = "pro" } = overrides;
  const organizationId = "organizationId" in overrides ? overrides.organizationId : "org_acme";
  return {
    object: "commerce_subscription",
    id: "sub_1",
    status,
    payer: { id: "payer_1", ...(organizationId ? { organization_id: organizationId } : {}) },
    items: planSlug ? [{ id: "subitem_1", plan: { id: "plan_1", slug: planSlug } }] : [],
    updated_at: 1_700_000_001_000,
  };
}
