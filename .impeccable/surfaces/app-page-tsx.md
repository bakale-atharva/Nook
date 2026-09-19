---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/layout.tsx","app/globals.css","app/sign-in","app/sign-up","app/onboarding","app/org"]
---

## Direction contract

THESIS: Nook refuses the chat-app-as-game-console default; every channel is a sheet in a shared drawing set the team keeps in sync, not a card in a feed.

OWN-WORLD: Blueprint-blue ground (`#1C3F5E`) carries 40-60% of every surface; vellum-white sheets (`#F4F0E6`) hold content; graphite ink (`#2A2D28`) sets structure and type; one rust-red mark (`#C1521E`) is reserved for live/unread state. UI type is a drafting-plan sans, set with ruled margins, title blocks, and dimension-line conventions. System events (joins, typing, upgrades) print as revision-log entries inside a sheet's title block, never as floating toasts. Presence renders as a graduated tone band next to a name, never a colored dot.

STORY: A visiting team lead sees their organization rendered as a set of sheets — channels — each legible at a glance, believes this is a calmer, more deliberate tool than Discord or Slack, and acts by opening a sheet and starting a conversation.

FIRST VIEWPORT: Landing hero: a blueprint-blue full-bleed ground holding 3-4 overlapping vellum sheets (channel previews) fanned like a drawing set, one lit with a rust-red live mark; headline in graphite ink set top-left like a title block; primary CTA as a rust-red stamped action.

FORM: The Drafting Table — assigned direction, index 5 of 7 grounded candidates, concept-seed key `d59617e6`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Scope note

This world is shared across the whole app: the marketing/auth funnel (Persuade — landing, sign-in, sign-up, onboarding, upgrade) expresses it at full hero commitment; the authenticated product (Operate — channel sidebar, message list, composer, member sidebar, settings) inherits the same palette, type, and sheet/title-block/revision-log vocabulary at working density, per `craft-floor.md`. Build path: code-led (no image generation available this session).
