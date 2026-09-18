# Nook redesign: The Drafting Table

**Status: superseded → shipped.** This file previously documented an
"Insura-inspired" marketing redesign (warm cream background, burnt-orange
accent, Fraunces serif) that landed in
[#6](https://github.com/bakale-atharva/Nook/pull/6). That plan is retired.
The Insura look turned out to match, almost exactly, one of the three looks
the Impeccable skill's own calibration section names as a default AI-cluster
aesthetic ("warm cream ground, high-contrast serif display, terracotta
accent") — so it was redesigned again, this time run through Impeccable's
full new-work flow end to end, with its mechanical AI-slop detector as part
of the process. See `DESIGN.md` and `PRODUCT.md` at the project root for the
durable, machine-readable record; this file is the narrative of how the
current system was chosen and what shipped.

## Why again

- The prior system was visually competent but generic — it was the category
  default the skill exists to break out of, not a genuine identity for Nook.
- `craft-floor.md`'s Refuse list also flagged mechanical issues already in
  the code: `.shadow-glow` was a zero-offset colored halo (decoration, not a
  depth system), and `.hero-gradient` was a decorative layered gradient of
  exactly the kind the floor exists to catch.
- The user asked for the redesign to go through the skill properly this
  time — `init` → a real direction roll → a committed build → the bundled
  detector → a finish review — rather than ad hoc styling.

## Process

1. **Init** — no `PRODUCT.md` existed; wrote one from code exploration plus
   a short confirmation round (audience: professional/work teams;
   positioning: calmer and more intentional than Discord/Slack, not bland;
   scope: the whole app, marketing through the authenticated chat UI; the
   prior look: pure anti-reference).
2. **Direction roll** — `impeccable concept-seed --scope direction --mode
   persuade` (seed key `d59617e6`) assigned **The Drafting Table**
   (architectural drafting / blueprint sheets) from a grounded list of seven
   candidates authored for Nook's own audience and mechanism, ahead of six
   catalog challengers. One challenger ("The Curved-Crease Sheet", paper
   engineering) stayed competitive as a full alternate; the rest were
   declined, each donating one discipline into the assigned direction
   (raises recorded in the surface brief). The roll was presented on the
   skill's decision page and the user locked the assigned direction as-is.
3. **Build** — code-led (no image-generation tool available in this
   session), directly against the recorded `## Direction contract` at
   `.impeccable/surfaces/app-page-tsx.md`.
4. **Detect + self-review** — `impeccable detect --json` ran clean. A
   finish-review pass (self-run in this harness — Claude Code has no
   `impeccable-finish-reviewer` subagent registered, so this substitution is
   disclosed here per the skill's own contract) caught two real craft-floor
   violations before shipping and both were fixed:
   - a metadata tag sitting directly above the landing H1 — a banned
     kicker/eyebrow regardless of "title block" framing — removed;
   - the fanned hero sheets and the marketing shell declaring both a border
     *and* a shadow (the "ghost card" pattern) — borders removed, shadow
     kept, per the new Ghost Card Rule in `DESIGN.md`.
   A missing signature-motion promise (the direction contract's raise about
   an authored entrance) was also caught and built: the hero's fanned sheets
   now settle into place on load (`fan-in`, staggered, respecting
   `prefers-reduced-motion`).
5. **Document** — `DESIGN.md` and `.impeccable/design.json` written from the
   finished build.

## What shipped

- **Two real artifacts, not a default toggle**: light mode is the vellum
  tracing sheet (paper ground, graphite ink); dark mode is the blueprint
  print itself (deep blue ground, white ink). The marketing/auth funnel
  always commits to the full-bleed blueprint-blue ground regardless of the
  page theme, via a small set of theme-invariant `--hero-*` tokens.
- **One structural color** (blueprint blue) plus **one reserved "live"
  color** (rust-red, unread/typing/primary-CTA only) — see `DESIGN.md`'s
  Named Rules.
- **Archivo** (display + body) and **Martian Mono** (tags, timestamps,
  revision numbers — real data, not a "technical" costume) replace Geist +
  Fraunces.
- New icon/favicon: `app/icon.svg`, a single-stroke drafted "N" monogram in
  the new palette (the old default Next.js `favicon.ico` was removed — no
  image-conversion tool was available in this session to regenerate a raster
  fallback, so SVG-unsupporting browsers get no icon rather than a
  mismatched one).
- Files touched: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
  `app/icon.svg`, `components/ui/button.tsx`, `components/chat-preview-mockup.tsx`,
  `components/marketing-shell.tsx`, `components/auth-split-shell.tsx`,
  `app/onboarding/page.tsx`, `components/typing-indicator.tsx`,
  `components/message-list.tsx`, plus the sidebar/unread-badge touch-up in
  `app/org/[slug]/layout.tsx`. Everything else (dialogs, inputs, the Clerk
  `PricingTable`/`OrganizationProfile` theming) inherits the new tokens
  automatically — no per-component edits needed there.

## Also landed in this pass

Alongside the redesign, `components/message-list.tsx` picked up two
functional changes the user asked for directly:

- **Discord-style message grouping**: consecutive messages from the same
  author within 60 seconds render as one visual group — avatar and name
  shown once, tightly stacked, with the timestamp revealed on hover in the
  avatar's gutter for grouped messages.
- **Date dividers**: "Today" is the only relative label. Every earlier day —
  including yesterday — gets a divider with its actual date, plus the year
  once it isn't the current year.

## Known gaps / not done

- No live authenticated screenshot verification (sidebar, message list,
  composer, member sidebar, settings, upgrade) — this session had no test
  account. The public surfaces (landing, sign-in/up) were verified live in
  the browser pane in both light and dark mode; the in-app surfaces were
  verified by code review and token inheritance only.
- The "one ruled geometry drives both diagram ink and interactive state"
  raise (hover-reveal dimension values) was recorded in the direction
  contract but not built — noted as a legitimate future enhancement, not a
  regression.
