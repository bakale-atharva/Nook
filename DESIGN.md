---
name: Nook
description: Team chat drafted as a set of sheets, not a feed to keep up with.
colors:
  blueprint-blue: "oklch(0.38 0.085 235)"
  rust-live: "oklch(0.52 0.17 28)"
  vellum: "oklch(0.975 0.006 95)"
  graphite-ink: "oklch(0.24 0.015 250)"
  ruled-border: "oklch(0.86 0.016 235)"
  paper-muted: "oklch(0.945 0.008 90)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-cta:
    backgroundColor: "{colors.rust-live}"
    textColor: "{colors.vellum}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-default:
    backgroundColor: "{colors.blueprint-blue}"
    textColor: "{colors.vellum}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
---

# Design System: Nook

## Overview

**Creative North Star: "The Drafting Table"**

Nook refuses the chat-app-as-game-console default. The system takes its whole visual grammar from architectural drafting: a channel is a sheet in a shared drawing set, not a card in an infinite feed. Every screen answers to two real artifacts from that world, never a default light/dark toggle — the vellum tracing sheet (paper ground, graphite ink) the product works on day to day, and the blueprint print itself (deep blue ground, white ink) that sheet was traced from. The public/marketing funnel commits fully to the blueprint print's full-bleed blue; the authenticated product works mostly on vellum, with the same blue and rust vocabulary carried through as structure, not decoration.

This direction replaces an earlier "Insura-inspired" pass (warm cream background, burnt-orange accent, Fraunces serif) that had drifted into one of the category's own default looks. That system is retired; nothing here inherits its tokens.

**Key Characteristics:**
- One committed structural color (blueprint blue), not a scattered accent
- A single rust-red "live" mark reserved for real-time/unread state — never decorative
- Sheets, title blocks, and revision numbers as real UI structure, not skeuomorphic flourish
- Flat, ruled, and precise — no gradients, no glass, no soft glow shadows

## Colors

A committed two-color structural system (blueprint blue, rust-red) on a paper-or-print neutral ground, never a scattered multi-accent palette.

### Primary
- **Blueprint Blue** (`oklch(0.38 0.085 235)` light / `oklch(0.75 0.09 220)` dark): the structural color — links, focus rings, primary actions, the sidebar frame, and the full-bleed marketing ground. Carries 30–60% of every surface; never a small accent chip.

### Secondary
- **Rust Live** (`oklch(0.52 0.17 28)` light / `oklch(0.62 0.18 30)` dark): reserved for the "live" mark — unread badges, the typing-indicator dot, and the primary `cta` button. Never used decoratively; its presence always means "something changed here."

### Neutral
- **Vellum** (`oklch(0.975 0.006 95)`): the working paper ground (light-mode background, sheet/card surfaces).
- **Graphite Ink** (`oklch(0.24 0.015 250)`): body text and structure, tinted cool toward the blueprint hue rather than warm brown or true black.
- **Ruled Border** (`oklch(0.86 0.016 235)`): dividers and sheet edges, sampled from the blueprint hue, never plain gray.
- **Paper Muted** (`oklch(0.945 0.008 90)`): secondary surfaces, skeleton states.

### Named Rules
**The One Structural Color Rule.** Blueprint blue is the only color that owns page-scale regions. Every other color (rust, graphite, chart hues) is reserved for a specific, narrow role and never expands to fill a surface.

## Typography

**Display Font:** Archivo (with ui-sans-serif fallback)
**Body Font:** Archivo (with ui-sans-serif fallback)
**Label/Mono Font:** Martian Mono (with ui-monospace fallback)

**Character:** One grotesk sans carries both display and body type — a workhorse face with enough structure to hold a bold headline, so hierarchy comes from weight and size, never a second display family. Martian Mono is reserved for what a drafting sheet actually sets in monospace: revision numbers, timestamps, channel tags, dimension-style labels.

### Hierarchy
- **Display** (600, `clamp(2.25rem, 4vw, 3rem)`, 1.1, -0.02em): hero and page headlines only.
- **Title** (600, 1.5rem, 1.2, -0.02em): section headings.
- **Body** (400, 1rem, 1.6): running copy, message text.
- **Label** (500, 0.6875rem, 1.4, 0.06em, uppercase, mono): title-block metadata, tags, revision numbers, timestamps — always tabular numerals.

### Named Rules
**The No Second Display Face Rule.** Archivo carries every heading at every weight. A second display family is never introduced for "personality" — weight, size, and the mono label voice already carry it.

## Layout

Two registers, not a light/dark default: the marketing/auth funnel (Persuade) commits full-bleed to the blueprint-blue ground with a fine `.blueprint-grid` ruled-paper texture; the authenticated product (Operate) works on the vellum ground, with blueprint blue confined to the sidebar frame and structural accents. Content sits in vellum "sheets" (cards) that float above whichever ground is active. Responsive behavior is standard fluid reflow; the fanned hero sheets stack to a single visual on narrow viewports.

## Elevation & Depth

Depth comes from real offset-and-blur shadows only — never a colored halo, never a border stacked under a shadow on the same element.

### Shadow Vocabulary
- **shadow-sheet** (`0 1px 2px [ink 8%], 0 12px 28px -10px [ink 28%]`): a sheet resting near the surface — dialogs, inline cards.
- **shadow-sheet-lg** (`0 2px 4px [ink 10%], 0 24px 48px -16px [ink 32%]`): a sheet lifted further off the table — the hero mockup, the auth/marketing shell card.

### Named Rules
**The Ghost Card Rule.** An element declares elevation once: a border, or a shadow, never both. A bordered element sits flat on the page; a lifted sheet is defined by its cast shadow alone.

## Shapes

A small, precise radius scale (`--radius: 0.5rem` base) — architectural, not bubbly. Pills are reserved for small controls only (badges, the "live" dot); sheets and cards keep trimmed, structural corners.

## Components

### Buttons
- **Shape:** trimmed corners (`calc(var(--radius-sm) - 2px)`, ~4.8px), never a pill except where a control is genuinely small.
- **Primary (`cta`):** rust-live background, vellum text, `shadow-sheet` at rest, lifts one pixel with `shadow-sheet-lg` on hover — reserved for the single clearest action per screen (sign up, send, create channel, upgrade).
- **Default:** blueprint-blue background, vellum text — the standard action button.
- **Outline / Ghost / Secondary:** transparent or paper-muted backgrounds with the ruled border — used for every non-primary action so the rust/blue vocabulary stays legible as "this matters."

### Cards / Sheets
- **Corner Style:** trimmed radius, matching the button scale scaled up (~8–14px).
- **Background:** vellum, always.
- **Shadow Strategy:** `shadow-sheet` / `shadow-sheet-lg` per the Ghost Card Rule; no border on a shadowed sheet.
- **Title Block:** a small bordered metadata strip (`.title-block`) inside a sheet carries channel name, revision number, and live state in Martian Mono — this is the system's signature structural motif, and it is never used as a label sitting directly above a page headline (see Do's and Don'ts).

### Inputs / Fields
- **Style:** ruled border, vellum/paper-muted background, trimmed radius.
- **Focus:** a 3px ring in blueprint blue at 50% opacity, matching the button focus treatment.

### Navigation
- **Sidebar (Operate):** blueprint-blue frame (darker than the primary token), vellum text, rust for the active/unread state — the frame holding the vellum content sheets, per the world's own composition. Sections run Starred, Channels, Direct messages; a star appears on row hover. An unread @mention swaps the plain rust count for a filled rust `@N` pill, because "something needs you" is exactly the state rust is reserved for.

### Message Furniture
- **Reaction chip:** a small pill (a genuinely small control) with a hairline border and no shadow. Idle chips are paper on ruled border; a chip you have reacted with takes a blueprint-blue tint (`primary/10` fill, `primary/40` border, blue text). Rust is never used for reactions. Counts are Martian Mono tabular figures because they are data.
- **Heart:** a one-click ❤️ reaction. When set, the icon fills in blueprint blue rather than red.
- **@mention chip:** an inline blueprint-blue tint on the name; a mention of the current user is one step stronger.
- **Attachment tile:** an image inside a hairline border with a trimmed radius and no shadow. Clicking opens it in a dialog.
- **Drop overlay:** dropping images shows the `.blueprint-grid` ground inside a dashed blueprint-blue border, with a mono label. It is the ground's own texture responding to the gesture, not new decoration.
- **Message action bar:** a hairline-bordered strip pinned to a row's top edge on hover or focus. Popovers (emoji picker, mention list) match the dropdown menu surface.
- **Thread panel:** a right-hand column with the same hairline divider as the member list, replacing it while open, and a sheet on small screens.

### Signature Component: The Fanned Sheet
The landing hero's chat preview renders three channel sheets fanned like a drawing set, one lit with the rust live mark. On load, each sheet settles into its fanned position with one authored entrance (`fan-in`, `cubic-bezier(0.16, 1, 0.3, 1)`, staggered ~90ms per sheet, disabled under `prefers-reduced-motion`) — the system's one deliberate motion moment, never repeated as a generic entrance on every section.

## Do's and Don'ts

### Do:
- **Do** keep blueprint blue as the only page-scale structural color; every other hue stays narrowly scoped.
- **Do** use Martian Mono exclusively for real data — tags, timestamps, revision numbers — never as a generic "technical" costume.
- **Do** declare elevation once per element (border or shadow, never both — the Ghost Card Rule).
- **Do** author real content for the title-block/revision-log motif (channel tags, live marks) rather than decorative section numbering.

### Don't:
- **Don't** place any label, tag, or metadata strip directly above a page or section headline — that is a kicker/eyebrow, banned outright regardless of framing.
- **Don't** reintroduce a colored halo shadow (`.shadow-glow`) or a decorative gradient background (`.hero-gradient`) — both were retired from the prior system and are not part of this one.
- **Don't** fabricate presence/online-status UI; the product has no real presence data, so none is shown.
- **Don't** let the blueprint-blue ground drift warm (no cream, no orange) — that was the prior system, and this world's ground is a cool, structural blue.
