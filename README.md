# Nook

A B2B, multi-tenant Slack-style chat app. Organizations invite teammates
into channels and message in real time. **Clerk** handles auth,
organizations, RBAC and billing/feature-gating; **Convex** handles data,
real-time sync and server-side authorization.

Full design doc (with diagrams and the phase-by-phase build plan):
[`.claude/plans/PLAN.md`](.claude/plans/PLAN.md).

## Stack

- **Next.js 16** (App Router, `proxy.ts`) + React 19 + Tailwind 4 + shadcn/ui
- **Clerk** — auth, Organizations, RBAC (roles/permissions), Billing (seat-limited org plans, feature gating)
- **Convex** — schema, real-time queries/mutations, HTTP actions (Clerk webhook sync)

## Feature set

| | Free (`free_org`, 5 seats) | Pro (`pro`, 20 seats) |
|---|---|---|
| Members | 5 (Clerk seat limit) | 20 (Clerk seat limit) |
| Channels | 5 | Unlimited |
| Visible history / channel | Last 30 | Full, paginated |
| Private channels | ✗ | ✓ |
| Create/delete channels | Admins | Admins |
| Join channels, send/edit/delete own messages, typing, unread | All members | All members |

Admins get the full `org:admin` permission set (manage channels, moderate
any message, manage members/billing). Members can browse/join public
channels and manage only their own messages. See the Clerk setup guide
below for the exact roles/permissions/plans to create.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm backend                 # npx convex dev — first run also links a deployment
pnpm frontend                # next dev
```

Open http://localhost:3000.

### Environment variables

`.env.local` (Next.js):

```
CONVEX_DEPLOYMENT=              # written by `npx convex dev`
NEXT_PUBLIC_CONVEX_URL=         # written by `npx convex dev`
NEXT_PUBLIC_CONVEX_SITE_URL=    # written by `npx convex dev`

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_FRONTEND_API_URL=

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
```

Convex dashboard → Settings → Environment Variables (**not** `.env.local` —
these are read by Convex functions, not Next.js):

```
CLERK_FRONTEND_API_URL          # issuer for convex/auth.config.ts
CLERK_WEBHOOK_SIGNING_SECRET    # whsec_... from Clerk → Webhooks → your endpoint
CLERK_SECRET_KEY                # only needed to run clerkSync.backfill
```

## Clerk Dashboard setup (manual — no Clerk CLI used in this project)

Clerk builds every permission check out of **Plan → Feature → Permission →
Role**: a custom permission `org:<feature>:<action>` only returns `true`
when the caller's role has it **and** the org's active plan includes a
Feature keyed exactly `<feature>`.

1. **Organizations** (Organizations → Settings): enable them, turn off
   personal accounts (every user must belong to an org), turn on
   user-created orgs. Creator's initial role `org:admin`, default role for
   new members `org:member`.
2. **Billing** (Billing → Settings): enable Organization billing.
3. **Features** (Billing → Features) — create with these exact keys:
   `channels`, `messages`, `private_channels`, `unlimited_channels`, `full_history`.
4. **Custom permissions** (Organizations → Roles & Permissions →
   Permissions), each tied to its matching Feature:
   `org:channels:read` and `org:channels:manage` (`channels`),
   `org:messages:send` and `org:messages:moderate` (`messages`),
   `org:private_channels:manage` (`private_channels`).
5. **Roles** (Roles tab, edit the two defaults):
   - `org:admin` — all system permissions, all five custom permissions.
   - `org:member` — `org:sys_memberships:read`, `org:sys_billing:read`,
     `org:channels:read`, `org:messages:send`.
6. **Organization Plans** (Billing → Plans → **Organization Plans** tab):
   - `free_org` (default, edit the auto-created one): $0, seat limit **5**,
     features `channels` + `messages`.
   - `pro` (new): seat limit **20** (can't be changed after creation —
     double check), features: all five.
7. **Convex integration** (Integrations → Convex): activate it.
8. **Webhook endpoint** (Configure → Webhooks → Add Endpoint) — do this
   *after* `npx convex dev` has deployed the `http.ts` route:
   - URL: `https://<your-dev-deployment>.convex.site/clerk-webhook`
     (the **`.convex.site`** domain — find it in the Convex dashboard →
     Settings → URL & Deploy Key → "HTTP Actions URL").
   - Subscribe to: `user.created/updated/deleted`,
     `organization.created/updated/deleted`,
     `organizationMembership.created/updated/deleted`,
     `subscription.created/updated/active/pastDue`.
   - Copy the endpoint's **Signing Secret** (`whsec_...`) into the Convex
     env var `CLERK_WEBHOOK_SIGNING_SECRET` (dashboard, or
     `npx convex env set CLERK_WEBHOOK_SIGNING_SECRET whsec_...`).
   - Test it (endpoint's Testing tab → send a `user.created` example →
     expect 200), then create a real org/member and check the `users` /
     `organizations` / `orgMemberships` tables in the Convex data browser.
   - **Backfill:** webhooks only cover future events. Run the
     `clerkSync:backfill` internal action once from the Convex dashboard
     (Functions tab) to seed anything that existed before the endpoint was
     registered. Needs `CLERK_SECRET_KEY` in the Convex env.

The full rationale, a plan/feature/permission/role diagram, and a
step-by-step "decode your own JWT" sanity check live in
[`.claude/plans/PLAN.md`](.claude/plans/PLAN.md#clerk-dashboard-setup-guide-you-do-this-manually-in-this-order).

## Architecture

- **Authorization is claim-based, not DB-based.** Every Convex function
  reads the caller's org id, role, permissions and active-plan features
  straight off the fresh Clerk session token (`ctx.auth.getUserIdentity()`,
  decoded in [`convex/lib/auth.ts`](convex/lib/auth.ts)). Nothing is passed
  as a client argument, and nothing is looked up in a stale DB row for an
  authorization decision.
- **Data sync is webhook-based.** [`convex/http.ts`](convex/http.ts)
  verifies Clerk webhooks (`@clerk/backend/webhooks`) and dispatches to
  idempotent upsert/delete handlers in
  [`convex/clerkSync.ts`](convex/clerkSync.ts), which mirror users, orgs,
  memberships and subscription status into Convex tables — used for display
  (names, avatars, member lists, plan badges), never for authorization.
  [`convex/users.ts`](convex/users.ts)`.store` is a client-side fallback for
  the gap between sign-up and the first webhook delivery.
- **Schema** ([`convex/schema.ts`](convex/schema.ts)): `users`,
  `organizations`, `orgMemberships` (webhook-synced), `channels`,
  `channelMembers`, `messages`, `typing` (app data).

## Project status

- ✅ **Phase 0** — tooling fixes (fonts, ESLint 10 compat), Convex client
  provider, `proxy.ts` org-sync middleware.
- ✅ **Phase 1** — schema, claim-based auth helpers, Clerk → Convex webhook
  sync (`http.ts` / `clerkSync.ts`) + one-off backfill action.
- ⬜ Phase 2 — channels, app shell, onboarding.
- ⬜ Phase 3 — real-time messaging, typing, unread.
- ⬜ Phase 4 — billing gating (channel/history limits, private channels,
  upgrade flow).
- ⬜ Phase 5 — polish, landing page.

See [`.claude/plans/PLAN.md`](.claude/plans/PLAN.md) for the full plan,
including verification steps run at the end of each phase.
