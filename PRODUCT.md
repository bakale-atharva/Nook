# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Professional/work teams. A Clerk organization models a company or team workspace; a channel models a project, topic, or workstream within it. The primary user is a member of that team coordinating work in real time.

## Product Purpose

Nook is a real-time team chat app: organizations (workspaces) contain channels, members post and read messages live, and admins manage membership and billing. Built on Convex (realtime data/sync) and Clerk (auth, organizations, billing).

## Positioning

A calmer, more intentional alternative to Discord/Slack for work teams — an explicit rejection of loud, gamified, notification-heavy chat-app energy. This is a constraint on tone and pacing, not a license to default to flat, generic "SaaS dashboard" blandness.

## Operating Context

- Clerk organizations are workspaces; members join/switch orgs via `OrganizationSwitcher`.
- Channels are created, joined, and left within an org; one channel is active at a time in the chat view.
- Messaging is real-time (Convex), with typing indicators.
- Billing is freemium: a free organization is capped at 5 channels (`FREE_CHANNEL_LIMIT`); upgrading via Clerk's `PricingTable` (`for="organization"`) removes the cap.
- Member and org management (roles, invites, billing) happens through Clerk's `OrganizationProfile` component.

## Capabilities and Constraints

- Real-time messaging, typing indicators, channel create/delete/leave, org-scoped access control — all confirmed working today.
- Auth, organizations, and billing are Clerk-managed; org/member data and chat messages are Convex-managed.
- No native mobile app; web only (including mobile web).

## Brand Commitments

The product name "Nook" stays. No other visual or identity constraints are binding: the prior "Insura-inspired" visual direction (cream background, burnt-orange accent, Fraunces serif) was an earlier design pass and is explicitly not a constraint for future work — treat it as evidence of what was tried, not as an identity to preserve.

## Evidence on Hand

None. No real screenshots, customer names, testimonials, case studies, or press exist. `public/` holds only unmodified `create-next-app` placeholder SVGs — no logo or brand imagery exists yet. Future work should not fabricate any of these; where illustrative content is needed, it must be authored and clearly synthetic, never presented as real evidence.

## Product Principles

- Calm over loud: notifications, motion, and visual noise stay proportionate to a work tool, not a game.
- Real-time should feel immediate, not effortful — messaging, typing state, and org/channel switching read as instant.
- Freemium constraints (channel limits, upgrade paths) are surfaced clearly, never as dark patterns.
- One coherent visual world spans the public marketing/auth funnel and the authenticated product — a visitor's path from landing page to first message should feel like one product, not two.
